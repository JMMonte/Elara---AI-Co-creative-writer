export interface Suggestion {
  originalText: string;
  suggestion: string;
  reasoning: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
}

export interface FileAttachment {
  name: string;
  mimeType: string;
  data: string; // Base64
}

export interface SelectionState {
  text: string;
  range: Range | null;
  rect: DOMRect | null;
}
