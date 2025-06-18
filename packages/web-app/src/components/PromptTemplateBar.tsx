import React from 'react';
import { ArrowRightLeft, PenSquare, Share2, Rss } from 'lucide-react';

interface PromptTemplate {
  id: string;
  label: string;
  icon: any; // fallback to any to avoid type issues with Lucide icons
  text: string;
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  { id: "compare", label: "Compare & Contrast", icon: ArrowRightLeft, text: "Compare and contrast the following ideas or outputs, focusing on key similarities, differences, and unique insights:\n\n" },
  { id: "structure", label: "Structure This", icon: PenSquare, text: "Improve the following text by organizing it into a more structured format (e.g., using headings, bullet points, or tables). Identify the core message and present it with enhanced clarity:\n\n" },
  { id: "synthesize", label: "Synthesize", icon: Share2, text: "Synthesize the following information into a cohesive summary. Extract the most critical insights and present them as a unified narrative or a set of key takeaways:\n\n" },
  { id: "enhance", label: "Enhance Draft", icon: Rss, text: "Enhance the following draft for clarity, depth, and a more compelling tone. Identify weaknesses and suggest specific improvements:\n\n" },
];

interface PromptTemplateBarProps {
  onInsert: (text: string) => void;
  disabled: boolean;
}

export const PromptTemplateBar: React.FC<PromptTemplateBarProps> = ({ onInsert, disabled }) => (
  <div className="flex flex-wrap items-center gap-2 mb-3">
    {PROMPT_TEMPLATES.map(template => {
      const Icon = template.icon;
      return (
        <button
          key={template.id}
          onClick={() => onInsert(template.text)}
          disabled={disabled}
          className="flex items-center gap-2 text-sm bg-white/5 text-gray-300 px-3 py-1.5 rounded-md hover:bg-white/15 hover:text-white transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {Icon && <Icon size={14} />}
          {template.label}
        </button>
      );
    })}
  </div>
);
