import React from 'react';
import { Wallet } from 'lucide-react';

interface AuthScreenProps {
  onLogin: () => void;
}

export default function AuthScreen({ onLogin }: AuthScreenProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#090D16] p-8 max-w-md mx-auto text-[#f8fafc]">
      <div className="mb-12 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-[#131B2E] to-[#1e1b4b] border border-[#312e81] rounded-[24px] mx-auto mb-6 flex items-center justify-center shadow-xl shadow-blue-900/20 rotate-12">
          <Wallet className="w-10 h-10 text-[#06B6D4] -rotate-12" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-[#f8fafc] mb-3">Kanaka Fin</h1>
        <p className="text-[#94a3b8] max-w-[250px] mx-auto text-sm leading-relaxed">
          The smartest way to track your expenses and grow your net worth.
        </p>
      </div>

      <button
        onClick={onLogin}
        className="w-full flex items-center justify-center gap-3 bg-[#131B2E] border border-[#1E293B] py-4 px-6 rounded-[24px] font-bold text-[#f8fafc] hover:bg-[#1E293B] transition-colors"
      >
        <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
        Continue with Google
      </button>

      <p className="mt-8 text-xs text-[#64748b] text-center max-w-[260px] leading-relaxed">
        By continuing you agree to our terms. Only transaction metadata is stored — never raw personal data.
      </p>
    </div>
  );
}