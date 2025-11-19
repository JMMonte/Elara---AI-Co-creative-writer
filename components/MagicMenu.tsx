import React, { useState, useEffect } from 'react';
import { SparklesIcon, RefreshIcon } from './Icons';
import { rewriteSelection } from '../services/geminiService';

interface MagicMenuProps {
  selectionRect: DOMRect | null;
  selectedText: string;
  fullText: string;
  onReplace: (newText: string) => void;
  onClose: () => void;
}

const MagicMenu: React.FC<MagicMenuProps> = ({ selectionRect, selectedText, fullText, onReplace, onClose }) => {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (selectionRect) {
      setPosition({
        top: selectionRect.top - 70, 
        left: Math.max(10, selectionRect.left + (selectionRect.width / 2) - 160) 
      });
    }
  }, [selectionRect]);

  const handleSubmit = async () => {
    if (!inputValue.trim()) return;
    
    setIsProcessing(true);
    try {
      const newText = await rewriteSelection(selectedText, inputValue, fullText);
      onReplace(newText);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!selectionRect) return null;

  return (
    <div 
      className="fixed z-50 flex flex-col bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] w-[320px] font-typewriter animate-fade-in-up"
      style={{ top: position.top, left: position.left }}
    >
      <div className="bg-black px-3 py-1 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-widest">
          <SparklesIcon className="w-3 h-3" />
          <span>Magic Rewrite</span>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white text-xs font-mono">
          [ESC]
        </button>
      </div>
      
      <div className="p-3 bg-[#fffdfa]">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
               if (e.key === 'Enter') handleSubmit();
               if (e.key === 'Escape') onClose();
            }}
            placeholder="Instruction (e.g. Shorten)..."
            className="w-full pl-2 pr-10 py-2 text-sm border-b border-gray-300 bg-transparent focus:outline-none focus:border-black transition-colors font-typewriter"
            autoFocus
          />
          <button 
            onClick={handleSubmit}
            disabled={isProcessing}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-black hover:text-gray-600 disabled:opacity-50"
          >
            {isProcessing ? (
              <RefreshIcon className="w-4 h-4 animate-spin" />
            ) : (
              <span className="text-[10px] font-bold border border-black px-1 hover:bg-black hover:text-white transition-colors">GO</span>
            )}
          </button>
        </div>
        
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setInputValue("Fix grammar")} className="text-[10px] uppercase font-bold border border-gray-300 hover:border-black px-2 py-1 text-gray-600 hover:text-black transition-colors">Grammar</button>
          <button onClick={() => setInputValue("Make it shorter")} className="text-[10px] uppercase font-bold border border-gray-300 hover:border-black px-2 py-1 text-gray-600 hover:text-black transition-colors">Shorten</button>
          <button onClick={() => setInputValue("Make it professional")} className="text-[10px] uppercase font-bold border border-gray-300 hover:border-black px-2 py-1 text-gray-600 hover:text-black transition-colors">Professional</button>
        </div>
      </div>
    </div>
  );
};

export default MagicMenu;