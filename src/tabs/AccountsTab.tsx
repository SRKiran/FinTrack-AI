import React, { useMemo, memo } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { Transaction, TabName } from '../types';
import { cn } from '../lib/utils';

interface AccountsTabProps {
  transactions: Transaction[];
  onNavigate: (tab: TabName, filter: string) => void;
}

interface AccountSummary {
  identifier:    string;
  bank:          string;
  latestBalance: number | null;
  totalCredit:   number;
  totalDebit:    number;
  lastActivity:  Date;
  txCount:       number;
}

const AccountsTab = memo(function AccountsTab({ transactions, onNavigate }: AccountsTabProps) {
  const accounts: AccountSummary[] = useMemo(() => {
    const map = new Map<string, AccountSummary>();

    transactions.forEach(tx => {
      if (!tx.accountIdentifier) return;
      const key = tx.accountIdentifier;
      if (!map.has(key)) {
        map.set(key, {
          identifier:   key,
          bank:         key.split(' ')[0],
          latestBalance: null,
          totalCredit:  0,
          totalDebit:   0,
          lastActivity: tx.date.toDate(),
          txCount:      0,
        });
      }
      const acc = map.get(key)!;
      if (tx.type === 'credit') acc.totalCredit += tx.amount;
      if (tx.type === 'debit')  acc.totalDebit  += tx.amount;
      if (tx.availableBalance !== undefined) {
        const txDate = tx.date.toDate();
        if (!acc.latestBalance || txDate >= acc.lastActivity) {
          acc.latestBalance = tx.availableBalance;
        }
      }
      if (tx.date.toDate() > acc.lastActivity) acc.lastActivity = tx.date.toDate();
      acc.txCount += 1;
    });

    return [...map.values()].sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }, [transactions]);

  const assets      = accounts.filter(a => (a.latestBalance ?? 0) >= 0);
  const liabilities = accounts.filter(a => (a.latestBalance ?? 0) < 0);

  return (
    <motion.div
      key="accounts"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-4 pb-32"
    >
      {accounts.length === 0 && (
        <div className="py-16 text-center text-[#64748b] text-sm">
          <Wallet className="w-8 h-8 mx-auto mb-3 text-[#1E293B]" />
          No accounts detected yet.<br />Add your first SMS transaction to see accounts.
        </div>
      )}

      {assets.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#64748b] mb-3 px-1">
            Accounts
          </h3>
          <div className="space-y-3">
            {assets.map(acc => (
              <AccountCard key={acc.identifier} acc={acc} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      )}

      {liabilities.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#64748b] mb-3 px-1 mt-4">
            Liabilities
          </h3>
          <div className="space-y-3">
            {liabilities.map(acc => (
              <AccountCard key={acc.identifier} acc={acc} onNavigate={onNavigate} isLiability />
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
});

function AccountCard({
  acc, onNavigate, isLiability = false,
}: { acc: AccountSummary; onNavigate: (tab: TabName, filter: string) => void; isLiability?: boolean }) {
  const balanceColor = isLiability ? '#F43F5E' : '#10B981';

  return (
    <button
      onClick={() => onNavigate('history', acc.identifier)}
      className="w-full bg-[#131B2E] border border-[#1E293B] rounded-[24px] p-5 flex items-center justify-between hover:border-[#06B6D4]/40 transition-colors text-left"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-[16px] bg-[#1E293B] flex items-center justify-center shrink-0">
          <Wallet className="w-5 h-5 text-[#94a3b8]" />
        </div>
        <div>
          <p className="font-bold text-sm text-[#f8fafc]">{acc.bank}</p>
          <p className="font-mono text-[11px] text-[#64748b] mt-0.5">{acc.identifier}</p>
          <p className="text-[10px] text-[#475569] mt-0.5">
            Last active {format(acc.lastActivity, 'dd MMM')} · {acc.txCount} txns
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="text-right">
          {acc.latestBalance !== null ? (
            <p className="font-bold text-sm" style={{ color: balanceColor }}>
              ₹{Math.abs(acc.latestBalance).toLocaleString('en-IN')}
            </p>
          ) : (
            <p className="text-xs text-[#64748b]">No balance</p>
          )}
          <div className="flex items-center gap-1.5 mt-1 justify-end">
            <span className="text-[9px] text-[#10B981] flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />₹{acc.totalCredit.toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] text-[#F43F5E] flex items-center gap-0.5">
              <TrendingDown className="w-2.5 h-2.5" />₹{acc.totalDebit.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#475569]" />
      </div>
    </button>
  );
}

export default AccountsTab;