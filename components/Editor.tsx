import React, { useRef, useEffect, useCallback, useState, useLayoutEffect } from 'react';
import { SelectionState, Suggestion } from '../types';

interface EditorProps {
  initialContent: string;
  onSelectionChange: (state: SelectionState | null) => void;
  externalInsert?: string | null;
  onContentChange: (text: string) => void;
  suggestions?: Suggestion[];
  onSuggestionHandled: (suggestion: Suggestion) => void; // Callback to remove suggestion from list
}

interface MarginCardPosition {
  index: number;
  top: number;
  suggestion: Suggestion;
}

const Editor: React.FC<EditorProps> = ({ 
  initialContent, 
  onSelectionChange, 
  externalInsert, 
  onContentChange,
  suggestions = [],
  onSuggestionHandled
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const [cardPositions, setCardPositions] = useState<MarginCardPosition[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);

  // Initialize content once on mount
  useEffect(() => {
    if (editorRef.current && !isInitialized.current) {
      editorRef.current.innerHTML = initialContent || '<p><br/></p>';
      isInitialized.current = true;
    }
  }, [initialContent]);

  // Handle external text insertion (e.g. from AI)
  useEffect(() => {
    if (externalInsert && editorRef.current) {
        const newContent = `<p>${externalInsert}</p>`;
        editorRef.current.insertAdjacentHTML('beforeend', newContent);
        onContentChange(editorRef.current.innerText);
    }
  }, [externalInsert, onContentChange]);

  // ---------------------------------------------------------------------------
  // 1. Apply Highlights (Markers) into the Text
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!editorRef.current || suggestions.length === 0) {
        setCardPositions([]);
        return;
    }
    
    const editor = editorRef.current;
    let content = editor.innerHTML;
    
    // Clean existing highlights & diffs to avoid nesting chaos during re-scan
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    
    // Strip existing markers
    tempDiv.querySelectorAll('.critique-marker').forEach(el => {
       const parent = el.parentNode;
       if (parent) parent.replaceChild(document.createTextNode(el.textContent || ''), el);
    });
    // Strip existing diffs if we are resetting (though usually we commit them)
    tempDiv.querySelectorAll('.diff-view-container').forEach(el => {
        const original = el.getAttribute('data-original') || el.textContent;
        const parent = el.parentNode;
        if (parent && original) parent.replaceChild(document.createTextNode(original), el);
    });

    content = tempDiv.innerHTML;

    // Apply new highlights
    suggestions.forEach((s, index) => {
        // Only highlight if not currently viewing a diff for this specific suggestion
        if (content.includes(s.originalText)) {
           const highlightHTML = `<span class="critique-marker" id="marker-${index}" data-index="${index}">${s.originalText}</span>`;
           content = content.replace(s.originalText, highlightHTML);
        }
    });

    editor.innerHTML = content;
    // Trigger calculation immediately after DOM update
    requestAnimationFrame(calculatePositions);
  }, [suggestions]);

  // ---------------------------------------------------------------------------
  // 2. Calculate Margin Positions
  // ---------------------------------------------------------------------------
  const calculatePositions = useCallback(() => {
     if (!editorRef.current || !containerRef.current) return;
     
     const containerRect = containerRef.current.getBoundingClientRect();
     const newPositions: MarginCardPosition[] = [];

     suggestions.forEach((s, index) => {
         // Try to find marker or diff view
         const marker = document.getElementById(`marker-${index}`) || document.getElementById(`diff-${index}`);
         if (marker) {
             const markerRect = marker.getBoundingClientRect();
             // Calculate top relative to the container
             const relativeTop = markerRect.top - containerRect.top;
             
             newPositions.push({
                 index,
                 top: relativeTop,
                 suggestion: s
             });
         }
     });
     setCardPositions(newPositions);
  }, [suggestions]);

  // Setup Observer to keep margin cards aligned when typing shifts text
  useLayoutEffect(() => {
      calculatePositions();
      
      if (!editorRef.current || !containerRef.current) return;

      // Watch for text changes
      const mutationObserver = new MutationObserver(calculatePositions);
      mutationObserver.observe(editorRef.current, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: false
      });

      // Watch for container resize (caused by sidebar toggling)
      const resizeObserver = new ResizeObserver(calculatePositions);
      resizeObserver.observe(containerRef.current);

      window.addEventListener('resize', calculatePositions);
      
      return () => {
          mutationObserver.disconnect();
          resizeObserver.disconnect();
          window.removeEventListener('resize', calculatePositions);
      };
  }, [calculatePositions]);


  // ---------------------------------------------------------------------------
  // 3. Diff View & Acceptance Logic
  // ---------------------------------------------------------------------------
  const showDiffView = (index: number) => {
      const editor = editorRef.current;
      const suggestion = suggestions[index];
      if (!editor || !suggestion) return;

      const marker = document.getElementById(`marker-${index}`);
      if (marker) {
          // Replace marker with Diff HTML
          // We verify match first
          if (marker.textContent === suggestion.originalText) {
              const diffHTML = `
                <span class="diff-view-container" id="diff-${index}" data-original="${suggestion.originalText}">
                    <span class="diff-del">${suggestion.originalText}</span>
                    <span class="diff-ins">${suggestion.suggestion}</span>
                </span>
              `;
              marker.outerHTML = diffHTML;
              setActiveSuggestionIndex(index);
              calculatePositions(); // Re-align
          }
      }
  };

  const acceptSuggestion = (index: number) => {
      const editor = editorRef.current;
      const suggestion = suggestions[index];
      if (!editor || !suggestion) return;

      const diffContainer = document.getElementById(`diff-${index}`);
      if (diffContainer) {
          // Replace the whole diff container with just the new text
          const newTextNode = document.createTextNode(suggestion.suggestion);
          diffContainer.parentNode?.replaceChild(newTextNode, diffContainer);
          
          onContentChange(editor.innerText);
          onSuggestionHandled(suggestion);
          setActiveSuggestionIndex(null);
          requestAnimationFrame(calculatePositions);
      }
  };

  const rejectSuggestion = (index: number) => {
      const editor = editorRef.current;
      const suggestion = suggestions[index];
      if (!editor || !suggestion) return;

      const diffContainer = document.getElementById(`diff-${index}`);
      if (diffContainer) {
          // Revert to original text marker
          const originalHTML = `<span class="critique-marker" id="marker-${index}" data-index="${index}">${suggestion.originalText}</span>`;
          diffContainer.outerHTML = originalHTML;
          setActiveSuggestionIndex(null);
          requestAnimationFrame(calculatePositions);
      }
  };


  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------
  const handleInput = () => {
    if (editorRef.current) {
      onContentChange(editorRef.current.innerText);
    }
  };

  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      onSelectionChange(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    
    if (text.length > 0 && editorRef.current?.contains(range.commonAncestorContainer)) {
      const rect = range.getBoundingClientRect();
      onSelectionChange({
        text,
        range: range.cloneRange(),
        rect
      });
    } else {
      onSelectionChange(null);
    }
  }, [onSelectionChange]);

  // Listen for marker clicks to trigger diff view from text
  useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;
      
      const handleClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('critique-marker')) {
              const index = parseInt(target.getAttribute('data-index') || '-1');
              if (index >= 0) {
                  showDiffView(index);
              }
          }
      };
      editor.addEventListener('click', handleClick);
      return () => editor.removeEventListener('click', handleClick);
  }, [suggestions]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const handleMouseUp = () => setTimeout(handleSelection, 10);
    const handleKeyUp = () => setTimeout(handleSelection, 10);

    el.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('keyup', handleKeyUp);

    return () => {
      el.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleSelection]);

  return (
    <div className="w-full flex justify-center min-h-full overflow-x-hidden">
       {/* Container sets the relative context for absolute positioning of margin cards */}
      <div className="relative flex w-full max-w-[1400px] px-4" ref={containerRef}>
          
          {/* Paper Column */}
          <div className="flex-1 flex justify-end pr-8 pt-12 pb-20">
            <div className="w-full max-w-[850px] min-w-[400px] min-h-[1100px] bg-[#fdfbf7] shadow-lg md:paper-shadow px-16 py-20 transition-all duration-300 ease-in-out relative z-10">
                <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="editor-content font-typewriter text-lg text-[#292929] leading-loose outline-none w-full h-full empty:before:content-[attr(placeholder)]"
                placeholder="Start writing..."
                suppressContentEditableWarning={true}
                style={{ whiteSpace: 'pre-wrap' }}
                />
            </div>
          </div>

          {/* Margin/Comments Column */}
          <div className="w-[320px] relative pt-12 hidden lg:block">
              {cardPositions.map((pos) => {
                  const isActive = activeSuggestionIndex === pos.index;
                  return (
                    <div 
                        key={pos.index}
                        className={`absolute left-0 w-[280px] transition-all duration-300 ease-out ${isActive ? 'z-50' : 'z-0'}`}
                        style={{ top: pos.top }}
                    >
                        <div 
                            className={`
                                pl-3 border-l-2 
                                ${isActive ? 'border-[#ef4444]' : 'border-gray-300 hover:border-[#292929]'}
                                transition-colors duration-200
                            `}
                        >
                            {/* Header */}
                            <span className={`font-typewriter text-[10px] font-bold uppercase tracking-widest block mb-1 ${isActive ? 'text-[#ef4444]' : 'text-gray-400'}`}>
                                {pos.suggestion.category}
                            </span>

                            {/* Reasoning */}
                            <p className="font-typewriter text-[#292929] text-xs leading-snug mb-2 opacity-90">
                                {pos.suggestion.reasoning}
                            </p>
                            
                            {/* Actions */}
                            {isActive ? (
                                <div className="flex gap-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-2">
                                    <button 
                                        onClick={() => acceptSuggestion(pos.index)}
                                        className="hover:text-[#292929] hover:underline"
                                    >
                                        [Accept]
                                    </button>
                                    <button 
                                        onClick={() => rejectSuggestion(pos.index)}
                                        className="hover:text-red-600 hover:underline"
                                    >
                                        [Reject]
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => showDiffView(pos.index)}
                                    className="text-gray-400 text-[10px] font-typewriter font-bold underline hover:text-[#292929] uppercase tracking-wider"
                                >
                                    Review
                                </button>
                            )}
                        </div>
                    </div>
                  );
              })}
          </div>
      </div>
    </div>
  );
};

export default Editor;