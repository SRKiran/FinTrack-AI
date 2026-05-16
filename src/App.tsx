/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  doc, 
  getDoc,
  serverTimestamp,
  orderBy,
  updateDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Wallet, 
  Plus, 
  History, 
  User as UserIcon, 
  Bell, 
  TrendingUp, 
  LogOut,
  CreditCard,
  Search,
  ChevronRight,
  DollarSign,
  PieChart as PieChartIcon,
  MessageSquare,
  ShieldCheck,
  Calendar,
  IndianRupee,
  Landmark,
  X,
  Lock,
  Paperclip,
  Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip,
  Legend
} from 'recharts';
import { format, differenceInDays } from 'date-fns';

import { auth, db } from './lib/firebase';
import { ai, PARSER_PROMPT, getParserPromptWithContext } from './lib/gemini';
import { UserProfile, Transaction, Reminder, SavingsGoal } from './types';
import { cn } from './lib/utils';

// Utility for Shadcn UI-like feel
function cnUtility(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // @ts-ignore - for debugging in AI Studio
  window.lastFirestoreError = errInfo;
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'analytics' | 'accounts' | 'profile'>('dashboard');
  
  const [filterAccount, setFilterAccount] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'smart' | 'manual'>('smart');
  const [scanText, setScanText] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const [manualForm, setManualForm] = useState({
    title: '', amount: '', type: 'debit' as 'debit' | 'credit', category: 'Shopping',
    accountIdentifier: '', balance: '', isInvestment: false, accountType: 'asset' as 'asset' | 'liability'
  });

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          // New user logic handled in onboarding
          setProfile(null);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Listen to Data
  useEffect(() => {
    if (!user) return;

    const qTx = query(
      collection(db, 'transactions'), 
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    const qRem = query(
      collection(db, 'reminders'),
      where('userId', '==', user.uid),
      where('isPaid', '==', false),
      orderBy('dueDate', 'asc')
    );
    const unsubRem = onSnapshot(qRem, (snapshot) => {
      setReminders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'reminders'));

    const qGoals = query(
      collection(db, 'goals'),
      where('userId', '==', user.uid)
    );
    const unsubGoals = onSnapshot(qGoals, (snapshot) => {
      setGoals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SavingsGoal)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'goals'));

    return () => {
      unsubTx();
      unsubRem();
      unsubGoals();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOnboarding = async (formData: Partial<UserProfile>) => {
    if (!user) return;
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      name: formData.name,
      dob: formData.dob,
      identification: formData.identification,
      onboardingComplete: true,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const saveProfile = async () => {
    if (!user || !profile) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: profile.name,
        identification: profile.identification
      });
      setIsEditingProfile(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleManualAdd = async () => {
    if (!user || !manualForm.title || !manualForm.amount) return;
    try {
      const tx: Omit<Transaction, 'id'> = {
        userId: user.uid,
        amount: Number(manualForm.amount),
        type: manualForm.type,
        date: Timestamp.now(),
        description: manualForm.title,
        category: manualForm.category,
        source: 'manual',
        isInvestment: manualForm.isInvestment,
        availableBalance: manualForm.balance ? Number(manualForm.balance) : undefined,
        accountIdentifier: manualForm.accountIdentifier || undefined,
        accountType: manualForm.accountIdentifier ? manualForm.accountType : undefined,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'transactions'), tx);
      setManualForm({
        title: '', amount: '', type: 'debit', category: 'Shopping',
        accountIdentifier: '', balance: '', isInvestment: false, accountType: 'asset'
      });
      setIsAddModalOpen(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'transactions');
    }
  };

  const parseMessage = async () => {
    if (!scanText.trim() || !user) return;
    setIsParsing(true);
    try {
      const prompt = getParserPromptWithContext(transactions);
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt + "\n\nMessage: " + scanText,
        config: {
          responseMimeType: "application/json",
        }
      });
      
      const text = result.text || "{}";
      const data = JSON.parse(text);

      if (data.rejected || data.isPersonalMessage) {
        setScanText('');
        setIsAddModalOpen(false);
        return;
      }

      // Calculate current net worth based on all existing transactions
      const currentNetWorth = transactions.reduce((acc, t) => {
        return acc + (t.type === 'credit' ? t.amount : -t.amount);
      }, 0);

      // Check for balance gap
      if (data.availableBalance !== null && data.availableBalance !== undefined) {
        if (transactions.length > 0) {
          const currentAmount = data.type === 'credit' ? data.amount : -data.amount;
          const expectedBalance = currentNetWorth + currentAmount;
          
          if (Math.abs(data.availableBalance - expectedBalance) > 0.1) {
            const gap = data.availableBalance - expectedBalance;
            const adjustmentTx: Omit<Transaction, 'id'> = {
              userId: user.uid,
              amount: Math.abs(gap),
              type: gap > 0 ? 'credit' : 'debit',
              date: Timestamp.fromMillis(Date.now() - 1000), // slightly before the actual transaction
              description: "Balance Adjustment (Auto-generated)",
              category: "Adjustment",
              source: 'system',
              isInvestment: false,
              rawMessage: `Auto-generated gap filler. Expected ${expectedBalance}, found ${data.availableBalance}`,
              availableBalance: currentNetWorth + gap, // This aligns us for the next actual transaction
              createdAt: serverTimestamp(),
            };
            try {
              await addDoc(collection(db, 'transactions'), adjustmentTx);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, 'transactions');
            }
          }
        } else {
          // This is the first transaction with a balance. 
          // We should add an "Opening Balance" adjustment to reconciliate.
          const currentAmount = data.type === 'credit' ? data.amount : -data.amount;
          const openingBalance = data.availableBalance - currentAmount;
          
          if (openingBalance !== 0) {
            const openingTx: Omit<Transaction, 'id'> = {
              userId: user.uid,
              amount: Math.abs(openingBalance),
              type: openingBalance > 0 ? 'credit' : 'debit',
              date: Timestamp.fromMillis(Date.now() - 2000),
              description: "Opening Balance",
              category: "Adjustment",
              source: 'system',
              isInvestment: false,
              availableBalance: openingBalance,
              createdAt: serverTimestamp(),
            };
            try {
              await addDoc(collection(db, 'transactions'), openingTx);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, 'transactions');
            }
          }
        }
      }

      const tx: Omit<Transaction, 'id'> = {
        userId: user.uid,
        amount: data.amount,
        type: data.type,
        date: Timestamp.now(),
        description: data.description,
        category: data.category,
        source: 'sms',
        isInvestment: data.isInvestment,
        availableBalance: data.availableBalance || undefined,
        accountIdentifier: data.accountIdentifier || undefined,
        accountType: data.accountType || undefined,
        rawMessage: scanText,
        createdAt: serverTimestamp(),
      };

      try {
        await addDoc(collection(db, 'transactions'), tx);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'transactions');
      }

      if (data.isCreditCardBill && data.dueDate) {
        try {
          await addDoc(collection(db, 'reminders'), {
            userId: user.uid,
            type: 'credit_card',
            amount: data.amount,
            dueDate: Timestamp.fromDate(new Date(data.dueDate)),
            description: `Credit Card Bill: ${data.description}`,
            isPaid: false,
            createdAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'reminders');
        }
      }

      setScanText('');
      setIsAddModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to parse message.");
    } finally {
      setIsParsing(false);
    }
  };

  const toggleReminder = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reminders', id), { isPaid: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reminders/${id}`);
    }
  };

  const totals = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      // Don't include system adjustments in the Income / Expenses stats tiles
      if (tx.source !== 'system') {
        if (tx.type === 'credit') acc.income += tx.amount;
        else if (tx.isInvestment) acc.investments += tx.amount;
        else acc.expenses += tx.amount;
      }
      return acc;
    }, { income: 0, expenses: 0, investments: 0 });
  }, [transactions]);

  const netWorth = useMemo(() => {
    // Net worth is exactly the sum of all transactions, including Opening Balances and Adjustments
    return transactions.reduce((acc, tx) => {
      return acc + (tx.type === 'credit' ? tx.amount : -tx.amount);
    }, 0);
  }, [transactions]);

  // Group transactions for History tab
  const groupedTransactions = useMemo(() => {
    let sorted = [...transactions].sort((a, b) => b.date.toMillis() - a.date.toMillis());
    if (filterAccount) {
      sorted = sorted.filter(tx => tx.accountIdentifier === filterAccount);
    }
    const groups: { [key: string]: Transaction[] } = {};
    
    sorted.forEach(tx => {
      const date = tx.date.toDate();
      const key = format(date, 'MMMM yyyy');
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    
    return Object.entries(groups).map(([month, txs]) => ({ month, txs }));
  }, [transactions, filterAccount]);

  const accountsList = useMemo(() => {
    const accs: Record<string, { identifier: string; type: 'asset' | 'liability'; balance: number; lastUpdate: any }> = {};
    const sorted = [...transactions].sort((a, b) => a.date.toMillis() - b.date.toMillis()); // older to newer
    
    sorted.forEach(tx => {
      if (tx.accountIdentifier && tx.accountType) {
        if (!accs[tx.accountIdentifier]) {
          accs[tx.accountIdentifier] = {
            identifier: tx.accountIdentifier,
            type: tx.accountType,
            balance: 0,
            lastUpdate: tx.date
          };
        }
        if (tx.availableBalance !== undefined) {
          accs[tx.accountIdentifier].balance = tx.availableBalance;
          accs[tx.accountIdentifier].lastUpdate = tx.date;
        }
      }
    });
    return Object.values(accs).sort((a, b) => b.balance - a.balance);
  }, [transactions]);

  const spendingCategories = useMemo(() => {
    const categories: Record<string, number> = {};
    transactions.forEach(tx => {
      // Only include actual expenses, not adjustments or investments
      if (tx.type === 'debit' && !tx.isInvestment && tx.source !== 'system') {
        categories[tx.category] = (categories[tx.category] || 0) + tx.amount;
      }
    });
    return Object.entries(categories)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#090D16]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-8 w-8 border-4 border-[#06B6D4] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  if (!profile || !profile.onboardingComplete) {
    return <OnboardingScreen onSubmit={handleOnboarding} />;
  }

  return (
    <div className="flex flex-col h-screen bg-[#090D16] max-w-md mx-auto relative overflow-hidden border-x border-[#1E293B] text-[#f8fafc]">
      {/* Top Header */}
      <header className="px-6 py-4 flex justify-between items-center bg-[#131B2E] border-b border-[#1E293B] shrink-0">
        <h1 className="text-xl font-bold font-sans tracking-tight text-[#06B6D4]">FinTrack<span className="text-[#f8fafc]">AI</span></h1>
        <button className="p-2 rounded-full hover:bg-[#1E293B]">
          <Bell className="w-5 h-5 text-[#94a3b8]" />
        </button>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-4"
            >
              {/* Balance Card */}
              <div className="bg-gradient-to-br from-[#131B2E] to-[#1e1b4b] rounded-[24px] p-5 text-[#f8fafc] shadow-lg border border-[#312e81]">
                <p className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1">Effective Balance</p>
                <h2 className="text-3xl font-bold flex items-center mb-6 text-[#f8fafc]">
                  <IndianRupee className="w-6 h-6 mr-1" />
                  {netWorth.toLocaleString()}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#1E293B]/50 rounded-[16px] p-3 backdrop-blur-sm border border-[#1E293B]">
                    <p className="text-[12px] font-semibold tracking-wider text-[#94a3b8] mb-1 uppercase">Income</p>
                    <p className="font-bold text-lg">₹{totals.income.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#1E293B]/50 rounded-[16px] p-3 backdrop-blur-sm border border-[#1E293B]">
                    <p className="text-[12px] font-semibold tracking-wider text-[#f43f5e] mb-1 uppercase">Expenses</p>
                    <p className="font-bold text-lg text-[#f43f5e]">₹{totals.expenses.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Reminders Section */}
              {reminders.length > 0 && (
                <div className="bg-[#131B2E] rounded-[24px] p-5 border border-[#1E293B]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8]">Pending Reminders</h3>
                    <ChevronRight className="w-4 h-4 text-[#64748b]" />
                  </div>
                  <div className="space-y-3">
                    {reminders.map(rem => (
                      <div key={rem.id} className="bg-[#1E293B] rounded-[16px] p-4 flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-[#F43F5E]/10 flex items-center justify-center mr-4">
                            <CreditCard className="w-5 h-5 text-[#F43F5E]" />
                          </div>
                          <div>
                            <p className="font-semibold text-[#f8fafc] text-sm">{rem.description}</p>
                            <p className="text-[11px] text-[#94a3b8] font-medium mt-0.5">Due in {differenceInDays(rem.dueDate.toDate(), new Date())} days</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => toggleReminder(rem.id!)}
                          className="text-[#f8fafc] text-xs font-bold px-3 py-1 bg-[#F43F5E] rounded-full hover:bg-[#dc2626] transition-colors"
                        >
                          ₹{rem.amount.toLocaleString()}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Savings Goals Grid */}
              <div className="bg-[#131B2E] rounded-[24px] p-5 border border-[#1E293B]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8]">Savings Goals</h3>
                </div>
                
                {goals.length > 0 ? goals.map(goal => {
                  const percent = Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100);
                  return (
                    <div key={goal.id} className="flex flex-col gap-2">
                       <div className="flex justify-between items-end">
                         <div className="font-bold text-2xl text-[#f8fafc]">{percent}%</div>
                         <div className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1 text-right">
                           {goal.name}
                           <br />
                           ₹{(goal.currentAmount / 100000).toFixed(1)}L / ₹{(goal.targetAmount / 100000).toFixed(1)}L
                         </div>
                       </div>
                       <div className="h-3 bg-[#1E293B] rounded-full overflow-hidden">
                         <div className="h-full bg-gradient-to-r from-[#06B6D4] to-[#818cf8]" style={{ width: `${percent}%` }}></div>
                       </div>
                    </div>
                  );
                }) : (
                  <div className="flex flex-col gap-2">
                       <div className="flex justify-between items-end">
                         <div className="font-bold text-2xl text-[#f8fafc]">64%</div>
                         <div className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1 text-right">
                           Tesla Model 3
                           <br />
                           ₹24L / ₹40L
                         </div>
                       </div>
                       <div className="h-3 bg-[#1E293B] rounded-full overflow-hidden">
                         <div className="h-full bg-gradient-to-r from-[#06B6D4] to-[#818cf8]" style={{ width: `64%` }}></div>
                       </div>
                    </div>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#131B2E] p-5 rounded-[24px] border border-[#1E293B] flex flex-col justify-between">
                  <div className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Investments</div>
                  <p className="font-bold text-xl text-[#f8fafc]">₹{totals.investments.toLocaleString()}</p>
                  <p className="text-[11px] text-[#10B981] mt-1 font-medium flex items-center">
                     <TrendingUp className="w-3 h-3 mr-1" />
                     Tracked
                  </p>
                </div>
                <div className="bg-[#131B2E] p-5 rounded-[24px] border border-[#1E293B] flex flex-col justify-between">
                  <div className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Net Worth</div>
                  <p className="font-bold text-xl text-[#f8fafc]">₹{(totals.income - totals.expenses + totals.investments).toLocaleString()}</p>
                  <p className="text-[11px] text-[#06B6D4] mt-1 font-medium flex items-center">
                     <Wallet className="w-3 h-3 mr-1" />
                     Calculated
                  </p>
                </div>
              </div>

              {/* Transactions Preview */}
              <div className="bg-[#131B2E] rounded-[24px] p-5 border border-[#1E293B]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8]">Recent Transactions</h3>
                  <button onClick={() => setActiveTab('history')} className="text-[#06B6D4] text-[11px] font-bold uppercase tracking-wider">View All</button>
                </div>
                <div className="space-y-4 mt-2">
                  {[...transactions].sort((a,b) => b.date.toMillis() - a.date.toMillis()).slice(0, 5).map((tx, idx) => (
                    <div key={tx.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={cnUtility(
                          "w-10 h-10 rounded-full flex items-center justify-center mr-4",
                          tx.type === 'credit' ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#1E293B] text-[#f8fafc]"
                        )}>
                          {tx.type === 'credit' ? <DollarSign className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-[#f8fafc] truncate max-w-[150px]">{tx.description}</p>
                          <p className="text-[11px] text-[#64748b]">{format(tx.date.toDate(), 'dd MMM, p')}</p>
                        </div>
                      </div>
                      <p className={cnUtility("font-bold text-sm", tx.type === 'credit' ? "text-[#10B981]" : "text-[#f8fafc]")}>
                        {tx.type === 'credit' ? '+' : '-'} ₹{tx.amount.toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="py-8 text-center text-[#64748b] text-sm">No transactions found</div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
               key="history"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="p-6 space-y-4 pb-32"
            >
              <div className="flex items-center bg-[#131B2E] rounded-[24px] px-5 py-3 border border-[#1E293B] mb-4">
                <Search className="w-5 h-5 text-[#64748b] mr-3" />
                <input type="text" placeholder="Search transactions..." className="bg-transparent border-none outline-none text-sm w-full text-[#f8fafc] placeholder-[#64748b]" />
              </div>

              {filterAccount && (
                <div className="flex items-center justify-between bg-[#06B6D4]/10 border border-[#06B6D4]/30 rounded-[16px] px-4 py-2 mb-4">
                  <span className="text-xs font-semibold text-[#06B6D4]">Filtering: {filterAccount}</span>
                  <button onClick={() => setFilterAccount(null)} className="p-1 hover:bg-[#06B6D4]/20 rounded-full">
                    <X className="w-4 h-4 text-[#06B6D4]" />
                  </button>
                </div>
              )}

              {groupedTransactions.map((group) => (
                <div key={group.month} className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b] px-2">{group.month}</h4>
                  <div className="space-y-2 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-[#1E293B] z-0" />
                    {group.txs.map((tx, idx) => (
                      <div key={tx.id} className={cnUtility(
                        "relative z-10 bg-transparent border-l-4 pl-4 py-3 pr-4 flex items-center justify-between",
                        tx.source === 'system' ? "border-[#8B5CF6]" : tx.type === 'credit' ? "border-[#10B981]" : "border-[#F43F5E]"
                      )}>
                        <div className="flex items-center">
                          <div className={cnUtility(
                            "w-10 h-10 rounded-full flex items-center justify-center mr-4",
                            tx.type === 'credit' ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#1E293B] text-[#f8fafc]"
                          )}>
                            {tx.type === 'credit' ? <DollarSign className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-[#f8fafc]">{tx.description}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <p className="text-[11px] text-[#94a3b8] capitalize">{tx.source} • {tx.category}</p>
                              {tx.accountIdentifier && (
                                <button 
                                  onClick={() => setFilterAccount(tx.accountIdentifier === filterAccount ? null : tx.accountIdentifier!)}
                                  className={cnUtility(
                                    "text-[9px] px-1.5 py-0.5 rounded-full transition-colors font-mono tracking-tight border",
                                    filterAccount === tx.accountIdentifier 
                                      ? "bg-[#06B6D4] border-[#06B6D4] text-[#090D16]" 
                                      : "bg-transparent border-[#1E293B] text-[#e2e8f0] hover:bg-[#1E293B]"
                                  )}
                                >
                                  {tx.accountIdentifier}
                                </button>
                              )}
                            </div>
                            {tx.availableBalance !== undefined && (
                              <p className="text-[9px] text-[#06B6D4] mt-1 font-mono">Bal: ₹{tx.availableBalance.toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cnUtility("font-bold text-sm", tx.type === 'credit' ? "text-[#10B981]" : "text-[#F43F5E]")}>
                            {tx.type === 'credit' ? '+' : '-'} ₹{tx.amount.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-[#64748b] font-mono mt-0.5">{format(tx.date.toDate(), 'dd MMM')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {transactions.length === 0 && (
                <div className="py-8 text-center text-[#64748b] text-sm">No transactions found</div>
              )}
            </motion.div>
          )}

          {activeTab === 'accounts' && (
            <motion.div 
               key="accounts"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="p-6 space-y-6 pb-32"
            >
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-4">Assets</h3>
                <div className="space-y-3">
                  {accountsList.filter(a => a.type === 'asset').map((acc, idx) => (
                    <div key={idx} className="bg-[#131B2E] rounded-[24px] p-5 border border-[#10B981]/20 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-[#10B981]/10 flex items-center justify-center mr-4">
                          <Landmark className="w-5 h-5 text-[#10B981]" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-[#f8fafc]">{acc.identifier}</p>
                          <p className="text-[11px] text-[#10B981] font-mono mt-0.5">Asset</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-[#f8fafc]">₹{acc.balance.toLocaleString()}</p>
                        <p className="text-[10px] text-[#64748b] font-mono mt-0.5">Updated {format(acc.lastUpdate.toDate(), 'dd MMM')}</p>
                      </div>
                    </div>
                  ))}
                  {accountsList.filter(a => a.type === 'asset').length === 0 && (
                    <p className="text-[#64748b] text-xs px-2">No asset accounts parsed yet.</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-4">Liabilities</h3>
                <div className="space-y-3">
                  {accountsList.filter(a => a.type === 'liability').map((acc, idx) => (
                    <div key={idx} className="bg-[#131B2E] rounded-[24px] p-5 border border-[#F43F5E]/20 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-[#F43F5E]/10 flex items-center justify-center mr-4">
                          <CreditCard className="w-5 h-5 text-[#F43F5E]" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-[#f8fafc]">{acc.identifier}</p>
                          <p className="text-[11px] text-[#F43F5E] font-mono mt-0.5">Liability</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-[#f8fafc]">₹{acc.balance.toLocaleString()}</p>
                        <p className="text-[10px] text-[#64748b] font-mono mt-0.5">Updated {format(acc.lastUpdate.toDate(), 'dd MMM')}</p>
                      </div>
                    </div>
                  ))}
                  {accountsList.filter(a => a.type === 'liability').length === 0 && (
                    <p className="text-[#64748b] text-xs px-2">No liability accounts parsed yet.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
             <motion.div 
              key="analytics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 space-y-4"
           >
             <div className="bg-[#131B2E] p-5 rounded-[24px] border border-[#1E293B]">
               <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-4">Spending by Category</h3>
               <div className="h-64 h-full">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={Object.entries(transactions.reduce((acc, tx) => {
                        if (tx.type === 'debit') acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
                        return acc;
                      }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }))}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {transactions.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#06B6D4', '#10B981', '#fbbf24', '#F43F5E', '#a855f7'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#131B2E', borderColor: '#1E293B', color: '#f8fafc', borderRadius: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                  </PieChart>
                </ResponsiveContainer>
               </div>
             </div>

             <div className="bg-[#131B2E] p-5 rounded-[24px] border border-[#1E293B]">
               <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-4">Top Spending Categories</h3>
               <div className="space-y-4">
                 {spendingCategories.length > 0 ? spendingCategories.slice(0, 5).map((cat, idx) => (
                   <div key={idx} className="flex flex-col gap-1.5">
                     <div className="flex justify-between text-sm">
                       <span className="font-semibold text-[#f8fafc]">{cat.name}</span>
                       <span className="font-bold text-[#F43F5E]">₹{cat.amount.toLocaleString()}</span>
                     </div>
                     <div className="h-2 bg-[#1E293B] rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-gradient-to-r from-[#F43F5E] to-[#f43f5e]" 
                         style={{ width: `${Math.min((cat.amount / totals.expenses) * 100, 100)}%` }} 
                       />
                     </div>
                   </div>
                 )) : (
                   <p className="text-[#64748b] text-xs">No tracked expenses yet.</p>
                 )}
               </div>
             </div>
           </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 space-y-6"
            >
              <div className="flex flex-col items-center py-8 relative">
                <div className="w-24 h-24 rounded-full bg-[#1E293B] flex items-center justify-center mb-4 ring-4 ring-[#131B2E] overflow-hidden border border-[#1E293B]">
                  {user?.photoURL ? <img src={user.photoURL} alt="avatar" /> : <UserIcon className="w-12 h-12 text-[#64748b]" />}
                </div>
                {isEditingProfile ? (
                  <div className="flex flex-col items-center gap-2 w-full px-8">
                    <input type="text" value={profile.name || ''} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full text-center p-2 bg-[#131B2E] border border-[#1E293B] rounded-[12px] outline-none text-[#f8fafc]" placeholder="Full Name" />
                    <input type="text" value={profile.identification || ''} onChange={e => setProfile({...profile, identification: e.target.value})} className="w-full text-center p-2 bg-[#131B2E] border border-[#1E293B] rounded-[12px] outline-none text-[#f8fafc] text-sm" placeholder="ID Info" />
                    <button onClick={saveProfile} className="mt-2 text-xs font-bold px-4 py-2 bg-[#06B6D4] text-[#090D16] rounded-full">Save Changes</button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-[#f8fafc] flex items-center gap-2">
                       {profile.name || user.displayName}
                       <button onClick={() => setIsEditingProfile(true)} className="text-[#06B6D4] text-[10px] uppercase font-bold tracking-wider hover:underline">Edit</button>
                    </h2>
                    <p className="text-[#94a3b8] text-sm mt-1">{user.email}</p>
                  </>
                )}
              </div>

              {!isEditingProfile && (
                <div className="space-y-3">
                  <div className="bg-[#131B2E] p-4 rounded-[24px] border border-[#1E293B] flex items-center justify-between">
                    <div className="flex items-center">
                      <ShieldCheck className="w-5 h-5 text-[#06B6D4] mr-3" />
                      <span className="text-sm font-medium text-[#f8fafc]">Privacy & Security</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#64748b]" />
                  </div>
                  <div className="bg-[#131B2E] p-4 rounded-[24px] border border-[#1E293B] flex items-center justify-between">
                    <div className="flex items-center">
                      <Calendar className="w-5 h-5 text-[#06B6D4] mr-3" />
                      <span className="text-sm font-medium text-[#f8fafc]">ID Info: {profile.identification || 'Not set'}</span>
                    </div>
                  </div>
                  
                  <div className="bg-[#131B2E] p-4 rounded-[24px] border border-[#f59e0b]/30 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Crown className="w-5 h-5 text-[#f59e0b] mr-3" />
                        <span className="text-sm font-medium text-[#f8fafc]">Premium Features</span>
                      </div>
                      <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input 
                          type="checkbox" 
                          name="toggle" 
                          id="premiumToggle" 
                          checked={profile.isPremium || false}
                          onChange={async (e) => {
                            const newPremium = e.target.checked;
                            setProfile({...profile, isPremium: newPremium});
                            await updateDoc(doc(db, 'users', user.uid), { isPremium: newPremium });
                          }}
                          className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer"
                        />
                        <label htmlFor="premiumToggle" className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer"></label>
                      </div>
                    </div>
                    <p className="text-xs text-[#94a3b8] leading-relaxed">Unlock Smart AI attachment parsing, automated PDF statement reading, and unlimited syncing. (Toggle for Dev Testing)</p>
                  </div>
                </div>
              )}

              <div className="pt-4">
                <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">Integrations & Plugins</h3>
                <div className="space-y-3">
                  <div className="bg-[#131B2E] p-4 rounded-[24px] border border-[#10B981]/30 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-[#10B981]/10 flex items-center justify-center mr-3">
                          <IndianRupee className="w-4 h-4 text-[#10B981]" />
                        </div>
                        <span className="text-sm font-bold text-[#f8fafc]">India Account Aggregator</span>
                      </div>
                      <span className="px-2 py-1 bg-[#10B981]/20 text-[#10B981] text-[10px] uppercase font-bold rounded-full tracking-wider">Connected</span>
                    </div>
                    <p className="text-xs text-[#94a3b8] leading-relaxed">PAN verified. Automatically syncs bank and mutual fund statements via Sahamati framework.</p>
                  </div>

                  <div className="bg-[#131B2E] p-4 rounded-[24px] border border-[#1E293B] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-[#1E293B] flex items-center justify-center mr-3">
                          <MessageSquare className="w-4 h-4 text-[#f8fafc]" />
                        </div>
                        <span className="text-sm font-bold text-[#f8fafc]">Gmail Integration</span>
                      </div>
                      <button className="text-[#06B6D4] text-xs font-bold px-3 py-1 bg-[#06B6D4]/10 rounded-full hover:bg-[#06B6D4]/20 transition-colors">
                        Connect
                      </button>
                    </div>
                    <p className="text-xs text-[#64748b] leading-relaxed">Plug in your Gmail to auto-parse credit card statements and bills using AI.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">AI Pro Tips</h3>
                <div className="bg-[#131B2E] p-4 rounded-[24px] border border-[#1E293B]">
                  <p className="text-sm text-[#f8fafc] mb-2 font-semibold">Automate Your Tracking</p>
                  <ul className="list-disc pl-4 text-xs text-[#94a3b8] space-y-1">
                    <li>Forward your bank statement PDFs to <span className="font-mono text-[#06B6D4]">fintrack@ai.local</span> for parsing.</li>
                    <li>Connect the Account Aggregator plugin to auto-sync mutual funds and stocks securely.</li>
                    <li>Use the "Scan with AI" button on any unstructured financial SMS to instantly categorize the expense.</li>
                    <li>Don't worry about missing small cash expenses; our AI detects balance gaps and creates auto-adjustments for you.</li>
                    <li>Your net worth is perfectly synced! Our engine auto-reconciles skipped transactions using 'Balance Adjustments' to maintain ground truth.</li>
                  </ul>
                </div>
              </div>

              <button 
                onClick={() => signOut(auth)}
                className="w-full py-4 bg-[#F43F5E]/10 text-[#F43F5E] rounded-[24px] font-bold text-sm flex items-center justify-center hover:bg-[#F43F5E]/20 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout Sessions
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FAB - Add Transaction */}
      <button 
        onClick={() => setIsAddModalOpen(true)}
        className="absolute bottom-28 right-6 w-14 h-14 bg-[#06B6D4] rounded-full flex items-center justify-center text-[#090D16] shadow-xl shadow-[#06B6D4]/20 z-40 active:scale-95 transition-transform"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#090D16] backdrop-blur-xl border-t border-[#1E293B] px-4 py-4 flex justify-between items-center z-50 overflow-x-auto">
        <NavButton active={activeTab === 'dashboard'} icon={LayoutDashboard} label="Home" onClick={() => setActiveTab('dashboard')} />
        <NavButton active={activeTab === 'history'} icon={History} label="History" onClick={() => setActiveTab('history')} />
        <NavButton active={activeTab === 'accounts'} icon={Landmark} label="Accounts" onClick={() => setActiveTab('accounts')} />
        <NavButton active={activeTab === 'analytics'} icon={PieChartIcon} label="Stats" onClick={() => setActiveTab('analytics')} />
        <NavButton active={activeTab === 'profile'} icon={UserIcon} label="Me" onClick={() => setActiveTab('profile')} />
      </nav>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-0 bg-black/60 backdrop-blur-md"
            onClick={() => setIsAddModalOpen(false)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="border border-[#1E293B] border-b-0 w-full max-w-md rounded-t-[40px] p-8 shadow-2xl relative overflow-hidden"
              style={{
                backgroundColor: '#131B2E',
                backgroundImage: addMode === 'smart' ? 'radial-gradient(circle at 50% 0%, rgba(139,92,246,0.15) 0%, transparent 70%)' : 'none'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-[#1E293B] rounded-full mx-auto mb-8" />
              
              <div className="flex bg-[#1E293B] p-1 rounded-full mb-6 relative">
                <button 
                  onClick={() => setAddMode('smart')}
                  className={cnUtility("flex-1 py-2 text-sm font-bold rounded-full z-10 transition-colors", addMode === 'smart' ? "text-[#090D16]" : "text-[#94a3b8]")}
                >
                  Smart AI
                </button>
                <button 
                  onClick={() => setAddMode('manual')}
                  className={cnUtility("flex-1 py-2 text-sm font-bold rounded-full z-10 transition-colors", addMode === 'manual' ? "text-[#090D16]" : "text-[#94a3b8]")}
                >
                  Manual
                </button>
                <motion.div 
                  initial={false}
                  animate={{ left: addMode === 'smart' ? '0.25rem' : '50%', width: 'calc(50% - 0.25rem)' }}
                  className={cnUtility("absolute top-1 bottom-1 rounded-full z-0", addMode === 'smart' ? "bg-[#8B5CF6]" : "bg-[#06B6D4]")}
                />
              </div>

              {addMode === 'smart' ? (
                <>
                  <h3 className="text-2xl font-bold text-[#f8fafc] mb-2">Smart Sync</h3>
                  <p className="text-[#94a3b8] text-sm mb-6">Paste your SMS or bank message here. FinTrack AI will automatically categorize it for you.</p>
                  
                  <div className="relative group mb-6">
                    <textarea 
                      value={scanText}
                      onChange={(e) => setScanText(e.target.value)}
                      placeholder="e.g. HDFC Bank: Rs 500 debited for Zomato on 07-May..."
                      className="w-full h-40 p-4 bg-[#090D16] border border-[#1E293B] text-[#f8fafc] placeholder-[#64748b] rounded-[24px] outline-none focus:ring-2 focus:ring-[#8B5CF6] transition-all text-sm resize-none"
                    />
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <div className="relative group/tooltip">
                        <input 
                          type="file" 
                          id="file-upload" 
                          className="hidden" 
                          disabled={!profile?.isPremium} 
                          title=""
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              alert(`Attachment ${e.target.files[0].name} selected.\n(Backend PDF/Excel parsing simulation)`);
                            }
                          }}
                        />
                        <label 
                          htmlFor={profile?.isPremium ? "file-upload" : undefined}
                          onClick={() => {
                            if (!profile?.isPremium) alert("Attachment reading is a Premium feature. Enable it in the Me tab.");
                          }}
                          className={cnUtility(
                            "cursor-pointer flex items-center justify-center w-8 h-8 rounded-full transition-colors",
                            profile?.isPremium ? "bg-[#8B5CF6]/20 text-[#8B5CF6] hover:bg-[#8B5CF6]/30" : "bg-[#1E293B] text-[#64748b]"
                          )}
                        >
                          {!profile?.isPremium ? <Lock className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
                        </label>
                      </div>
                      <div className="text-[#8B5CF6] opacity-20">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        if (!profile?.isPremium) {
                          alert("Smart Sync AI is a Premium feature. Unlock it in the Me tab.");
                          return;
                        }
                        parseMessage();
                      }}
                      disabled={isParsing || !scanText && profile?.isPremium}
                      className={cnUtility(
                        "flex-1 py-4 rounded-[24px] font-bold flex items-center justify-center transition-all",
                        isParsing || !scanText ? "bg-[#1E293B] text-[#64748b]" : "bg-[#8B5CF6] text-[#090D16] shadow-xl shadow-[#8B5CF6]/20",
                        !profile?.isPremium && "bg-[#1E293B] text-[#f59e0b] bg-opacity-50"
                      )}
                    >
                      {!profile?.isPremium ? (
                        <>
                           <Lock className="w-5 h-5 mr-2" />
                           Unlock Smart AI
                        </>
                      ) : isParsing ? (
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          className="h-5 w-5 border-2 border-[#090D16] border-t-transparent rounded-full"
                        />
                      ) : (
                        <>Scan with AI</>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto hide-scrollbar pb-8">
                  <h3 className="text-2xl font-bold text-[#f8fafc] mb-4">Manual Entry</h3>
                  <input type="text" placeholder="Title/Description" value={manualForm.title} onChange={e => setManualForm({...manualForm, title: e.target.value})} className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4]" />
                  <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Amount (₹)" value={manualForm.amount} onChange={e => setManualForm({...manualForm, amount: e.target.value})} className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4]" />
                    <select value={manualForm.type} onChange={e => setManualForm({...manualForm, type: e.target.value as 'debit'|'credit'})} className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4]">
                      <option value="debit">Expense</option>
                      <option value="credit">Income</option>
                    </select>
                  </div>
                  <input type="text" placeholder="Category (e.g. Shopping, Salary)" value={manualForm.category} onChange={e => setManualForm({...manualForm, category: e.target.value})} className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4]" />
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Account (e.g. HDFC 1234)" value={manualForm.accountIdentifier} onChange={e => setManualForm({...manualForm, accountIdentifier: e.target.value})} className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4]" />
                    <select value={manualForm.accountType} onChange={e => setManualForm({...manualForm, accountType: e.target.value as 'asset'|'liability'})} className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4]">
                      <option value="asset">Asset (Bank)</option>
                      <option value="liability">Liability (Loan/CC)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <input type="checkbox" id="isInv" checked={manualForm.isInvestment} onChange={e => setManualForm({...manualForm, isInvestment: e.target.checked})} className="w-4 h-4 bg-[#090D16] border-[#1E293B] rounded" />
                    <label htmlFor="isInv" className="text-sm text-[#94a3b8]">Mark as Investment</label>
                  </div>
                  <input type="number" placeholder="New Account Balance (Optional)" value={manualForm.balance} onChange={e => setManualForm({...manualForm, balance: e.target.value})} className="w-full p-4 bg-[#090D16] border border-[#1E293B] rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-[#06B6D4]" />
                  
                  <button 
                    onClick={handleManualAdd}
                    disabled={!manualForm.title || !manualForm.amount}
                    className={cnUtility(
                      "w-full py-4 rounded-[24px] font-bold flex items-center justify-center transition-all mt-4",
                      (!manualForm.title || !manualForm.amount) ? "bg-[#1E293B] text-[#64748b]" : "bg-[#06B6D4] text-[#090D16] shadow-xl shadow-[#06B6D4]/20"
                    )}
                  >
                    Save Transaction
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ active, icon: Icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cnUtility(
        "flex flex-col items-center gap-1 transition-colors relative",
        active ? "text-[#06B6D4]" : "text-[#64748b] hover:text-[#94a3b8]"
      )}
    >
      <Icon className={cnUtility("w-6 h-6", active && "animate-pulse")} />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-[#06B6D4] rounded-full absolute -top-3" />}
    </button>
  );
}

function AuthScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#090D16] p-8 max-w-md mx-auto text-[#f8fafc]">
      <div className="mb-12 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-[#131B2E] to-[#1e1b4b] border border-[#312e81] rounded-[24px] mx-auto mb-6 flex items-center justify-center shadow-xl shadow-blue-900/20 rotate-12">
          <Wallet className="w-10 h-10 text-[#06B6D4] -rotate-12" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-[#f8fafc] mb-3">FinTrack AI</h1>
        <p className="text-[#94a3b8] max-w-[250px] mx-auto text-sm leading-relaxed">
          The smartest way to track your expenses and grow your net worth.
        </p>
      </div>
      
      <button 
        onClick={onLogin}
        className="w-full flex items-center justify-center gap-3 bg-[#131B2E] border border-[#1E293B] py-4 px-6 rounded-[24px] font-bold text-[#f8fafc] hover:bg-[#1E293B] transition-colors shadow-sm"
      >
        <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="google" />
        Continue with Google
      </button>
      
      <p className="mt-8 text-xs text-[#64748b]">By continuing, you agree to our terms of service.</p>
    </div>
  );
}

function OnboardingScreen({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: '', dob: '', identification: '' });

  const next = () => {
    if (step === 3) onSubmit(formData);
    else setStep(step + 1);
  };

  return (
    <div className="flex h-screen flex-col bg-[#090D16] p-8 max-w-md mx-auto text-[#f8fafc]">
      <div className="flex gap-2 mb-12">
        {[1, 2, 3].map(i => (
          <div key={i} className={cnUtility("h-1.5 flex-1 rounded-full", i <= step ? "bg-[#06B6D4]" : "bg-[#1E293B]")} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex-1"
        >
          {step === 1 && (
            <div>
              <h2 className="text-3xl font-extrabold text-[#f8fafc] mb-4">What's your name?</h2>
              <p className="text-[#94a3b8] mb-8">We'll use this to personalize your dashboard.</p>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-4 bg-[#131B2E] border border-[#1E293B] rounded-[24px] outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b]"
                placeholder="Full Name"
              />
            </div>
          )}
          {step === 2 && (
            <div>
              <h2 className="text-3xl font-extrabold text-[#f8fafc] mb-4">Almost there.</h2>
              <p className="text-[#94a3b8] mb-8">We need a few more details for verification.</p>
              <div className="space-y-4">
                <input 
                  type="date" 
                  value={formData.dob}
                  onChange={e => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full p-4 bg-[#131B2E] border border-[#1E293B] rounded-[24px] outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc]"
                  style={{ colorScheme: 'dark' }}
                />
                <input 
                  type="text" 
                  value={formData.identification}
                  onChange={e => setFormData({ ...formData, identification: e.target.value })}
                  className="w-full p-4 bg-[#131B2E] border border-[#1E293B] rounded-[24px] outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b]"
                  placeholder="ID Number (e.g. PAN/SSN)"
                />
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="text-center">
              <div className="w-20 h-20 bg-[#131B2E] border border-[#1E293B] rounded-full flex items-center justify-center mx-auto mb-8">
                <ShieldCheck className="w-10 h-10 text-[#06B6D4]" />
              </div>
              <h2 className="text-3xl font-extrabold text-[#f8fafc] mb-4">Consent Request</h2>
              <p className="text-[#94a3b8] mb-8 leading-relaxed">
                FinTrack AI needs permission to process your financial messages to build your dashboard. 
                Your data is encrypted and never shared with 3rd parties.
              </p>
              <div className="bg-[#1E293B] p-6 rounded-[24px] text-left border border-[#1E293B]">
                <p className="text-xs text-[#06B6D4] font-medium">I agree to allow FinTrack AI to parse my transaction SMS and Email data for personal financial management.</p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <button 
        onClick={next}
        className="w-full py-5 bg-[#06B6D4] text-[#090D16] rounded-[24px] font-bold shadow-xl shadow-[#06B6D4]/20 mt-8"
      >
        {step === 3 ? "Complete Signup" : "Next"}
      </button>
    </div>
  );
}
