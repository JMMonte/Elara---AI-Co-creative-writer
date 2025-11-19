import React, { useState, useRef } from 'react';
import { Suggestion, FileAttachment, ChatMessage } from '../types';
import { SendIcon, PaperclipIcon, SparklesIcon, XIcon } from './Icons';
import { chatWithAI, generateDraft } from '../services/geminiService';

interface AIPanelProps {
  suggestions: Suggestion[];
  onApplySuggestion: (s: Suggestion) => void;
  onInsertText: (text: string) => void;
}

const AIPanel: React.FC<AIPanelProps> = ({ suggestions, onApplySuggestion, onInsertText }) => {
  const [mode, setMode] = useState<'chat' | 'draft'>('chat');
  const [input, setInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'model', text: "I am your co-author. Ready to draft or review." }
  ]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          if (result) {
            const base64String = result.split(',')[1];
            setFiles(prev => [...prev, {
                name: file.name,
                mimeType: file.type,
                data: base64String
            }]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;
    
    const userMsg: ChatMessage = { role: 'user', text: input };
    setChatHistory(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      if (mode === 'draft') {
        setChatHistory(prev => [...prev, { 
            role: 'model', 
            text: "Drafting content...",
            isLoading: true
        }]);
        
        const draft = await generateDraft(userMsg.text, files);
        
        setChatHistory(prev => prev.filter(msg => !msg.isLoading));
        setChatHistory(prev => [...prev, { role: 'model', text: "Draft complete:" }]);
        setChatHistory(prev => [...prev, { role: 'model', text: draft, isLoading: false }]);
      } else {
        const historyForApi = chatHistory.map(h => ({ 
            role: h.role, 
            parts: [{ text: h.text }] 
        }));
        
        const response = await chatWithAI(historyForApi, userMsg.text, files);
        setChatHistory(prev => [...prev, { role: 'model', text: response }]);
      }
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'model', text: "Connection error encountered." }]);
    } finally {
      setIsThinking(false);
      setFiles([]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#f2f0eb] border-l border-[#d1d1cd] w-full font-typewriter text-sm">
      {/* Tabs */}
      <div className="flex border-b border-[#d1d1cd] bg-[#eae8e3]">
        <button 
          onClick={() => setMode('chat')}
          className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${mode === 'chat' ? 'text-black bg-[#f2f0eb] shadow-sm' : 'text-gray-500 hover:bg-[#efede8]'}`}
        >
          Partner
        </button>
        <button 
          onClick={() => setMode('draft')}
          className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${mode === 'draft' ? 'text-black bg-[#f2f0eb] shadow-sm' : 'text-gray-500 hover:bg-[#efede8]'}`}
        >
          Drafter
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar">
        {/* Suggestions Section (Proactive) */}
        {suggestions.length > 0 && (
          <div className="mb-6 p-4 bg-[#fffdfa] border border-dashed border-gray-400 rounded-sm shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-gray-800">
              <SparklesIcon className="w-4 h-4 text-yellow-600" />
              <h3 className="text-xs font-bold uppercase tracking-widest">Suggestions</h3>
            </div>
            <div className="space-y-4">
              {suggestions.map((s, i) => (
                <div key={i} className="cursor-pointer group" onClick={() => onApplySuggestion(s)}>
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Rewrite</p>
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] bg-gray-800 text-white px-1 py-0.5 rounded-none">APPLY</span>
                  </div>
                  <p className="text-xs text-gray-400 line-through font-mono mb-1">{s.originalText}</p>
                  <p className="text-sm text-gray-900 font-medium border-l-2 border-yellow-500 pl-2">{s.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages */}
        {chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] px-4 py-3 text-sm border ${
                    msg.role === 'user' 
                    ? 'bg-white border-gray-300 text-gray-800 shadow-sm' 
                    : 'bg-transparent border-transparent text-gray-700 italic'
                }`}>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                        {msg.role === 'user' ? 'You' : 'AI'}
                    </span>
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                    
                    {/* Action for large model outputs (Drafts) */}
                    {msg.role === 'model' && !msg.isLoading && msg.text.length > 100 && (
                        <button 
                            onClick={() => onInsertText(msg.text)}
                            className="mt-3 text-xs flex items-center gap-1 text-gray-900 border border-gray-300 px-2 py-1 hover:bg-gray-100 uppercase tracking-wider"
                        >
                            <SendIcon className="w-3 h-3 rotate-180" /> Insert
                        </button>
                    )}
                </div>
            </div>
        ))}
        
        {isThinking && (
             <div className="flex items-center gap-2 text-gray-400 text-xs animate-pulse pl-2">
                 <span>Thinking...</span>
             </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[#d1d1cd] bg-[#eae8e3]">
        {files.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 bg-white border border-gray-300 px-2 py-1 text-xs text-gray-600 font-mono">
                        <span>{f.name.length > 15 ? f.name.substring(0, 12) + '...' : f.name}</span>
                        <button onClick={() => removeFile(i)}><XIcon className="w-3 h-3" /></button>
                    </div>
                ))}
            </div>
        )}

        <div className="flex gap-2 items-end">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-800 transition-colors"
            title="Attach Reference"
          >
            <PaperclipIcon className="w-5 h-5" />
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                multiple 
                accept="image/*,application/pdf,text/plain"
                onChange={handleFileSelect}
            />
          </button>
          
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={mode === 'draft' ? "Brief the drafter..." : "Note to AI..."}
              className="w-full resize-none max-h-32 min-h-[44px] py-2 px-3 bg-[#fdfbf7] border border-gray-300 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400 text-sm font-typewriter"
              rows={1}
            />
          </div>
          
          <button 
            onClick={handleSend}
            disabled={(!input.trim() && files.length === 0) || isThinking}
            className={`p-2 border transition-all ${
              (!input.trim() && files.length === 0) || isThinking
                ? 'bg-transparent border-transparent text-gray-400' 
                : 'bg-gray-800 border-gray-800 text-white hover:bg-black'
            }`}
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIPanel;