import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Building2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; type: 'asset' | 'liability'; identifier?: string }) => Promise<void>;
}

export default function AddAccountModal({ isOpen, onClose, onAdd }: AddAccountModalProps) {
  const [name,       setName]       = useState('');
  const [type,       setType]       = useState<'asset' | 'liability'>('asset');
  const [identifier, setIdentifier] = useState('');
  const [saving,     setSaving]     = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onAdd({
        name: name.trim(),
        type,
        identifier: identifier.trim() || undefined,
      });
      setName(''); setType('asset'); setIdentifier('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-md bg-[#131B2E] rounded-t-[32px] p-6 border-t border-x border-[#1E293B]"
          onClick={e => e.stopPropagation()}
        >
          <div className="w-12 h-1.5 bg-[#1E293B] rounded-full mx-auto mb-6" />

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-[14px] bg-[#1E293B] flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#06B6D4]" />
            </div>
            <h2 className="text-xl font-bold text-[#f8fafc]">New Account</h2>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <input
              type="text"
              placeholder="Account name (e.g. HDFC Salary)"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b]"
              autoFocus
            />

            {/* Type */}
            <div className="grid grid-cols-2 gap-3">
              {(['asset', 'liability'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'py-3 rounded-[24px] text-sm font-bold border transition-all capitalize',
                    type === t
                      ? t === 'asset'
                        ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                        : 'bg-[#F43F5E]/15 border-[#F43F5E]/40 text-[#F43F5E]'
                      : 'bg-[#090D16] border-[#1E293B] text-[#64748b]'
                  )}
                >
                  {t === 'asset' ? 'Asset (Bank)' : 'Liability (CC/Loan)'}
                </button>
              ))}
            </div>

            {/* Identifier (optional) */}
            <div>
              <input
                type="text"
                placeholder="SMS identifier (optional, e.g. HDFC xxx345)"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b] font-mono"
              />
              <p className="text-[10px] text-[#475569] mt-1.5 px-2">
                Match the account identifier from your bank SMS to auto-link transactions.
              </p>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim()}
              className={cn(
                'w-full py-4 rounded-[24px] font-bold transition-all',
                !name.trim()
                  ? 'bg-[#1E293B] text-[#64748b] cursor-not-allowed'
                  : 'bg-[#06B6D4] text-[#090D16] shadow-xl shadow-[#06B6D4]/20'
              )}
            >
              {saving ? 'Saving…' : 'Create Account'}
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
