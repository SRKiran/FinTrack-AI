import React, { useMemo, memo } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, TrendingDown, TrendingUp, Wallet, Plus, Building2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Transaction, TabName, Account } from '../types';
import { cn } from '../lib/utils';

interface AccountsTabProps {
  transactions:  Transaction[];
  accounts:      Account[];
  onAddAccount:  () => void;
  onDeleteAccount: (id: string) => void;
  onNavigate:    (tab: TabName, filter: string) => void;
}

interface TxStats {
  identifier:    string;
  accountName:   string | null;
  latestBalance: number | null;
  latestBalanceDate: Date | null;
  totalCredit:   number;
  totalDebit:    number;
  lastActivity:  Date;
  txCount:       number;
}

const AccountsTab = memo(function AccountsTab({
  transactions, accounts, onAddAccount, onDeleteAccount, onNavigate,
}: AccountsTabProps) {
  // Build transaction stats map keyed by accountIdentifier
  const txStatsMap = useMemo(() => {
    const map = new Map<string, TxStats>();
    transactions.forEach(tx => {
      if (!tx.accountIdentifier) return;
      const key = tx.accountIdentifier;
      if (!map.has(key)) {
        map.set(key, {
          identifier: key, accountName: tx.accountName ?? null, latestBalance: null, latestBalanceDate: null,
          totalCredit: 0, totalDebit: 0,
          lastActivity: tx.date.toDate(), txCount: 0,
        });
      }
      const s = map.get(key)!;
      if (tx.accountName && !s.accountName) s.accountName = tx.accountName;
      if (tx.type === 'credit') s.totalCredit += tx.amount;
      if (tx.type === 'debit')  s.totalDebit  += tx.amount;
      
      const d = tx.date.toDate();
      if (tx.availableBalance !== undefined) {
        if (!s.latestBalanceDate || d.getTime() >= s.latestBalanceDate.getTime()) {
          s.latestBalance = tx.availableBalance;
          s.latestBalanceDate = d;
        }
      }
      if (d.getTime() > s.lastActivity.getTime()) s.lastActivity = d;
      s.txCount += 1;
    });
    return map;
  }, [transactions]);

  // Identifiers already linked to a named account
  const linkedIdentifiers = useMemo(
    () => new Set(accounts.map(a => a.identifier).filter(Boolean) as string[]),
    [accounts]
  );

  // Auto-detected accounts from SMS not linked to any named account
  const autoDetected = useMemo(() =>
    [...txStatsMap.values()]
      .filter(s => !linkedIdentifiers.has(s.identifier))
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()),
    [txStatsMap, linkedIdentifiers]
  );

  const noData = accounts.length === 0 && autoDetected.length === 0;

  return (
    <motion.div
      key="accounts"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-4 pb-32"
    >
      {/* ── My Accounts ── */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#64748b]">
            My Accounts
          </h3>
          <button
            onClick={onAddAccount}
            className="flex items-center gap-1 text-[10px] font-bold text-[#06B6D4] hover:text-[#06B6D4]/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {accounts.length === 0 ? (
          <button
            onClick={onAddAccount}
            className="w-full border-2 border-dashed border-[#1E293B] rounded-[24px] py-6 text-center text-[#64748b] text-xs hover:border-[#06B6D4]/40 hover:text-[#06B6D4] transition-colors"
          >
            <Building2 className="w-5 h-5 mx-auto mb-2 opacity-50" />
            Create your first account
          </button>
        ) : (
          <div className="space-y-3">
            {accounts.map(acc => {
              const stats = acc.identifier ? txStatsMap.get(acc.identifier) : undefined;
              return (
                <NamedAccountCard
                  key={acc.id}
                  account={acc}
                  stats={stats}
                  onNavigate={onNavigate}
                  onDelete={() => onDeleteAccount(acc.id!)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── Auto-detected from SMS ── */}
      {autoDetected.length > 0 && (
        <section className="pt-2">
          <h3 className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#64748b] mb-3 px-1">
            Detected from SMS
          </h3>
          <div className="space-y-3">
            {autoDetected.map(s => (
              <AccountCard
                key={s.identifier}
                stats={s}
                isLiability={(s.latestBalance ?? 0) < 0}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>
      )}

      {noData && (
        <div className="py-16 text-center text-[#64748b] text-sm">
          <Wallet className="w-8 h-8 mx-auto mb-3 text-[#1E293B]" />
          No accounts yet.<br />Create one above or add an SMS transaction to auto-detect.
        </div>
      )}
    </motion.div>
  );
});

// Named account card (manually created by user)
function NamedAccountCard({
  account, stats, onNavigate, onDelete,
}: { account: Account; stats?: TxStats; onNavigate: (tab: TabName, f: string) => void; onDelete: () => void }) {
  const isLiability = account.type === 'liability';
  const filterKey   = account.identifier ?? account.name;

  return (
    <div className="w-full bg-[#131B2E] border border-[#1E293B] rounded-[24px] p-5 flex items-center justify-between hover:border-[#06B6D4]/40 transition-colors group">
      <button
        onClick={() => stats ? onNavigate('history', filterKey) : undefined}
        className="flex items-center gap-4 flex-1 min-w-0 text-left"
      >
        <div className={cn(
          'w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0',
          isLiability ? 'bg-[#F43F5E]/10' : 'bg-[#06B6D4]/10'
        )}>
          <Building2 className={cn('w-5 h-5', isLiability ? 'text-[#F43F5E]' : 'text-[#06B6D4]')} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-[#f8fafc] truncate">{account.name}</p>
          {account.identifier && (
            <p className="font-mono text-[10px] text-[#64748b] mt-0.5">{account.identifier}</p>
          )}
          {stats ? (
            <p className="text-[10px] text-[#475569] mt-0.5">
              Last active {format(stats.lastActivity, 'dd MMM')} · {stats.txCount} txns
            </p>
          ) : (
            <p className="text-[10px] text-[#475569] mt-0.5">No transactions linked</p>
          )}
        </div>
      </button>

      <div className="flex items-center gap-3 shrink-0">
        {stats?.latestBalance !== undefined && stats.latestBalance !== null ? (
          <p className={cn('font-bold text-sm', isLiability ? 'text-[#F43F5E]' : 'text-[#10B981]')}>
            ₹{Math.abs(stats.latestBalance).toLocaleString('en-IN')}
          </p>
        ) : (
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full border',
            isLiability
              ? 'text-[#F43F5E] border-[#F43F5E]/30 bg-[#F43F5E]/10'
              : 'text-[#10B981] border-[#10B981]/30 bg-[#10B981]/10'
          )}>
            {isLiability ? 'Liability' : 'Asset'}
          </span>
        )}
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 text-[#64748b] hover:text-[#F43F5E] transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {stats && <ChevronRight className="w-4 h-4 text-[#475569]" />}
      </div>
    </div>
  );
}

// Auto-detected account card (from SMS transactions)
function AccountCard({
  stats, isLiability, onNavigate,
}: { stats: TxStats; isLiability: boolean; onNavigate: (tab: TabName, f: string) => void }) {
  const balanceColor = isLiability ? '#F43F5E' : '#10B981';
  return (
    <button
      onClick={() => onNavigate('history', stats.identifier)}
      className="w-full bg-[#131B2E] border border-[#1E293B] rounded-[24px] p-5 flex items-center justify-between hover:border-[#06B6D4]/40 transition-colors text-left"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-[16px] bg-[#1E293B] flex items-center justify-center shrink-0">
          <Wallet className="w-5 h-5 text-[#94a3b8]" />
        </div>
        <div>
          <p className="font-bold text-sm text-[#f8fafc]">
            {stats.accountName || stats.identifier.split(' ')[0]}
          </p>
          <p className="font-mono text-[11px] text-[#64748b] mt-0.5">{stats.identifier}</p>
          <p className="text-[10px] text-[#475569] mt-0.5">
            Last active {format(stats.lastActivity, 'dd MMM')} · {stats.txCount} txns
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          {stats.latestBalance !== null ? (
            <p className="font-bold text-sm" style={{ color: balanceColor }}>
              ₹{Math.abs(stats.latestBalance).toLocaleString('en-IN')}
            </p>
          ) : (
            <p className="text-xs text-[#64748b]">No balance</p>
          )}
          <div className="flex items-center gap-1.5 mt-1 justify-end">
            <span className="text-[9px] text-[#10B981] flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />₹{stats.totalCredit.toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] text-[#F43F5E] flex items-center gap-0.5">
              <TrendingDown className="w-2.5 h-2.5" />₹{stats.totalDebit.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#475569]" />
      </div>
    </button>
  );
}

export default AccountsTab;