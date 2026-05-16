import React, { useMemo, memo } from 'react';
import { motion } from 'motion/react';
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { Transaction } from '../types';

const CHART_COLORS = ['#06B6D4', '#10B981', '#fbbf24', '#F43F5E', '#a855f7', '#f97316'];

interface AnalyticsTabProps {
  transactions: Transaction[];
  totals: { income: number; expenses: number; investments: number };
}

const AnalyticsTab = memo(function AnalyticsTab({ transactions, totals }: AnalyticsTabProps) {
  const spendingCategories = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(tx => {
      if (tx.type === 'debit' && tx.category !== 'Investment') {
        map[tx.category] = (map[tx.category] ?? 0) + tx.amount;
      }
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [transactions]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { label: string; income: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = format(d, 'MMM');
      const key = format(d, 'yyyy-MM');
      months.push({ label, income: 0, expenses: 0, _key: key } as typeof months[0] & { _key: string });
    }
    transactions.forEach(tx => {
      const key = format(tx.date.toDate(), 'yyyy-MM');
      const entry = (months as Array<typeof months[0] & { _key: string }>).find(m => m._key === key);
      if (!entry) return;
      if (tx.type === 'credit') entry.income  += tx.amount;
      if (tx.type === 'debit')  entry.expenses += tx.amount;
    });
    return (months as Array<typeof months[0] & { _key: string }>).map(({ _key, ...rest }) => rest);
  }, [transactions]);

  const savingsRate = totals.income > 0
    ? Math.round(((totals.income - totals.expenses) / totals.income) * 100)
    : 0;

  return (
    <motion.div
      key="analytics"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-6 pb-32"
    >
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Income',   value: totals.income,   color: '#10B981' },
          { label: 'Expenses', value: totals.expenses,  color: '#F43F5E' },
          { label: 'Savings',  value: savingsRate, suffix: '%', color: '#06B6D4' },
        ].map(item => (
          <div key={item.label} className="bg-[#131B2E] rounded-[20px] p-4 border border-[#1E293B]">
            <p className="text-[9px] uppercase tracking-widest font-semibold text-[#64748b] mb-1">
              {item.label}
            </p>
            <p className="font-bold text-base" style={{ color: item.color }}>
              {item.suffix ? `${item.value}${item.suffix}` : `₹${item.value.toLocaleString('en-IN')}`}
            </p>
          </div>
        ))}
      </div>

      {/* Monthly bar chart */}
      <div className="bg-[#131B2E] rounded-[24px] p-5 border border-[#1E293B]">
        <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-4">
          Monthly Overview (6 months)
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyData} barCategoryGap="30%">
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={32} />
            <Tooltip
              contentStyle={{ background: '#131B2E', border: '1px solid #1E293B', borderRadius: 12, fontSize: 11 }}
              labelStyle={{ color: '#f8fafc' }}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              formatter={(val: number) => [`₹${val.toLocaleString('en-IN')}`, '']}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8', paddingTop: 8 }} />
            <Bar dataKey="income"   name="Income"   fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={20} />
            <Bar dataKey="expenses" name="Expenses" fill="#F43F5E" radius={[6, 6, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Spending breakdown pie */}
      <div className="bg-[#131B2E] rounded-[24px] p-5 border border-[#1E293B]">
        <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-4">
          Spending Breakdown
        </h3>
        {spendingCategories.length === 0 ? (
          <div className="py-8 text-center text-[#64748b] text-sm">No expense data yet</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={spendingCategories}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {spendingCategories.map((_entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#131B2E', border: '1px solid #1E293B', borderRadius: 12, fontSize: 11 }}
                  formatter={(val: number) => [`₹${val.toLocaleString('en-IN')}`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {spendingCategories.map((cat, idx) => (
                <div key={cat.name} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                  />
                  <span className="text-xs text-[#94a3b8] truncate">{cat.name}</span>
                  <span className="text-xs font-bold text-[#f8fafc] ml-auto shrink-0">
                    ₹{cat.value.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
});

export default AnalyticsTab;
