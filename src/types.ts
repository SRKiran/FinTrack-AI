export type TransactionType = 'debit' | 'credit';
export type SourceType = 'sms' | 'email' | 'manual' | 'upi' | 'system';
export type ReminderType = 'credit_card' | 'loan' | 'utility' | 'other';
export type TabName = 'dashboard' | 'history' | 'analytics' | 'accounts' | 'profile';

export interface UserProfile {
  uid: string;
  name?: string;
  email: string;
  dob?: string;
  identification?: string;
  isPremium?: boolean;
  onboardingComplete: boolean;
  createdAt: string;
}

export interface Transaction {
  id?: string;
  userId: string;
  amount: number;
  type: TransactionType;
  date: any; // Firestore Timestamp
  description: string;
  category: string;
  source: SourceType;
  isInvestment: boolean;
  availableBalance?: number; // Parsed from message
  accountIdentifier?: string; // e.g., "XXXX345"
  accountName?: string; // e.g. "HDFC Bank"
  accountType?: 'asset' | 'liability';
  createdAt: any;
}

export interface Reminder {
  id?: string;
  userId: string;
  type: ReminderType;
  amount: number;
  dueDate: any;
  description: string;
  isPaid: boolean;
}

export interface SavingsGoal {
  id?: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: any;
}

export interface Account {
  id?: string;
  userId: string;
  name: string;
  type: 'asset' | 'liability';
  /** Optional: matches accountIdentifier on transactions to link SMS data to this account */
  identifier?: string;
  createdAt: any;
}