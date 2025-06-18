import React from 'react';

interface SecondaryButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full sm:w-auto bg-transparent text-gray-400 font-medium py-3 px-6 rounded-lg transition-all duration-200 ease-in-out hover:bg-white/5 hover:text-white"
  >
    {children}
  </button>
);
