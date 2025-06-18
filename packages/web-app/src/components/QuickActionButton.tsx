import React from 'react';

interface QuickActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({ onClick, children, icon: Icon }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 text-sm bg-white/10 text-gray-300 px-3 py-1.5 rounded-md hover:bg-white/20 hover:text-white transition-colors duration-150"
  >
    {Icon && <Icon size={14} />}
    {children}
  </button>
);
