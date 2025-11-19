import React, { useState, useRef } from 'react';
import { FileAttachment, ChatMessage } from '../types';
import { SendIcon, PaperclipIcon, XIcon } from './Icons';
import { chatWithAI } from '../services/geminiService';

interface AIPanelProps {
  onInsertText: (text: string) => void;
}

const AIPanel: React.FC<AIPanelProps> = ({ onInsertText }) => {
  const [input, setInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'model', text: "I'm your creative partner. I can help you brainstorm, outline, or draft scenes." }
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
        const historyForApi = chatHistory.map(h => ({ 
            role: h.role, 
            parts: [{ text: h.text }] 
        }));
        
        const response = await chatWithAI(historyForApi, userMsg.text, files);
        setChatHistory(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'model', text: "I lost my train of thought. Please try again." }]);
    } finally {
      setIsThinking(false);
      setFiles([]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#f2f0eb] border-l border-[#d1d1cd] w-full font-typewriter text-sm">
      <div className="p-4 border-b border-[#d1d1cd] bg-[#eae8e3] flex justify-between items-center">
         <span className="text-xs font-bold uppercase tracking-widest text-[#292929]">AI Partner</span>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar">
        
        {/* Chat Messages */}
        {chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] px-4 py-3 text-sm border shadow-[2px_2px_0px_rgba(0,0,0,0.05)] ${
                    msg.role === 'user' 
                    ? 'bg-white border-gray-300 text-[#292929]' 
                    : 'bg-[#eae8e3] border-[#d1d1cd] text-[#292929]'
                }`}>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1 tracking-wider">
                        {msg.role === 'user' ? 'You' : 'Partner'}
                    </span>
                    <div className="whitespace-pre-wrap leading-relaxed font-typewriter">{msg.text}</div>
                    
                    {/* Action for large model outputs (Drafts) */}
                    {msg.role === 'model' && !msg.isLoading && msg.text.length > 100 && (
                        <button 
                            onClick={() => onInsertText(msg.text)}
                            className="mt-3 text-xs flex items-center gap-1 text-[#292929] border border-gray-400 px-2 py-1 hover:bg-[#292929] hover:text-white transition-colors uppercase tracking-wider"
                        >
                            <SendIcon className="w-3 h-3 rotate-180" /> Insert to Page
                        </button>
                    )}
                </div>
            </div>
        ))}
        
        {isThinking && (
             <div className="flex items-center gap-2 text-gray-400 text-xs animate-pulse pl-2 font-mono">
                 <span>Thinking...</span>
             </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[#d1d1cd] bg-[#eae8e3]">
        {files.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 bg-white border border-gray-300 px-2 py-1 text-xs text-gray-600 font-mono shadow-sm">
                        <span>{f.name.length > 15 ? f.name.substring(0, 12) + '...' : f.name}</span>
                        <button onClick={() => removeFile(i)}><XIcon className="w-3 h-3" /></button>
                    </div>
                ))}
            </div>
        )}

        <div className="flex gap-2 items-end">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-[#292929] transition-colors"
            title="Attach Reference Material"
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
              placeholder="Ask for advice or ideas..."
              className="w-full resize-none max-h-32 min-h-[44px] py-2 px-3 bg-[#fdfbf7] border border-gray-300 focus:outline-none focus:border-[#292929] focus:ring-0 text-sm font-typewriter text-[#292929] placeholder-gray-400"
              rows={1}
            />
          </div>
          
          <button 
            onClick={handleSend}
            disabled={(!input.trim() && files.length === 0) || isThinking}
            className={`p-2 border transition-all shadow-sm ${
              (!input.trim() && files.length === 0) || isThinking
                ? 'bg-transparent border-transparent text-gray-400' 
                : 'bg-[#292929] border-[#292929] text-[#fdfbf7] hover:bg-black'
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