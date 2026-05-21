import React, { memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, X, Bell, Plus } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { Reminder } from '../types';
import { cn } from '../lib/utils';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  reminders: Reminder[];
  onMarkPaid: (id: string) => void;
  onAddReminder: () => void;
}

const NotificationPanel = memo(function NotificationPanel({
  isOpen, onClose, reminders, onMarkPaid, onAddReminder,
}: NotificationPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-16 right-0 left-0 max-w-md mx-auto z-[95] px-4"
          >
            <div className="bg-[#131B2E] border border-[#1E293B] rounded-[24px] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B]">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#f59e0b]" />
                  <span className="text-sm font-bold text-[#f8fafc]">Reminders</span>
                  {reminders.length > 0 && (
                    <span className="bg-[#F43F5E] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {reminders.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { onAddReminder(); onClose(); }}
                    className="text-[#06B6D4] text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-full hover:bg-[#06B6D4]/10 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                  <button onClick={onClose} className="text-[#64748b] hover:text-[#f8fafc] p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {reminders.length === 0 ? (
                  <div className="py-10 text-center text-[#64748b] text-sm">
                    No pending reminders
                  </div>
                ) : (
                  <div className="divide-y divide-[#1E293B]">
                    {reminders.map(rem => {
                      const daysLeft = differenceInDays(rem.dueDate.toDate(), new Date());
                      const isOverdue = daysLeft < 0;
                      const isUrgent  = daysLeft <= 3 && !isOverdue;
                      return (
                        <div key={rem.id} className="flex items-center justify-between px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-9 h-9 rounded-full flex items-center justify-center',
                              isOverdue ? 'bg-[#F43F5E]/10' : isUrgent ? 'bg-[#f59e0b]/10' : 'bg-[#1E293B]'
                            )}>
                              <CreditCard className={cn(
                                'w-4 h-4',
                                isOverdue ? 'text-[#F43F5E]' : isUrgent ? 'text-[#f59e0b]' : 'text-[#94a3b8]'
                              )} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#f8fafc] truncate max-w-[160px]">
                                {rem.description}
                              </p>
                              <p className={cn(
                                'text-[11px] font-medium mt-0.5',
                                isOverdue ? 'text-[#F43F5E]' : isUrgent ? 'text-[#f59e0b]' : 'text-[#94a3b8]'
                              )}>
                                {isOverdue
                                  ? `Overdue by ${Math.abs(daysLeft)}d`
                                  : daysLeft === 0
                                  ? 'Due today'
                                  : `Due in ${daysLeft}d — ${format(rem.dueDate.toDate(), 'dd MMM')}`}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => onMarkPaid(rem.id!)}
                            className="text-xs font-bold px-3 py-1.5 bg-[#1E293B] hover:bg-[#10B981]/20 hover:text-[#10B981] text-[#94a3b8] rounded-full transition-colors shrink-0"
                          >
                            ₹{rem.amount.toLocaleString('en-IN')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

export default NotificationPanel;