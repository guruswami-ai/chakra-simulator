
import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useHelp } from './HelpContext';
import { HelpSectionId } from '../types';

interface ConceptHelperProps {
  sectionId?: HelpSectionId;
  label?: string;
  term?: string;
  definition?: string;
  example?: string;
}

const ConceptHelper: React.FC<ConceptHelperProps> = ({ sectionId, label, term, definition }) => {
  const { openHelp } = useHelp();

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        if (sectionId) {
          const clickIdx = Math.floor(Math.random() * 7) + 1;
          const sfx = new Audio(`${import.meta.env.BASE_URL || '/'}guruswami/sfx/guru_clicked0000${clickIdx}.m4a`);
          sfx.volume = 0.3;
          sfx.play().catch(() => {});
          openHelp(sectionId);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (sectionId) openHelp(sectionId);
        }
      }}
      className="ml-2 p-1 text-white/20 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-all focus:outline-none pointer-events-auto inline-flex items-center justify-center shrink-0 cursor-pointer"
      title={term || label ? `Explain ${term || label}` : "Learn more in Documentation"}
    >
      <HelpCircle className="w-3.5 h-3.5" />
    </span>
  );
};

export default ConceptHelper;
