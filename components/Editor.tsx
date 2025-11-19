import React, { useRef, useEffect, useCallback } from 'react';
import { SelectionState } from '../types';

interface EditorProps {
  initialContent: string;
  onSelectionChange: (state: SelectionState | null) => void;
  externalInsert?: string | null;
  onContentChange: (text: string) => void;
}

const Editor: React.FC<EditorProps> = ({ initialContent, onSelectionChange, externalInsert, onContentChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

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
        // Insert at the end securely
        const newContent = `<p>${externalInsert}</p>`;
        editorRef.current.insertAdjacentHTML('beforeend', newContent);
        // Notify parent of change
        onContentChange(editorRef.current.innerText);
    }
  }, [externalInsert, onContentChange]);

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
    
    // Ensure selection is inside our editor
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

  // efficient event listeners for selection
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
    <div className="w-full flex justify-center py-12 min-h-full">
      {/* The Paper Sheet */}
      <div className="w-[850px] min-h-[1100px] bg-[#fdfbf7] shadow-lg md:paper-shadow px-16 py-20 transition-all duration-300 ease-in-out">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          className="editor-content font-typewriter text-lg text-[#292929] leading-loose outline-none w-full h-full empty:before:content-[attr(placeholder)]"
          placeholder="Type something brilliant..."
          suppressContentEditableWarning={true}
          style={{ whiteSpace: 'pre-wrap' }}
        />
      </div>
    </div>
  );
};

export default Editor;