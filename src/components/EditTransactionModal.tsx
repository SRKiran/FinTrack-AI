import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { X } from 'lucide-react';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore';
import { Transaction } from '../types';
import { cn } from '../lib/utils';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

const CATEGORIES = [
  'Food', 'Groceries', 'Shopping', 'Transport', 'Entertainment', 'Utilities',
  'Rent', 'Salary', 'Investment', 'Loan Payment', 'Mutual Fund',
  'Petrol', 'Restaurant', 'Adjustment', 'Other',
];

export default function EditTransactionModal({ transaction, onClose }: EditTransactionModalProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (transaction) {
      setTitle(transaction.description);
      setAmount(transaction.amount.toString());
      setCategory(transaction.category);
      
      const d = transaction.date.toDate();
      setDateStr(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      setTimeStr(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }
  }, [transaction]);

  const handleSave = async () => {
    if (!transaction?.id || !title || !amount || !dateStr || !timeStr) return;
    setIsSaving(true);
    try {
      const newDate = new Date(`${dateStr}T${timeStr}:00`);
      await updateDoc(doc(db, 'transactions', transaction.id), {
        description: title,
        amount: Number(amount),
        category,
        date: Timestamp.fromDate(newDate),
      });
      onClose();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'transactions');
    } finally {
      setIsSaving(false);
    }
  };

  if (!transaction) return null;

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
          className="border border-[#1E293B] border-b-0 w-full max-w-md bg-[#131B2E] rounded-t-[40px] p-8 shadow-2xl relative overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="w-12 h-1.5 bg-[#1E293B] rounded-full mx-auto mb-6" />

          <h3 className="text-2xl font-bold text-[#f8fafc] mb-6">Edit Transaction</h3>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Title / Description"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b]"
            />

            <input
              type="number"
              placeholder="Amount (₹)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b]"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc]"
                style={{ colorScheme: 'dark' }}
              />
              <input
                type="time"
                value={timeStr}
                onChange={e => setTimeStr(e.target.value)}
                className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc]"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc]"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <button
              onClick={handleSave}
              disabled={isSaving || !title || !amount || !dateStr || !timeStr}
              className={cn(
                'w-full py-4 rounded-[24px] font-bold flex items-center justify-center transition-all mt-4',
                isSaving || !title || !amount || !dateStr || !timeStr
                  ? 'bg-[#1E293B] text-[#64748b]'
                  : 'bg-[#06B6D4] text-[#090D16] shadow-xl shadow-[#06B6D4]/20'
              )}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-[#64748b] hover:text-[#f8fafc] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
