import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface NavButtonProps {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

// Memoized: only re-renders when active state or label changes.
const NavButton = memo(function NavButton({ active, icon: Icon, label, onClick }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 transition-colors relative px-2',
        active ? 'text-[#06B6D4]' : 'text-[#64748b] hover:text-[#94a3b8]'
      )}
    >
      <Icon className="w-6 h-6" />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      {active && (
        <motion.div
          layoutId="nav-dot"
          className="w-1 h-1 bg-[#06B6D4] rounded-full absolute -top-3"
        />
      )}
    </button>
  );
});

export default NavButton;