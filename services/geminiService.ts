import { GoogleGenAI, Type } from "@google/genai";
import { FileAttachment, Suggestion } from "../types";

// NOTE: We are using process.env.API_KEY directly as instructed.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a full draft based on a prompt and optional file attachments.
 * Uses the more capable gemini-3-pro-preview model for reasoning and complex synthesis.
 */
export const generateDraft = async (
  prompt: string,
  files: FileAttachment[]
): Promise<string> => {
  try {
    const parts: any[] = [];
    
    // Add files
    files.forEach(file => {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      });
    });

    // Add text prompt
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction: "You are a professional writer and thought partner. Create comprehensive, well-structured, and engaging content based on the user's request and attachments. Use Markdown formatting for headers and lists, but avoid code blocks for normal text.",
        // Enable thinking for complex drafting tasks
        thinkingConfig: { thinkingBudget: 2048 },
        maxOutputTokens: 8192, 
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Error generating draft:", error);
    throw error;
  }
};

/**
 * Rewrites specific selected text based on instructions.
 * Uses gemini-2.5-flash for low-latency updates.
 */
export const rewriteSelection = async (
  selectedText: string,
  instruction: string,
  context: string
): Promise<string> => {
  try {
    const prompt = `
      Context: "${context.substring(0, 1000)}..."
      
      Selected Text to Modify: "${selectedText}"
      
      User Instruction: "${instruction}"
      
      Task: Rewrite the 'Selected Text' based on the 'User Instruction'. Maintain the tone of the Context. Return ONLY the rewritten text, no explanations or quotes.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || selectedText;
  } catch (error) {
    console.error("Error rewriting text:", error);
    return selectedText; // Fallback
  }
};

/**
 * Proactively analyzes the text to provide improvement suggestions.
 * Returns structured JSON data.
 */
export const analyzeTextForSuggestions = async (text: string): Promise<Suggestion[]> => {
  try {
    if (!text || text.length < 50) return [];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the following text and identify 3 areas for improvement (grammar, clarity, tone, or structure). Return a JSON array. 
      Text: "${text.substring(0, 2000)}..."`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalText: { type: Type.STRING, description: "The exact snippet from the text to change" },
              suggestion: { type: Type.STRING, description: "The suggested rewrite" },
              reasoning: { type: Type.STRING, description: "Why this change is recommended" }
            }
          }
        }
      }
    });

    // Parse the response safely
    const jsonStr = response.text || "[]";
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error analyzing text:", error);
    return [];
  }
};

/**
 * Chat helper for the sidebar conversation
 */
export const chatWithAI = async (history: {role: string, parts: {text: string}[]}[], newMessage: string, files: FileAttachment[] = []) => {
    try {
        const parts: any[] = files.map(f => ({
            inlineData: { mimeType: f.mimeType, data: f.data }
        }));
        parts.push({ text: newMessage });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Good balance for chat
            contents: [
                ...history.map(h => ({ role: h.role, parts: h.parts })),
                { role: 'user', parts }
            ]
        });
        
        return response.text || "";
    } catch (error) {
        console.error("Chat error:", error);
        throw error;
    }
}