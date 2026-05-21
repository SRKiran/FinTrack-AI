import React, { useState, useMemo, useCallback, memo } from 'react';
import { Search, X, IndianRupee, CreditCard, Trash2, Check, ListChecks, Loader2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore';
import { Transaction } from '../types';
import { cn } from '../lib/utils';
import EditTransactionModal from '../components/EditTransactionModal';

interface HistoryTabProps {
  transactions:       Transaction[];
  filterAccount:      string | null;
  onSetFilterAccount: (acc: string | null) => void;
  loadingMore:        boolean;
  hasMore:            boolean;
  onLoadMore:         () => void;
}

const HistoryTab = memo(function HistoryTab({
  transactions, filterAccount, onSetFilterAccount, loadingMore, hasMore, onLoadMore,
}: HistoryTabProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const groupedTransactions = useMemo(() => {
    let filtered = [...transactions].sort((a, b) => b.date.toMillis() - a.date.toMillis());

    if (filterAccount) {
      filtered = filtered.filter(tx => tx.accountIdentifier === filterAccount);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(tx =>
        tx.description.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q)    ||
        tx.amount.toString().includes(q)          ||
        (tx.accountIdentifier?.toLowerCase().includes(q) ?? false)
      );
    }

    const groups: Record<string, Transaction[]> = {};
    filtered.forEach(tx => {
      const key = format(tx.date.toDate(), 'MMMM yyyy');
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return Object.entries(groups).map(([month, txs]) => ({ month, txs }));
  }, [transactions, filterAccount, searchQuery]);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'transactions', id));
      });
      await batch.commit();
      setSelectMode(false);
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
    } catch (e) {
      console.error('Failed to bulk delete', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      setConfirmDeleteId(null);
    } catch (e) { handleFirestoreError(e, OperationType.DELETE, `transactions/${id}`); }
  }, []);

  return (
    <motion.div
      key="history"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-4 pb-32"
    >
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="flex-1 flex items-center bg-[#131B2E] rounded-[24px] px-4 py-3 border border-[#1E293B]">
          <Search className="w-4 h-4 text-[#64748b] mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search transactions…"
            className="bg-transparent outline-none text-sm w-full text-[#f8fafc] placeholder-[#64748b]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="ml-2 text-[#64748b] hover:text-[#f8fafc]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Select Mode Toggle */}
        <button
          onClick={() => {
            setSelectMode(!selectMode);
            setSelectedIds(new Set());
            setBulkDeleteConfirm(false);
          }}
          className={cn(
            "p-3 rounded-full transition-colors flex items-center justify-center shrink-0 border",
            selectMode ? "bg-[#06B6D4] text-[#090D16] border-[#06B6D4]" : "bg-[#131B2E] text-[#64748b] border-[#1E293B] hover:text-[#f8fafc]"
          )}
        >
          {selectMode ? <X className="w-5 h-5" /> : <ListChecks className="w-5 h-5" />}
        </button>
      </div>

      {/* Account filter banner */}
      {filterAccount && (
        <div className="flex items-center justify-between bg-[#06B6D4]/10 border border-[#06B6D4]/30 rounded-[16px] px-4 py-2">
          <span className="text-xs font-semibold text-[#06B6D4]">Filtering: {filterAccount}</span>
          <button
            onClick={() => onSetFilterAccount(null)}
            className="p-1 hover:bg-[#06B6D4]/20 rounded-full"
          >
            <X className="w-4 h-4 text-[#06B6D4]" />
          </button>
        </div>
      )}

      {/* Groups */}
      {groupedTransactions.map(group => (
        <div key={group.month} className="space-y-3">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b] sticky top-0 z-10 bg-[#090D16]/95 backdrop-blur-sm py-2 -mx-6 px-6">
            {group.month}
          </h4>
          <div className="space-y-2 relative">
            <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-[#1E293B] z-0" />
            {group.txs.map(tx => (
              <div
                key={tx.id}
                onClick={() => { if (selectMode && tx.id) toggleSelection(tx.id); }}
                className={cn(
                  'relative z-10 border-l-4 pl-4 py-3 pr-4 flex items-center justify-between group overflow-hidden transition-colors',
                  tx.source === 'system'
                    ? 'border-[#8B5CF6]'
                    : tx.type === 'credit'
                    ? 'border-[#10B981]'
                    : 'border-[#F43F5E]',
                  selectMode ? 'cursor-pointer hover:bg-[#1E293B]/40' : '',
                  selectMode && selectedIds.has(tx.id!) ? 'bg-[#06B6D4]/10' : ''
                )}
              >
                {/* Full Line Confirmation Overlay */}
                {confirmDeleteId === tx.id && (
                  <div className="absolute inset-0 bg-[#090D16]/95 backdrop-blur-sm z-20 flex items-center justify-between px-4 border-l-4 border-l-[#F43F5E] animate-in fade-in duration-200">
                    <span className="text-[12px] font-bold text-[#F43F5E]">Delete transaction?</span>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        className="px-4 py-1.5 bg-[#1E293B] text-[#f8fafc] rounded-full text-[11px] font-bold hover:bg-[#334155] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(tx.id!); }}
                        className="px-4 py-1.5 bg-[#F43F5E] text-white rounded-full text-[11px] font-bold shadow-lg shadow-[#F43F5E]/20 hover:bg-[#E11D48] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center flex-1 min-w-0">
                  {selectMode && (
                    <div className="shrink-0 mr-4">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        selectedIds.has(tx.id!) ? "bg-[#06B6D4] border-[#06B6D4]" : "border-[#475569]"
                      )}>
                        {selectedIds.has(tx.id!) && <Check className="w-3 h-3 text-[#090D16]" />}
                      </div>
                    </div>
                  )}
                  {!selectMode && (
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center mr-4 shrink-0',
                      tx.type === 'credit' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#1E293B] text-[#f8fafc]'
                    )}>
                      {tx.type === 'credit'
                        ? <IndianRupee className="w-5 h-5" />
                        : <CreditCard className="w-5 h-5" />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#f8fafc] truncate">{tx.description}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <p className="text-[11px] text-[#94a3b8] capitalize">{tx.source} • {tx.category}</p>
                      {tx.accountIdentifier && !selectMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetFilterAccount(
                              tx.accountIdentifier === filterAccount ? null : tx.accountIdentifier!
                            );
                          }}
                          className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded-full transition-colors font-mono tracking-tight border',
                            filterAccount === tx.accountIdentifier
                              ? 'bg-[#06B6D4] border-[#06B6D4] text-[#090D16]'
                              : 'bg-transparent border-[#1E293B] text-[#e2e8f0] hover:bg-[#1E293B]'
                          )}
                        >
                          {tx.accountIdentifier}
                        </button>
                      )}
                    </div>
                    {tx.availableBalance !== undefined && !selectMode && (
                      <p className="text-[9px] text-[#06B6D4] mt-1 font-mono">
                        Bal: ₹{tx.availableBalance.toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 ml-2 relative">
                  <div className={cn("text-right", !selectMode && "group-hover:-translate-x-20 transition-transform")}>
                    <p className={cn(
                      'font-bold text-sm',
                      tx.type === 'credit' ? 'text-[#10B981]' : 'text-[#F43F5E]'
                    )}>
                      {tx.type === 'credit' ? '+' : '−'} ₹{tx.amount.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-[#64748b] font-mono mt-0.5">
                      {format(tx.date.toDate(), 'dd MMM')}
                    </p>
                  </div>
                  
                  {!selectMode && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-[#131B2E] shadow-[-12px_0_12px_#131B2E] pl-2 pr-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingTransaction(tx); }}
                        className="p-2 text-[#475569] hover:text-[#06B6D4] hover:bg-[#06B6D4]/10 rounded-full mr-1"
                        title="Edit transaction"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(tx.id!); }}
                        className="p-2 text-[#475569] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 rounded-full"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Empty states */}
      {transactions.length === 0 && (
        <div className="py-12 text-center text-[#64748b] text-sm">No transactions yet</div>
      )}
      {searchQuery && groupedTransactions.length === 0 && transactions.length > 0 && (
        <div className="py-8 text-center text-[#64748b] text-sm">
          No results for &quot;{searchQuery}&quot;
        </div>
      )}

      {/* Load More */}
      {hasMore && !searchQuery && !filterAccount && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full py-4 bg-[#131B2E] border border-[#1E293B] rounded-[24px] text-sm font-semibold text-[#94a3b8] hover:text-[#f8fafc] transition-colors disabled:opacity-50"
        >
          {loadingMore ? 'Loading…' : 'Load Older Transactions'}
        </button>
      )}

      {/* Bulk Delete Footer */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
             initial={{ y: 200, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             exit={{ y: 200, opacity: 0 }}
             className="fixed bottom-[80px] left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[400px] z-[60] bg-[#1E293B]/95 backdrop-blur-md border border-[#334155] rounded-[24px] p-4 shadow-2xl flex items-center justify-between"
          >
            {bulkDeleteConfirm ? (
              <div className="flex-1 flex items-center justify-between gap-4">
                 <span className="text-sm font-bold text-[#F43F5E]">Delete {selectedIds.size} items?</span>
                 <div className="flex gap-2">
                   <button onClick={() => setBulkDeleteConfirm(false)} className="px-5 py-2.5 bg-[#090D16] text-[#64748b] text-xs font-bold rounded-full transition-colors hover:text-[#f8fafc]">Cancel</button>
                   <button onClick={handleBulkDelete} disabled={isDeleting} className="px-5 py-2.5 bg-[#F43F5E] text-white text-xs font-bold rounded-full transition-colors hover:bg-[#E11D48] disabled:opacity-50 shadow-lg shadow-[#F43F5E]/20 flex items-center justify-center min-w-[90px]">{isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}</button>
                 </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-between gap-4">
                <span className="text-sm font-bold text-[#f8fafc]">
                   {selectedIds.size} selected
                </span>
                <button 
                  onClick={() => setBulkDeleteConfirm(true)}
                  disabled={selectedIds.size === 0}
                  className={cn(
                    "px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all",
                    selectedIds.size > 0 ? "bg-[#F43F5E] text-white shadow-lg shadow-[#F43F5E]/20" : "bg-[#090D16] text-[#475569]"
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <EditTransactionModal
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
      />
    </motion.div>
  );
});

export default HistoryTab;