import React, { useState, useMemo, useCallback, memo } from 'react';
import { Search, X, DollarSign, CreditCard, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore';
import { Transaction } from '../types';
import { cn } from '../lib/utils';

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

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (e) { handleFirestoreError(e, OperationType.DELETE, `transactions/${id}`); }
  }, []);

  return (
    <motion.div
      key="history"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-4 pb-32"
    >
      {/* Search */}
      <div className="flex items-center bg-[#131B2E] rounded-[24px] px-5 py-3 border border-[#1E293B]">
        <Search className="w-5 h-5 text-[#64748b] mr-3 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by vendor, category, amount…"
          className="bg-transparent outline-none text-sm w-full text-[#f8fafc] placeholder-[#64748b]"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="ml-2 text-[#64748b] hover:text-[#f8fafc]">
            <X className="w-4 h-4" />
          </button>
        )}
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
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b] px-2">
            {group.month}
          </h4>
          <div className="space-y-2 relative">
            <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-[#1E293B] z-0" />
            {group.txs.map(tx => (
              <div
                key={tx.id}
                className={cn(
                  'relative z-10 border-l-4 pl-4 py-3 pr-4 flex items-center justify-between group',
                  tx.source === 'system'
                    ? 'border-[#8B5CF6]'
                    : tx.type === 'credit'
                    ? 'border-[#10B981]'
                    : 'border-[#F43F5E]'
                )}
              >
                <div className="flex items-center flex-1 min-w-0">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center mr-4 shrink-0',
                    tx.type === 'credit' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#1E293B] text-[#f8fafc]'
                  )}>
                    {tx.type === 'credit'
                      ? <DollarSign className="w-5 h-5" />
                      : <CreditCard className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#f8fafc] truncate">{tx.description}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <p className="text-[11px] text-[#94a3b8] capitalize">{tx.source} • {tx.category}</p>
                      {tx.accountIdentifier && (
                        <button
                          onClick={() => onSetFilterAccount(
                            tx.accountIdentifier === filterAccount ? null : tx.accountIdentifier!
                          )}
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
                    {tx.availableBalance !== undefined && (
                      <p className="text-[9px] text-[#06B6D4] mt-1 font-mono">
                        Bal: ₹{tx.availableBalance.toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <div className="text-right">
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
                  {/* Delete — only for non-system entries; shown on hover */}
                  {tx.source !== 'system' && (
                    <button
                      onClick={() => handleDelete(tx.id!)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 text-[#64748b] hover:text-[#F43F5E] transition-all"
                      title="Delete transaction"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
    </motion.div>
  );
});

export default HistoryTab;