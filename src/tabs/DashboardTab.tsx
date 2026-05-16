import React, { memo } from 'react';
import {
  IndianRupee, TrendingUp, Wallet, CreditCard,
  DollarSign, ChevronRight, Plus, Bell,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Transaction, Reminder, SavingsGoal, TabName } from '../types';

interface DashboardTabProps {
  transactions: Transaction[];
  reminders:    Reminder[];
  goals:        SavingsGoal[];
  totals:       { income: number; expenses: number; investments: number };
  netWorth:     number;
  onReminderPaid: (id: string) => void;
  onNavigate:   (tab: TabName) => void;
  onAddGoal:    () => void;
  onAddReminder: () => void;
}

const DashboardTab = memo(function DashboardTab({
  transactions, reminders, goals, totals, netWorth,
  onReminderPaid, onNavigate, onAddGoal, onAddReminder,
}: DashboardTabProps) {
  const recent = [...transactions]
    .sort((a, b) => b.date.toMillis() - a.date.toMillis())
    .slice(0, 5);

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-6 space-y-4"
    >
      {/* ── Balance Hero Card ── */}
      <div className="bg-gradient-to-br from-[#131B2E] to-[#1e1b4b] rounded-[24px] p-5 text-[#f8fafc] shadow-lg border border-[#312e81]">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1">
          Effective Balance
        </p>
        <h2 className="text-3xl font-bold flex items-center mb-6">
          <IndianRupee className="w-6 h-6 mr-1" />
          {netWorth.toLocaleString('en-IN')}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#1E293B]/50 rounded-[16px] p-3 border border-[#1E293B]">
            <p className="text-[12px] font-semibold tracking-wider text-[#94a3b8] mb-1 uppercase">Income</p>
            <p className="font-bold text-lg">₹{totals.income.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-[#1E293B]/50 rounded-[16px] p-3 border border-[#1E293B]">
            <p className="text-[12px] font-semibold tracking-wider text-[#f43f5e] mb-1 uppercase">Expenses</p>
            <p className="font-bold text-lg text-[#f43f5e]">₹{totals.expenses.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* ── Pending Reminders ── */}
      <div className="bg-[#131B2E] rounded-[24px] p-5 border border-[#1E293B]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8]">
            Reminders
          </h3>
          <button
            onClick={onAddReminder}
            className="flex items-center gap-1 text-[#f59e0b] text-[11px] font-bold uppercase tracking-wider"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        {reminders.length === 0 ? (
          <button
            onClick={onAddReminder}
            className="w-full py-5 border border-dashed border-[#1E293B] rounded-[16px] flex flex-col items-center gap-2 text-[#64748b] hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="text-xs font-medium">No pending reminders — add one</span>
          </button>
        ) : (
          <div className="space-y-3">
            {reminders.map(rem => {
              const daysLeft = differenceInDays(rem.dueDate.toDate(), new Date());
              const isUrgent = daysLeft <= 3;
              return (
                <div
                  key={rem.id}
                  className="bg-[#1E293B] rounded-[16px] p-4 flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-[#F43F5E]/10 flex items-center justify-center mr-4">
                      <CreditCard className="w-5 h-5 text-[#F43F5E]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#f8fafc] text-sm">{rem.description}</p>
                      <p className={cn(
                        'text-[11px] font-medium mt-0.5',
                        isUrgent ? 'text-[#F43F5E]' : 'text-[#94a3b8]'
                      )}>
                        {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Due today' : `Due in ${daysLeft} days`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onReminderPaid(rem.id!)}
                    className="text-[#f8fafc] text-xs font-bold px-3 py-1 bg-[#F43F5E] rounded-full hover:bg-[#dc2626] transition-colors"
                  >
                    ₹{rem.amount.toLocaleString('en-IN')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Savings Goals ── */}
      <div className="bg-[#131B2E] rounded-[24px] p-5 border border-[#1E293B]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8]">
            Savings Goals
          </h3>
          <button
            onClick={onAddGoal}
            className="flex items-center gap-1 text-[#06B6D4] text-[11px] font-bold uppercase tracking-wider"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        {goals.length === 0 ? (
          <button
            onClick={onAddGoal}
            className="w-full py-6 border border-dashed border-[#1E293B] rounded-[16px] flex flex-col items-center gap-2 text-[#64748b] hover:border-[#06B6D4] hover:text-[#06B6D4] transition-colors"
          >
            <Plus className="w-6 h-6" />
            <span className="text-sm font-medium">Set your first savings goal</span>
          </button>
        ) : (
          <div className="space-y-4">
            {goals.slice(0, 3).map(goal => {
              const pct = Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100);
              return (
                <div key={goal.id} className="flex flex-col gap-2">
                  <div className="flex justify-between items-end">
                    <div className="font-bold text-2xl text-[#f8fafc]">{pct}%</div>
                    <div className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider text-right">
                      {goal.name}<br />
                      ₹{(goal.currentAmount / 100000).toFixed(1)}L / ₹{(goal.targetAmount / 100000).toFixed(1)}L
                    </div>
                  </div>
                  <div className="h-3 bg-[#1E293B] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#06B6D4] to-[#818cf8] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#131B2E] p-5 rounded-[24px] border border-[#1E293B] flex flex-col justify-between">
          <div className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Investments</div>
          <p className="font-bold text-xl text-[#f8fafc]">₹{totals.investments.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-[#10B981] mt-1 font-medium flex items-center">
            <TrendingUp className="w-3 h-3 mr-1" /> Tracked
          </p>
        </div>
        <div className="bg-[#131B2E] p-5 rounded-[24px] border border-[#1E293B] flex flex-col justify-between">
          <div className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Net Worth</div>
          <p className="font-bold text-xl text-[#f8fafc]">₹{netWorth.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-[#06B6D4] mt-1 font-medium flex items-center">
            <Wallet className="w-3 h-3 mr-1" /> Calculated
          </p>
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <div className="bg-[#131B2E] rounded-[24px] p-5 border border-[#1E293B]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8]">
            Recent Transactions
          </h3>
          <button
            onClick={() => onNavigate('history')}
            className="text-[#06B6D4] text-[11px] font-bold uppercase tracking-wider"
          >
            View All
          </button>
        </div>
        <div className="space-y-4">
          {recent.map(tx => (
            <div key={tx.id} className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center mr-4',
                  tx.type === 'credit' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#1E293B] text-[#f8fafc]'
                )}>
                  {tx.type === 'credit'
                    ? <DollarSign className="w-5 h-5" />
                    : <CreditCard className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#f8fafc] truncate max-w-[150px]">
                    {tx.description}
                  </p>
                  <p className="text-[11px] text-[#64748b]">{format(tx.date.toDate(), 'dd MMM, p')}</p>
                </div>
              </div>
              <p className={cn(
                'font-bold text-sm',
                tx.type === 'credit' ? 'text-[#10B981]' : 'text-[#f8fafc]'
              )}>
                {tx.type === 'credit' ? '+' : '−'} ₹{tx.amount.toLocaleString('en-IN')}
              </p>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="py-8 text-center text-[#64748b] text-sm">No transactions yet</div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export default DashboardTab;
