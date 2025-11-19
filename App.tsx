import React, { useState, useEffect, useCallback } from 'react';
import Editor from './components/Editor';
import MagicMenu from './components/MagicMenu';
import AIPanel from './components/AIPanel';
import { SelectionState, Suggestion } from './types';
import { MenuIcon, SparklesIcon, WandIcon } from './components/Icons';
import { analyzeTextForSuggestions } from './services/geminiService';

const App = () => {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [externalInsertText, setExternalInsertText] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoPartnerEnabled, setAutoPartnerEnabled] = useState(false);

  const handleSelectionChange = useCallback((sel: SelectionState | null) => {
    setSelection(sel);
  }, []);

  const handleInlineReplace = (newText: string) => {
    if (selection && selection.range) {
      const range = selection.range;
      range.deleteContents();
      const textNode = document.createTextNode(newText);
      range.insertNode(textNode);
      
      // Clear selection
      window.getSelection()?.removeAllRanges();
      setSelection(null);
      
      // Update content state manually since we bypassed React
      const editor = document.querySelector('.editor-content') as HTMLElement;
      if (editor) setEditorContent(editor.innerText);
    }
  };

  const handleSuggestionHandled = (s: Suggestion) => {
    // Remove the suggestion from the global list once accepted/rejected in Editor
    setSuggestions(prev => prev.filter(item => item !== s));
  };

  const runProactiveAnalysis = useCallback(async () => {
    if (!editorContent || editorContent.length < 10) {
        alert("Please write a bit more before asking for a critique!");
        return;
    }
    
    setIsAnalyzing(true);
    try {
        const newSuggestions = await analyzeTextForSuggestions(editorContent);
        setSuggestions(newSuggestions);
        if (newSuggestions.length === 0) {
            alert("Your prose looks clean! No major issues found.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        setIsAnalyzing(false);
    }
  }, [editorContent]);

  // Auto-partner logic
  useEffect(() => {
    if (!autoPartnerEnabled) return;

    const timer = setTimeout(() => {
        if (editorContent.length > 100) {
           runProactiveAnalysis(); 
        }
    }, 10000); 
    return () => clearTimeout(timer);
  }, [editorContent, runProactiveAnalysis, autoPartnerEnabled]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#e8e8e5] font-typewriter">
      {/* Main Editor Area */}
      <div 
        className="flex-1 relative flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out"
        style={{ marginRight: sidebarOpen ? '350px' : '0px' }}
      >
        {/* Header - Minimal & Analog */}
        <header className="h-16 border-b border-[#d1d1cd] bg-[#e8e8e5] flex items-center justify-between px-6 shrink-0 z-10">
            <div className="flex items-center gap-3 select-none opacity-50 hover:opacity-100 transition-opacity">
                <SparklesIcon className="w-5 h-5 text-[#292929]" />
            </div>
            
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-gray-600 cursor-pointer hover:text-black transition-colors" title="AI will periodically critique your prose">
                   <input 
                      type="checkbox" 
                      checked={autoPartnerEnabled} 
                      onChange={(e) => setAutoPartnerEnabled(e.target.checked)}
                      className="accent-[#292929] w-4 h-4"
                   />
                   Auto-Critique
                </label>
                
                <div className="h-6 w-[1px] bg-gray-400 mx-2"></div>

                <button 
                    onClick={runProactiveAnalysis}
                    disabled={isAnalyzing}
                    className={`flex items-center gap-2 px-4 py-1.5 border text-xs font-bold uppercase tracking-wider transition-all
                        ${isAnalyzing 
                            ? 'bg-[#292929] text-white border-[#292929] opacity-80 cursor-wait' 
                            : 'bg-transparent border-gray-600 text-[#292929] hover:bg-[#292929] hover:text-[#fdfbf7] hover:border-[#292929]'
                        }`}
                >
                   <WandIcon className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                   {isAnalyzing ? 'Reading...' : 'Critique'}
                </button>
                
                <button 
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className={`p-2 hover:bg-gray-300 rounded-sm transition-colors ${sidebarOpen ? 'text-[#292929]' : 'text-gray-500'}`}
                >
                    <MenuIcon />
                </button>
            </div>
        </header>

        {/* Scrollable Editor Canvas */}
        <main className="flex-1 overflow-y-auto relative cursor-text scroll-smooth">
            <Editor 
                initialContent=""
                onSelectionChange={handleSelectionChange}
                onContentChange={setEditorContent}
                externalInsert={externalInsertText}
                suggestions={suggestions}
                onSuggestionHandled={handleSuggestionHandled}
            />
        </main>

        {/* Floating Magic Menu */}
        {selection && (
            <MagicMenu 
                selectionRect={selection.rect}
                selectedText={selection.text}
                fullText={editorContent}
                onReplace={handleInlineReplace}
                onClose={() => setSelection(null)}
            />
        )}
      </div>

      {/* Right Sidebar (AI Partner) */}
      <div 
        className={`fixed inset-y-0 right-0 w-[350px] bg-[#f2f0eb] shadow-2xl transform transition-transform duration-300 ease-in-out z-30 border-l border-[#bbb]
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
        `}
      >
        <AIPanel 
            onInsertText={(text) => {
                setExternalInsertText(text);
                setTimeout(() => setExternalInsertText(null), 100);
            }}
        />
      </div>
    </div>
  );
};

export default App;