import React, { useEffect } from 'react';

interface PromptComposerProps {
  value: string;
  onChange: (text: string) => void;
  disabled: boolean;
}

export const PromptComposer: React.FC<PromptComposerProps> = ({ value, onChange, disabled }) => {
  useEffect(() => {
    const textarea = document.getElementById('prompt-input');
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  return (
    <div className="relative w-full">
      {/* Use inline SVG for BrainCircuit icon to avoid Lucide React type issues */}
      <span className="absolute top-4 left-4 text-gray-500">
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M8 15s1.5-2 4-2 4 2 4 2" /><path d="M9 9h.01" /><path d="M15 9h.01" /></svg>
      </span>
      <textarea
        id="prompt-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Select a template or start typing your prompt..."
        className="w-full bg-black/30 text-gray-100 placeholder-gray-500 rounded-xl p-4 pl-12 resize-none border-2 border-transparent focus:border-indigo-500 focus:ring-0 transition-colors duration-200 text-lg leading-relaxed min-h-[120px]"
        rows={3}
      />
    </div>
  );
};
