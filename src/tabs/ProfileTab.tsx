import React, { memo } from 'react';
import { motion } from 'motion/react';
import { User, LogOut, Star, Shield, RefreshCw } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

interface ProfileTabProps {
  user:            { uid: string; photoURL?: string | null; email?: string | null; displayName?: string | null };
  profile:         UserProfile | null;
  onProfileUpdate: (patch: Partial<UserProfile>) => Promise<void>;
  onSignOut:       () => void;
}

const ProfileTab = memo(function ProfileTab({ user, profile, onProfileUpdate, onSignOut }: ProfileTabProps) {
  const togglePremium = async () => {
    if (!profile) return;
    await onProfileUpdate({ isPremium: !profile.isPremium });
  };

  return (
    <motion.div
      key="profile"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-5 pb-32"
    >
      {/* ── Avatar block ── */}
      <div className="bg-[#131B2E] rounded-[24px] p-5 border border-[#1E293B] flex items-center gap-4">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-full object-cover border-2 border-[#06B6D4]"
            alt="avatar"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[#1E293B] flex items-center justify-center border-2 border-[#1E293B]">
            <User className="w-7 h-7 text-[#64748b]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-xl text-[#f8fafc] truncate">{profile?.name ?? user.displayName ?? 'User'}</h3>
          <p className="text-[12px] text-[#64748b] truncate">{user.email}</p>
          {profile?.isPremium && (
            <span className="inline-flex items-center gap-1 mt-1 bg-[#fbbf24]/10 border border-[#fbbf24]/30 text-[#fbbf24] text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
              <Star className="w-2.5 h-2.5" /> Premium
            </span>
          )}
        </div>
      </div>

      {/* ── KYC details ── */}
      <div className="bg-[#131B2E] rounded-[24px] p-5 border border-[#1E293B] space-y-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8]">
          Account Info
        </h3>
        {[
          { label: 'Name',  value: profile?.name        ?? '—' },
          { label: 'Email', value: profile?.email        ?? user.email ?? '—' },
          { label: 'DOB',   value: profile?.dob          ?? '—' },
          { label: 'PAN',   value: profile?.identification
            ? profile.identification.slice(0, -4).replace(/./g, '•') + profile.identification.slice(-4)
            : '—' },
        ].map(item => (
          <div key={item.label} className="flex justify-between items-center py-2 border-b border-[#1E293B] last:border-0">
            <span className="text-xs text-[#64748b]">{item.label}</span>
            <span className="text-xs font-semibold text-[#f8fafc] font-mono">{item.value}</span>
          </div>
        ))}
      </div>

      {/* ── Premium toggle ── */}
      <button
        onClick={togglePremium}
        className={cn(
          'w-full rounded-[24px] p-5 border flex items-center justify-between transition-all',
          profile?.isPremium
            ? 'bg-[#fbbf24]/10 border-[#fbbf24]/40 hover:bg-[#fbbf24]/15'
            : 'bg-[#131B2E] border-[#1E293B] hover:border-[#fbbf24]/30'
        )}
      >
        <div className="flex items-center gap-3">
          <Star className={cn('w-5 h-5', profile?.isPremium ? 'text-[#fbbf24]' : 'text-[#64748b]')} />
          <div className="text-left">
            <p className={cn('font-bold text-sm', profile?.isPremium ? 'text-[#fbbf24]' : 'text-[#f8fafc]')}>
              Premium Plan
            </p>
            <p className="text-[11px] text-[#64748b]">
              {profile?.isPremium ? 'Active — tap to disable (testing)' : 'Unlock advanced analytics'}
            </p>
          </div>
        </div>
        <div className={cn(
          'w-11 h-6 rounded-full flex items-center transition-all px-0.5',
          profile?.isPremium ? 'bg-[#fbbf24] justify-end' : 'bg-[#1E293B] justify-start'
        )}>
          <div className="w-5 h-5 bg-white rounded-full shadow-sm" />
        </div>
      </button>

      {/* ── Integrations ── */}
      <div className="bg-[#131B2E] rounded-[24px] p-5 border border-[#1E293B] space-y-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-widest text-[#94a3b8]">
          Integrations
        </h3>

        {/* ── SMS Parsing — always free/local ── */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#10B981]" />
            <div>
              <p className="text-sm font-semibold text-[#f8fafc]">SMS / Manual Entry</p>
              <p className="text-[11px] text-[#64748b]">On-device parsing via Gemini AI</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full">Active</span>
        </div>

        {/*
          PRODUCTION_COST_FEATURE: Account Aggregator (Setu AA)
          Cost: ₹2–8 per consent (one-time) + ₹0.5–2 per data fetch.
          Enables auto bank statement sync without manual SMS entry.

          To enable:
            1. Register at https://bridge.setu.co → get API keys
            2. Set env vars: VITE_SETU_API_TOKEN, VITE_SETU_CLIENT_ID, VITE_SETU_PRODUCT_INSTANCE_ID
            3. Uncomment the block below

          const handleAAConnect = async () => {
            // Initiate Account Aggregator consent journey
            const res = await fetch('https://fiu-sandbox.setu.co/sessions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-client-id': import.meta.env.VITE_SETU_CLIENT_ID,
                'x-client-secret': import.meta.env.VITE_SETU_API_TOKEN,
                'x-product-instance-id': import.meta.env.VITE_SETU_PRODUCT_INSTANCE_ID,
              },
              body: JSON.stringify({
                flowType: 'REDIRECT',
                redirectUrl: window.location.origin + '/aa-callback',
              }),
            });
            const { redirectionUrl } = await res.json();
            window.location.href = redirectionUrl; // User completes consent on AA screen
          };
        */}
        <div className="flex items-center justify-between py-2 border-t border-[#1E293B] opacity-60">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-[#64748b]" />
            <div>
              <p className="text-sm font-semibold text-[#f8fafc]">Account Aggregator</p>
              <p className="text-[11px] text-[#64748b]">Auto bank-statement sync (premium)</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-[#64748b] bg-[#1E293B] px-2 py-0.5 rounded-full">Coming</span>
        </div>

        {/*
          PRODUCTION_COST_FEATURE: Gmail OAuth Integration
          Cost: Free API quota (100 read units/user/day); needs Google Cloud OAuth consent screen + Gmail API enabled.
          Parses bank email alerts directly from user's Gmail inbox (no SMS dependency).

          To enable:
            1. Google Cloud Console → Enable Gmail API
            2. Set VITE_GOOGLE_CLIENT_ID, add gmail.readonly scope to auth flow
            3. Uncomment and wire up handleGmailConnect()

          const handleGmailConnect = async () => {
            const provider = new GoogleAuthProvider();
            provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const accessToken = credential?.accessToken;
            // Use access token to call Gmail API and fetch bank messages
            // await fetchAndParseGmailMessages(accessToken, userId);
          };
        */}
        <div className="flex items-center justify-between py-2 border-t border-[#1E293B] opacity-60">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-[#64748b]" />
            <div>
              <p className="text-sm font-semibold text-[#f8fafc]">Gmail Sync</p>
              <p className="text-[11px] text-[#64748b]">Auto-parse bank email alerts (premium)</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-[#64748b] bg-[#1E293B] px-2 py-0.5 rounded-full">Coming</span>
        </div>
      </div>

      {/* ── Sign out ── */}
      <button
        onClick={onSignOut}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-[24px] bg-[#131B2E] border border-[#1E293B] hover:border-[#F43F5E] hover:text-[#F43F5E] text-[#94a3b8] font-semibold text-sm transition-all"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </motion.div>
  );
});

export default ProfileTab;