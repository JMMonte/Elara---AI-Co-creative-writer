import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon, RefreshIcon, WandIcon } from './Icons';
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
  const [position, setPosition] = useState({ top: 0, left: 0, placeAbove: true });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectionRect) {
      // Check distance to top of screen
      const spaceAbove = selectionRect.top;
      const placeAbove = spaceAbove > 220; // Threshold for flipping position
      
      setPosition({
        top: placeAbove ? selectionRect.top - 12 : selectionRect.bottom + 12, 
        left: Math.max(10, selectionRect.left + (selectionRect.width / 2)), // Centered horizontally relative to selection
        placeAbove
      });
    }
  }, [selectionRect]);

  const handleQuickAction = (action: string) => {
    setInputValue(action); // Visual feedback
    executeRewrite(action);
  };

  const executeRewrite = async (instruction: string) => {
    setIsProcessing(true);
    try {
      const newText = await rewriteSelection(selectedText, instruction, fullText);
      onReplace(newText);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    executeRewrite(inputValue);
  };

  if (!selectionRect) return null;

  return (
    <div 
      ref={menuRef}
      className="fixed z-50 flex flex-col bg-[#fdfbf7] border border-[#a8a29e] shadow-xl w-[320px] font-typewriter animate-fade-in-up"
      style={{ 
        top: position.top, 
        left: position.left,
        transform: `translateX(-50%) ${position.placeAbove ? 'translateY(-100%)' : 'translateY(0)'}` // Ensure it sits above/below correctly
      }}
    >
      {/* Minimal Header */}
      <div className="px-4 py-2 border-b border-[#e5e5e5] flex items-center justify-between bg-white/50">
        <div className="flex items-center gap-1.5 text-gray-500">
          <WandIcon className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Magic Edit</span>
        </div>
        <button onClick={onClose} className="text-[10px] text-gray-400 hover:text-black px-1">
          ESC
        </button>
      </div>
      
      <div className="p-3 space-y-3">
        {/* Input Field */}
        <div className="relative group">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
               if (e.key === 'Enter') handleSubmit();
               if (e.key === 'Escape') onClose();
            }}
            placeholder="How should I change this?"
            className="w-full pl-2 pr-8 py-1.5 text-sm bg-transparent border-b border-dashed border-gray-300 focus:border-black focus:outline-none transition-colors font-typewriter text-[#292929] placeholder-gray-400"
            autoFocus
          />
          <button 
            onClick={handleSubmit}
            disabled={isProcessing || !inputValue.trim()}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black disabled:opacity-30 transition-colors"
          >
            {isProcessing ? (
              <RefreshIcon className="w-3 h-3 animate-spin" />
            ) : (
              <SparklesIcon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        
        {/* Preset Tools Grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Show, Don't Tell", action: "ShowDontTell" },
            { label: "Make Vivid", action: "Sensory" },
            { label: "Strong Verbs", action: "StrongerVerbs" },
            { label: "Add Metaphor", action: "Metaphor" }
          ].map((tool) => (
            <button 
              key={tool.action}
              onClick={() => handleQuickAction(tool.action)} 
              disabled={isProcessing}
              className="text-[11px] text-left px-3 py-2 border border-transparent hover:border-gray-200 hover:bg-white hover:shadow-sm transition-all text-gray-600 hover:text-black rounded-sm"
            >
              {tool.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MagicMenu;