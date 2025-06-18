import React from 'react';

interface PrimaryButtonProps {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({ onClick, disabled, children, icon: Icon }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center justify-center gap-2 w-full sm:w-auto bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 ease-in-out hover:bg-indigo-500 disabled:bg-slate-600 disabled:text-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75 shadow-lg"
  >
    {Icon && <Icon size={18} />}
    {children}
  </button>
);
