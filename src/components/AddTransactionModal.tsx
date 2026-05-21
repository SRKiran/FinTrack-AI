import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection, addDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { MessageSquare, Lock, Paperclip, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { ai, getParserPromptWithContext } from '../lib/gemini';
import { handleFirestoreError, OperationType } from '../lib/firestore';
import { Transaction, UserProfile } from '../types';
import { cn } from '../lib/utils';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  profile: UserProfile;
  /** Recent transactions passed for AI context and per-account balance reconciliation */
  transactions: Transaction[];
}

const CATEGORIES = [
  'Food', 'Groceries', 'Shopping', 'Transport', 'Entertainment', 'Utilities',
  'Rent', 'Salary', 'Investment', 'Loan Payment', 'Mutual Fund',
  'Petrol', 'Restaurant', 'Other',
];

export default function AddTransactionModal({
  isOpen, onClose, userId, profile, transactions,
}: AddTransactionModalProps) {
  const [mode, setMode]           = useState<'smart' | 'manual'>('smart');
  const [scanText, setScanText]   = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const [manualForm, setManualForm] = useState({
    title: '', amount: '', type: 'debit' as 'debit' | 'credit',
    category: 'Shopping', accountIdentifier: '', balance: '',
    isInvestment: false, accountType: 'asset' as 'asset' | 'liability',
    date: new Date().toISOString().split('T')[0], // today as default
  });

  // ── Per-account balance reconciliation (fixed from global net-worth bug) ──────
  const reconcileBalance = useCallback(async (
    accountIdentifier: string,
    accountType: 'asset' | 'liability' | null,
    incomingAvailableBalance: number,
    txType: 'debit' | 'credit',
    txAmount: number,
  ) => {
    const txImpact = txType === 'credit' ? txAmount : -txAmount;

    // Find the most-recent stored balance snapshot for THIS specific account
    const acctTxs = transactions
      .filter(t => t.accountIdentifier === accountIdentifier && t.availableBalance !== undefined)
      .sort((a, b) => b.date.toMillis() - a.date.toMillis());

    if (acctTxs.length > 0) {
      const lastKnownBalance = acctTxs[0].availableBalance!;
      const expectedBalance  = lastKnownBalance + txImpact;

      if (Math.abs(incomingAvailableBalance - expectedBalance) > 0.1) {
        const gap = incomingAvailableBalance - expectedBalance;
        await addDoc(collection(db, 'transactions'), {
          userId,
          amount:    Math.abs(gap),
          type:      gap > 0 ? 'credit' : 'debit',
          date:      Timestamp.fromMillis(Date.now() - 1000),
          description: 'Balance Adjustment (Auto)',
          category:  'Adjustment',
          source:    'system',
          isInvestment: false,
          accountIdentifier,
          accountType,
          availableBalance: lastKnownBalance + gap,
          createdAt: serverTimestamp(),
        });
      }
    } else {
      // First transaction for this account — create an opening balance entry
      const openingBalance = incomingAvailableBalance - txImpact;
      if (Math.abs(openingBalance) > 0.1) {
        await addDoc(collection(db, 'transactions'), {
          userId,
          amount:    Math.abs(openingBalance),
          type:      openingBalance > 0 ? 'credit' : 'debit',
          date:      Timestamp.fromMillis(Date.now() - 2000),
          description: 'Opening Balance',
          category:  'Adjustment',
          source:    'system',
          isInvestment: false,
          accountIdentifier,
          accountType,
          availableBalance: Math.max(openingBalance, 0),
          createdAt: serverTimestamp(),
        });
      }
    }
  }, [transactions, userId]);

  // ── Smart AI parse ────────────────────────────────────────────────────────────
  const parseMessage = useCallback(async () => {
    if (!scanText.trim()) return;
    setIsParsing(true);
    try {
      const prompt = getParserPromptWithContext(transactions);
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',           // Updated from gemini-3-flash-preview
        contents: `${prompt}\n\nMessage: ${scanText}`,
        config: { responseMimeType: 'application/json' },
      });

      const data = JSON.parse(result.text || '{}');
      if (data.rejected || data.isPersonalMessage) {
        setScanText('');
        onClose();
        return;
      }

      // Per-account reconciliation (only when accountIdentifier is present)
      if (
        data.availableBalance !== null &&
        data.availableBalance !== undefined &&
        data.accountIdentifier
      ) {
        await reconcileBalance(
          data.accountIdentifier,
          data.accountType ?? null,
          data.availableBalance,
          data.type,
          data.amount,
        );
      }

      // Save the extracted transaction — only structured fields are stored (no raw SMS).
      await addDoc(collection(db, 'transactions'), {
        userId,
        amount:            data.amount,
        type:              data.type,
        date:              Timestamp.now(),
        description:       data.description,
        category:          data.category,
        source:            'sms',
        isInvestment:      data.isInvestment,
        availableBalance:  data.availableBalance ?? undefined,
        accountIdentifier: data.accountIdentifier ?? undefined,
        accountType:       data.accountType ?? undefined,
        createdAt:         serverTimestamp(),
      });

      // Auto-create reminder for detected credit card bills
      if (data.isCreditCardBill && data.dueDate) {
        await addDoc(collection(db, 'reminders'), {
          userId,
          type:        'credit_card',
          amount:      data.amount,
          dueDate:     Timestamp.fromDate(new Date(data.dueDate)),
          description: `Credit Card Bill: ${data.description}`,
          isPaid:      false,
          createdAt:   serverTimestamp(),
        });
      }

      setScanText('');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to parse message. Please try again or use manual entry.');
    } finally {
      setIsParsing(false);
    }
  }, [scanText, transactions, reconcileBalance, userId, onClose]);

  // ── Manual entry ─────────────────────────────────────────────────────────────
  const handleManualAdd = useCallback(async () => {
    if (!manualForm.title || !manualForm.amount) return;
    try {
      await addDoc(collection(db, 'transactions'), {
        userId,
        amount:            Number(manualForm.amount),
        type:              manualForm.type,
        date:              Timestamp.fromDate(new Date(manualForm.date)),
        description:       manualForm.title,
        category:          manualForm.category,
        source:            'manual',
        isInvestment:      manualForm.isInvestment,
        availableBalance:  manualForm.balance ? Number(manualForm.balance) : undefined,
        accountIdentifier: manualForm.accountIdentifier || undefined,
        accountType:       manualForm.accountIdentifier ? manualForm.accountType : undefined,
        createdAt:         serverTimestamp(),
      });
      setManualForm({
        title: '', amount: '', type: 'debit', category: 'Shopping',
        accountIdentifier: '', balance: '', isInvestment: false, accountType: 'asset',
        date: new Date().toISOString().split('T')[0],
      });
      onClose();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'transactions');
    }
  }, [manualForm, userId, onClose]);

  const handleClose = useCallback(() => {
    setScanText('');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-md"
        onClick={handleClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="border border-[#1E293B] border-b-0 w-full max-w-md rounded-t-[40px] p-8 shadow-2xl relative overflow-hidden"
          style={{
            backgroundColor: '#131B2E',
            backgroundImage: mode === 'smart'
              ? 'radial-gradient(circle at 50% 0%, rgba(139,92,246,0.15) 0%, transparent 70%)'
              : 'none',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="w-12 h-1.5 bg-[#1E293B] rounded-full mx-auto mb-6" />

          {/* Mode switcher */}
          <div className="flex bg-[#1E293B] p-1 rounded-full mb-6 relative">
            {(['smart', 'manual'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 py-2 text-sm font-bold rounded-full z-10 transition-colors capitalize',
                  mode === m ? 'text-[#090D16]' : 'text-[#94a3b8]'
                )}
              >
                {m === 'smart' ? 'Smart AI' : 'Manual'}
              </button>
            ))}
            <motion.div
              initial={false}
              animate={{ left: mode === 'smart' ? '0.25rem' : '50%', width: 'calc(50% - 0.25rem)' }}
              className={cn(
                'absolute top-1 bottom-1 rounded-full z-0',
                mode === 'smart' ? 'bg-[#8B5CF6]' : 'bg-[#06B6D4]'
              )}
            />
          </div>

          {/* ── Smart AI Tab ── */}
          {mode === 'smart' && (
            <>
              <h3 className="text-2xl font-bold text-[#f8fafc] mb-2">Smart Sync</h3>
              <p className="text-[#94a3b8] text-sm mb-6">
                Paste your bank SMS or message below. AI will extract only the transaction details.
              </p>

              <div className="relative mb-6">
                <textarea
                  value={scanText}
                  onChange={e => setScanText(e.target.value)}
                  placeholder="e.g. HDFC Bank: Rs 500 debited for Zomato on 07-May..."
                  className="w-full h-40 p-4 bg-[#090D16] border border-[#1E293B] text-[#f8fafc] placeholder-[#64748b] rounded-[24px] outline-none focus:ring-2 focus:ring-[#8B5CF6] text-sm resize-none"
                />
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {/* ── PDF Attachment (Premium) ── */}
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    disabled={!profile.isPremium}
                    accept=".pdf,.xlsx,.csv"
                    onChange={e => {
                      if (e.target.files?.[0]) {
                        // TODO: pipe file text through Gemini parser
                        alert(`File "${e.target.files[0].name}" selected.\nPDF parsing coming soon.`);
                      }
                    }}
                  />
                  <label
                    htmlFor={profile.isPremium ? 'file-upload' : undefined}
                    onClick={() => {
                      if (!profile.isPremium)
                        alert('Attachment parsing is a Premium feature. Enable it in the Me tab.');
                    }}
                    className={cn(
                      'cursor-pointer flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                      profile.isPremium
                        ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] hover:bg-[#8B5CF6]/30'
                        : 'bg-[#1E293B] text-[#64748b]'
                    )}
                  >
                    {profile.isPremium ? <Paperclip className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </label>
                  <MessageSquare className="w-5 h-5 text-[#8B5CF6] opacity-20" />
                </div>
              </div>

              <button
                onClick={() => {
                  if (!profile.isPremium) {
                    alert('Smart Sync is a Premium feature. Enable it in the Me tab.');
                    return;
                  }
                  parseMessage();
                }}
                disabled={isParsing || (!scanText && !!profile.isPremium)}
                className={cn(
                  'w-full py-4 rounded-[24px] font-bold flex items-center justify-center transition-all',
                  !profile.isPremium
                    ? 'bg-[#1E293B] text-[#f59e0b]'
                    : isParsing || !scanText
                    ? 'bg-[#1E293B] text-[#64748b]'
                    : 'bg-[#8B5CF6] text-[#090D16] shadow-xl shadow-[#8B5CF6]/20'
                )}
              >
                {!profile.isPremium ? (
                  <><Lock className="w-5 h-5 mr-2" /> Unlock Smart AI</>
                ) : isParsing ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="h-5 w-5 border-2 border-[#090D16] border-t-transparent rounded-full"
                  />
                ) : 'Scan with AI'}
              </button>
            </>
          )}

          {/* ── Manual Tab ── */}
          {mode === 'manual' && (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pb-4">
              <h3 className="text-2xl font-bold text-[#f8fafc] mb-2">Manual Entry</h3>

              <input
                type="text"
                placeholder="Title / Description"
                value={manualForm.title}
                onChange={e => setManualForm(f => ({ ...f, title: e.target.value }))}
                className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b]"
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Amount (₹)"
                  value={manualForm.amount}
                  onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))}
                  className="p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b]"
                />
                <select
                  value={manualForm.type}
                  onChange={e => setManualForm(f => ({ ...f, type: e.target.value as 'debit' | 'credit' }))}
                  className="p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc]"
                >
                  <option value="debit">Expense</option>
                  <option value="credit">Income</option>
                </select>
              </div>

              {/* Date picker — fixes the always-now timestamp issue */}
              <input
                type="date"
                value={manualForm.date}
                onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))}
                className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc]"
                style={{ colorScheme: 'dark' }}
              />

              <select
                value={manualForm.category}
                onChange={e => setManualForm(f => ({ ...f, category: e.target.value }))}
                className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc]"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Account (e.g. HDFC 1234)"
                  value={manualForm.accountIdentifier}
                  onChange={e => setManualForm(f => ({ ...f, accountIdentifier: e.target.value }))}
                  className="p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b]"
                />
                <select
                  value={manualForm.accountType}
                  onChange={e => setManualForm(f => ({ ...f, accountType: e.target.value as 'asset' | 'liability' }))}
                  className="p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc]"
                >
                  <option value="asset">Asset (Bank)</option>
                  <option value="liability">Liability (CC/Loan)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 px-2">
                <input
                  type="checkbox"
                  id="isInv"
                  checked={manualForm.isInvestment}
                  onChange={e => setManualForm(f => ({ ...f, isInvestment: e.target.checked }))}
                  className="w-4 h-4 accent-[#06B6D4]"
                />
                <label htmlFor="isInv" className="text-sm text-[#94a3b8]">Mark as Investment</label>
              </div>

              <input
                type="number"
                placeholder="New Account Balance (optional)"
                value={manualForm.balance}
                onChange={e => setManualForm(f => ({ ...f, balance: e.target.value }))}
                className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b]"
              />

              <button
                onClick={handleManualAdd}
                disabled={!manualForm.title || !manualForm.amount}
                className={cn(
                  'w-full py-4 rounded-[24px] font-bold flex items-center justify-center transition-all',
                  !manualForm.title || !manualForm.amount
                    ? 'bg-[#1E293B] text-[#64748b]'
                    : 'bg-[#06B6D4] text-[#090D16] shadow-xl shadow-[#06B6D4]/20'
                )}
              >
                Save Transaction
              </button>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-6 right-6 text-[#64748b] hover:text-[#f8fafc] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}