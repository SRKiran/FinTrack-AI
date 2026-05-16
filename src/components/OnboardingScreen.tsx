import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface OnboardingScreenProps {
  onSubmit: (data: { name: string; dob: string; identification: string }) => void;
}

// PAN card format: 5 uppercase letters + 4 digits + 1 uppercase letter (e.g., ABCDE1234F)
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/* ─────────────────────────────────────────────────────────────────────────
   PRODUCTION_COST_FEATURE: Setu PAN Verification
   Once you move to production, replace self-declaration with a real API call.
   Cost: ₹1–3 per user (one-time during onboarding). Free sandbox available.
   Setup: https://bridge.setu.co → KYC → PAN Verification
   Requires env vars: VITE_SETU_API_TOKEN, VITE_SETU_CLIENT_ID, VITE_SETU_PRODUCT_INSTANCE_ID
   ─────────────────────────────────────────────────────────────────────── */
/*
async function verifyPANWithSetu(pan: string): Promise<{ valid: boolean; name?: string }> {
  const res = await fetch('https://dg-sandbox.setu.co/api/verify/pan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SETU_API_TOKEN}`,
      'x-client-id': import.meta.env.VITE_SETU_CLIENT_ID,
      'x-product-instance-id': import.meta.env.VITE_SETU_PRODUCT_INSTANCE_ID,
    },
    body: JSON.stringify({ pan }),
  });
  const data = await res.json();
  return { valid: data.status === 'VALID' && data.individual === true, name: data.name };
}
*/

export default function OnboardingScreen({ onSubmit }: OnboardingScreenProps) {
  const [step, setStep]       = useState(1);
  const [formData, setFormData] = useState({ name: '', dob: '', identification: '' });
  const [panError, setPanError] = useState('');

  const validateAndNext = () => {
    if (step === 2) {
      const pan = formData.identification.trim().toUpperCase();
      if (pan && !PAN_REGEX.test(pan)) {
        setPanError('Invalid PAN format — expected ABCDE1234F');
        return;
      }
      setPanError('');
      // Normalise to uppercase before saving
      setFormData(prev => ({ ...prev, identification: pan }));

      /* --- PRODUCTION_COST_FEATURE: swap format-check for Setu API call ---
      try {
        const result = await verifyPANWithSetu(pan);
        if (!result.valid) { setPanError('PAN not found or inactive'); return; }
      } catch { setPanError('Verification failed, please retry'); return; }
      -------------------------------------------------------------------- */
    }

    if (step === 3) {
      onSubmit({ ...formData, identification: formData.identification.trim().toUpperCase() });
    } else {
      setStep(s => s + 1);
    }
  };

  const isNextDisabled = step === 1 && !formData.name.trim();

  return (
    <div className="flex h-screen flex-col bg-[#090D16] p-8 max-w-md mx-auto text-[#f8fafc]">
      {/* Progress bar */}
      <div className="flex gap-2 mb-12">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300',
              i <= step ? 'bg-[#06B6D4]' : 'bg-[#1E293B]')}
          />
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
              <h2 className="text-3xl font-extrabold mb-4">What's your name?</h2>
              <p className="text-[#94a3b8] mb-8 text-sm">We'll use this to personalise your dashboard.</p>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-4 bg-[#131B2E] border border-[#1E293B] rounded-[24px] outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc] placeholder-[#64748b]"
                placeholder="Full Name"
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-3xl font-extrabold mb-4">Verification details</h2>
              <p className="text-[#94a3b8] mb-8 text-sm">Used to identify your account securely.</p>
              <div className="space-y-4">
                <input
                  type="date"
                  value={formData.dob}
                  onChange={e => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full p-4 bg-[#131B2E] border border-[#1E293B] rounded-[24px] outline-none focus:ring-2 focus:ring-[#06B6D4] text-[#f8fafc]"
                  style={{ colorScheme: 'dark' }}
                />
                <div>
                  <input
                    type="text"
                    value={formData.identification}
                    onChange={e => {
                      setFormData({ ...formData, identification: e.target.value.toUpperCase() });
                      setPanError('');
                    }}
                    className={cn(
                      'w-full p-4 bg-[#131B2E] border rounded-[24px] outline-none focus:ring-2 text-[#f8fafc] placeholder-[#64748b] uppercase tracking-widest font-mono',
                      panError
                        ? 'border-[#F43F5E] focus:ring-[#F43F5E]'
                        : 'border-[#1E293B] focus:ring-[#06B6D4]'
                    )}
                    placeholder="PAN (e.g. ABCDE1234F)"
                    maxLength={10}
                  />
                  {panError && <p className="text-[#F43F5E] text-xs mt-2 pl-2">{panError}</p>}
                  <p className="text-[#64748b] text-xs mt-2 pl-2">
                    Format validated on-device. No external API call made.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center">
              <div className="w-20 h-20 bg-[#131B2E] border border-[#1E293B] rounded-full flex items-center justify-center mx-auto mb-8">
                <ShieldCheck className="w-10 h-10 text-[#06B6D4]" />
              </div>
              <h2 className="text-3xl font-extrabold mb-4">Data Privacy</h2>
              <p className="text-[#94a3b8] mb-8 leading-relaxed text-sm">
                Kanaka Fin processes your financial messages on-device or via AI parsing.
                Only structured fields (vendor, amount, category, type) are stored.
                Your data is never sold or shared with third parties.
              </p>
              <div className="bg-[#1E293B] p-5 rounded-[24px] text-left">
                <p className="text-xs text-[#06B6D4] font-medium leading-relaxed">
                  I consent to Kanaka Fin parsing my transaction messages for personal financial tracking only.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <button
        onClick={validateAndNext}
        disabled={isNextDisabled}
        className={cn(
          'w-full py-5 rounded-[24px] font-bold mt-8 transition-all',
          isNextDisabled
            ? 'bg-[#1E293B] text-[#64748b] cursor-not-allowed'
            : 'bg-[#06B6D4] text-[#090D16] shadow-xl shadow-[#06B6D4]/20'
        )}
      >
        {step === 3 ? 'Complete Setup' : 'Next →'}
      </button>
    </div>
  );
}
