/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import {
  onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider, User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  LayoutDashboard, History, PieChart as PieChartIcon,
  Landmark, User as UserIcon, Plus, Bell,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { auth, db } from './lib/firebase';
import { UserProfile, TabName } from './types';
import { useTransactions } from './hooks/useTransactions';
import { useReminders } from './hooks/useReminders';
import { useGoals } from './hooks/useGoals';
import { useUIStore } from './store/uiStore';
import { useProfileStore } from './store/profileStore';
import NavButton from './components/NavButton';
import AuthScreen from './components/AuthScreen';
import OnboardingScreen from './components/OnboardingScreen';
import AddTransactionModal from './components/AddTransactionModal';
import AddGoalModal from './components/AddGoalModal';
import AddReminderModal from './components/AddReminderModal';
import NotificationPanel from './components/NotificationPanel';

// Lazy-load tabs for code splitting
const DashboardTab  = lazy(() => import('./tabs/DashboardTab'));
const HistoryTab    = lazy(() => import('./tabs/HistoryTab'));
const AnalyticsTab  = lazy(() => import('./tabs/AnalyticsTab'));
const AccountsTab   = lazy(() => import('./tabs/AccountsTab'));
const ProfileTab    = lazy(() => import('./tabs/ProfileTab'));

const TabFallback = () => (
  <div className="flex items-center justify-center py-24">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
      className="h-7 w-7 border-4 border-[#06B6D4] border-t-transparent rounded-full"
    />
  </div>
);

export default function App() {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Global stores — no prop drilling for UI state or profile
  const { profile, setProfile, patchProfile } = useProfileStore();
  const {
    activeTab, setActiveTab,
    filterAccount, setFilterAccount,
    isAddTxOpen, closeAddTx,
    isGoalOpen,  closeGoal,
    isReminderOpen, closeReminder,
    isNotifOpen, toggleNotif, closeNotif,
    openAddTx, openGoal, openReminder,
  } = useUIStore();

  const { transactions, loadingMore, hasMore, loadMore } = useTransactions(user?.uid ?? null);
  const { reminders, toggleReminder, addReminder }       = useReminders(user?.uid ?? null);
  const { goals, addGoal }                               = useGoals(user?.uid ?? null);

  const totals = useMemo(() => transactions.reduce(
    (acc, tx) => {
      if (tx.source === 'system') return acc;
      if (tx.type === 'credit')       acc.income      += tx.amount;
      else if (tx.isInvestment)       acc.investments += tx.amount;
      else                            acc.expenses    += tx.amount;
      return acc;
    },
    { income: 0, expenses: 0, investments: 0 }
  ), [transactions]);

  const netWorth = useMemo(() =>
    transactions.reduce((sum, tx) => sum + (tx.type === 'credit' ? tx.amount : -tx.amount), 0),
  [transactions]);

  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        useProfileStore.getState().setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
      } else {
        useProfileStore.getState().setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { console.error(e); }
  };

  const handleSignOut = () => signOut(auth);

  const handleOnboarding = async (formData: Partial<UserProfile>) => {
    if (!user) return;
    const newProfile: UserProfile = {
      uid:                user.uid,
      email:              user.email ?? '',
      name:               formData.name,
      dob:                formData.dob,
      identification:     formData.identification,
      onboardingComplete: true,
      createdAt:          new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', user.uid), newProfile);
    setProfile(newProfile);
  };

  const handleProfileUpdate = async (patch: Partial<UserProfile>) => {
    if (!user || !profile) return;
    await updateDoc(doc(db, 'users', user.uid), patch as Record<string, unknown>);
    patchProfile(patch);
  };

  const handleAccountsNavigate = (tab: TabName, filter: string) => {
    setFilterAccount(filter || null);
    setActiveTab(tab);
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#090D16]">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="h-8 w-8 border-4 border-[#06B6D4] border-t-transparent rounded-full"
      />
    </div>
  );

  if (!user)                              return <AuthScreen onLogin={handleLogin} />;
  if (!profile || !profile.onboardingComplete)
    return <OnboardingScreen onSubmit={handleOnboarding} />;

  return (
    <div className="flex flex-col h-screen bg-[#090D16] max-w-md mx-auto relative overflow-hidden border-x border-[#1E293B] text-[#f8fafc]">

      <header className="px-6 py-4 flex justify-between items-center bg-[#131B2E] border-b border-[#1E293B] shrink-0 relative z-50">
        <h1 className="text-xl font-bold tracking-tight text-[#06B6D4]">
          Kanaka<span className="text-[#f8fafc]">Fin</span>
        </h1>
        <button
          onClick={toggleNotif}
          className="relative p-2 rounded-full hover:bg-[#1E293B] transition-colors"
        >
          <Bell className="w-5 h-5 text-[#94a3b8]" />
          {reminders.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#F43F5E] rounded-full" />
          )}
        </button>
      </header>

      <NotificationPanel
        isOpen={isNotifOpen}
        onClose={closeNotif}
        reminders={reminders}
        onMarkPaid={toggleReminder}
        onAddReminder={() => { openReminder(); closeNotif(); }}
      />

      <main className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'dashboard' && (
              <DashboardTab
                key="dashboard"
                transactions={transactions}
                reminders={reminders}
                goals={goals}
                totals={totals}
                netWorth={netWorth}
                onReminderPaid={toggleReminder}
                onNavigate={tab => setActiveTab(tab)}
                onAddGoal={openGoal}
                onAddReminder={openReminder}
              />
            )}
            {activeTab === 'history' && (
              <HistoryTab
                key="history"
                transactions={transactions}
                filterAccount={filterAccount}
                onSetFilterAccount={setFilterAccount}
                loadingMore={loadingMore}
                hasMore={hasMore}
                onLoadMore={loadMore}
              />
            )}
            {activeTab === 'analytics' && (
              <AnalyticsTab
                key="analytics"
                transactions={transactions}
                totals={totals}
              />
            )}
            {activeTab === 'accounts' && (
              <AccountsTab
                key="accounts"
                transactions={transactions}
                onNavigate={handleAccountsNavigate}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileTab
                key="profile"
                user={user}
                profile={profile}
                onProfileUpdate={handleProfileUpdate}
                onSignOut={handleSignOut}
              />
            )}
          </Suspense>
        </AnimatePresence>
      </main>

      <button
        onClick={openAddTx}
        className="absolute bottom-28 right-6 w-14 h-14 bg-[#06B6D4] rounded-full flex items-center justify-center text-[#090D16] shadow-xl shadow-[#06B6D4]/20 z-40 active:scale-95 transition-transform"
      >
        <Plus className="w-7 h-7" />
      </button>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#090D16] border-t border-[#1E293B] px-4 py-4 flex justify-between items-center z-50">
        <NavButton active={activeTab === 'dashboard'} icon={LayoutDashboard} label="Home"     onClick={() => setActiveTab('dashboard')} />
        <NavButton active={activeTab === 'history'}   icon={History}         label="History"  onClick={() => setActiveTab('history')} />
        <NavButton active={activeTab === 'accounts'}  icon={Landmark}        label="Accounts" onClick={() => setActiveTab('accounts')} />
        <NavButton active={activeTab === 'analytics'} icon={PieChartIcon}    label="Stats"    onClick={() => setActiveTab('analytics')} />
        <NavButton active={activeTab === 'profile'}   icon={UserIcon}        label="Me"       onClick={() => setActiveTab('profile')} />
      </nav>

      <AddTransactionModal
        isOpen={isAddTxOpen}
        onClose={closeAddTx}
        userId={user.uid}
        profile={profile}
        transactions={transactions}
      />
      <AddGoalModal
        isOpen={isGoalOpen}
        onClose={closeGoal}
        onAdd={async (data) => { await addGoal(data); }}
      />
      <AddReminderModal
        isOpen={isReminderOpen}
        onClose={closeReminder}
        onAdd={async (data) => { await addReminder(data); }}
      />
    </div>
  );
}
