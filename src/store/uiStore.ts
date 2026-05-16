import { create } from 'zustand';
import { TabName } from '../types';

interface UIState {
  activeTab: TabName;
  filterAccount: string | null;
  isAddTxOpen: boolean;
  isGoalOpen: boolean;
  isReminderOpen: boolean;
  isNotifOpen: boolean;

  setActiveTab: (tab: TabName) => void;
  setFilterAccount: (acc: string | null) => void;
  openAddTx: () => void;
  closeAddTx: () => void;
  openGoal: () => void;
  closeGoal: () => void;
  openReminder: () => void;
  closeReminder: () => void;
  toggleNotif: () => void;
  closeNotif: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab:      'dashboard',
  filterAccount:  null,
  isAddTxOpen:    false,
  isGoalOpen:     false,
  isReminderOpen: false,
  isNotifOpen:    false,

  setActiveTab:     (tab) => set({ activeTab: tab }),
  setFilterAccount: (acc) => set({ filterAccount: acc }),
  openAddTx:        () => set({ isAddTxOpen: true }),
  closeAddTx:       () => set({ isAddTxOpen: false }),
  openGoal:         () => set({ isGoalOpen: true }),
  closeGoal:        () => set({ isGoalOpen: false }),
  openReminder:     () => set({ isReminderOpen: true }),
  closeReminder:    () => set({ isReminderOpen: false }),
  toggleNotif:      () => set((s) => ({ isNotifOpen: !s.isNotifOpen })),
  closeNotif:       () => set({ isNotifOpen: false }),
}));
