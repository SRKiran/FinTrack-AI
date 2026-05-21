import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bell } from 'lucide-react';
import { ReminderType } from '../types';
import { cn } from '../lib/utils';

interface AddReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    type: ReminderType; description: string; amount: number; dueDate: Date;
  }) => Promise<void>;
}

const REMINDER_TYPES: { value: ReminderType; label: string }[] = [
  { value: 'credit_card', label: 'Credit Card Bill' },
  { value: 'loan',        label: 'Loan Repayment'  },
  { value: 'utility',     label: 'Utility Bill'    },
  { value: 'other',       label: 'Other'           },
];

export default function AddReminderModal({ isOpen, onClose, onAdd }: AddReminderModalProps) {
  const [form, setForm] = useState({
    type: 'credit_card' as ReminderType,
    description: '',
    amount: '',
    dueDate: '',
  });
  const [saving, setSaving] = useState(false);

  const isValid = form.description.trim() && Number(form.amount) > 0 && form.dueDate;

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await onAdd({
        type:        form.type,
        description: form.description.trim(),
        amount:      Number(form.amount),
        dueDate:     new Date(form.dueDate),
      });
      setForm({ type: 'credit_card', description: '', amount: '', dueDate: '' });
      onClose();
    } finally {
      setSaving(false);
    }
  }, [form, isValid, onAdd, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="w-full max-w-md bg-[#131B2E] border border-[#1E293B] border-b-0 rounded-t-[40px] p-8 space-y-4"
          onClick={e => e.stopPropagation()}
        >
          <div className="w-12 h-1.5 bg-[#1E293B] rounded-full mx-auto mb-2" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-[#f59e0b]" />
              <h3 className="text-xl font-bold text-[#f8fafc]">Add Reminder</h3>
            </div>
            <button onClick={onClose} className="text-[#64748b] hover:text-[#f8fafc]">
              <X className="w-5 h-5" />
            </button>
          </div>

          <select
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as ReminderType }))}
            className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#f59e0b] text-[#f8fafc]"
          >
            {REMINDER_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Description (e.g. HDFC Credit Card)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#f59e0b] text-[#f8fafc] placeholder-[#64748b]"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder="Amount (₹)"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#f59e0b] text-[#f8fafc] placeholder-[#64748b]"
            />
            <input
              type="date"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              className="p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#f59e0b] text-[#f8fafc]"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className={cn(
              'w-full py-4 rounded-[24px] font-bold transition-all',
              !isValid || saving
                ? 'bg-[#1E293B] text-[#64748b]'
                : 'bg-[#f59e0b] text-[#090D16] shadow-xl shadow-[#f59e0b]/20'
            )}
          >
            {saving ? 'Saving…' : 'Set Reminder'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}