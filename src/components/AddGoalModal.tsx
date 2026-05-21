import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Target } from 'lucide-react';
import { cn } from '../lib/utils';

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    name: string; targetAmount: number; currentAmount: number; deadline: Date;
  }) => Promise<void>;
}

export default function AddGoalModal({ isOpen, onClose, onAdd }: AddGoalModalProps) {
  const [form, setForm] = useState({
    name: '', targetAmount: '', currentAmount: '', deadline: '',
  });
  const [saving, setSaving] = useState(false);

  const isValid = form.name.trim() && Number(form.targetAmount) > 0 && form.deadline;

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await onAdd({
        name:          form.name.trim(),
        targetAmount:  Number(form.targetAmount),
        currentAmount: Number(form.currentAmount) || 0,
        deadline:      new Date(form.deadline),
      });
      setForm({ name: '', targetAmount: '', currentAmount: '', deadline: '' });
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
              <Target className="w-5 h-5 text-[#06B6D4]" />
              <h3 className="text-xl font-bold text-[#f8fafc]">New Savings Goal</h3>
            </div>
            <button onClick={onClose} className="text-[#64748b] hover:text-[#f8fafc]">
              <X className="w-5 h-5" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Goal name (e.g. Emergency Fund)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b]"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#64748b] uppercase tracking-wider pl-2 mb-1 block">
                Target Amount (₹)
              </label>
              <input
                type="number"
                placeholder="500000"
                value={form.targetAmount}
                onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))}
                className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b]"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#64748b] uppercase tracking-wider pl-2 mb-1 block">
                Saved so far (₹)
              </label>
              <input
                type="number"
                placeholder="0"
                value={form.currentAmount}
                onChange={e => setForm(f => ({ ...f, currentAmount: e.target.value }))}
                className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b]"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#64748b] uppercase tracking-wider pl-2 mb-1 block">
              Target deadline
            </label>
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc]"
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
                : 'bg-[#06B6D4] text-[#090D16] shadow-xl shadow-[#06B6D4]/20'
            )}
          >
            {saving ? 'Saving…' : 'Create Goal'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}