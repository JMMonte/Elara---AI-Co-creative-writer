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
        systemInstruction: "You are a master literary editor and creative writing coach. Your goal is to help the user write compelling, vivid, and emotionally resonant prose. When drafting, prioritize 'showing' over 'telling', use strong verbs, avoid excessive adverbs, and maintain a consistent, distinct voice. DO NOT use emojis in your response.",
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
    // Check for specific creative writing "modes" passed as instruction
    let detailedInstruction = instruction;
    
    if (instruction === 'ShowDontTell') {
      detailedInstruction = "Rewrite this using 'Show, Don't Tell'. Replace abstract emotions or summaries with sensory details, action, and body language. Make the reader feel it.";
    } else if (instruction === 'StrongerVerbs') {
      detailedInstruction = "Replace weak verbs (to be, to have, etc.) and adverbs with precise, evocative, and powerful action verbs.";
    } else if (instruction === 'Sensory') {
      detailedInstruction = "Enhance this text by incorporating the five senses (sight, sound, smell, touch, taste) to make the scene immersive.";
    } else if (instruction === 'Metaphor') {
      detailedInstruction = "Rewrite this using a fresh, creative metaphor or simile to describe the subject matter.";
    }

    const prompt = `
      Context (preceding text): "${context.substring(Math.max(0, context.length - 1000))}"
      
      Selected Text to Modify: "${selectedText}"
      
      Instruction: "${detailedInstruction}"
      
      Task: Rewrite the 'Selected Text' strictly following the instruction. Maintain the author's voice but elevate the prose quality. Return ONLY the rewritten text. DO NOT use emojis.
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
    if (!text || text.length < 10) return [];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Act as a strict literary editor. Analyze the following text for signs of amateur writing. 
      Specifically look for:
      1. Weak Verbs & Adverb Overuse (e.g., "ran quickly" vs "sprinted").
      2. Passive Voice (where active would be stronger).
      3. Clichés and Tired Phrases.
      4. "Telling" instead of "Showing" (abstract summaries of emotion).
      5. Repetitive sentence structure.
      
      Return a JSON array of the top 3 most critical issues. Do NOT use emojis in the suggestion or reasoning.
      
      Text to analyze: "${text.substring(0, 3000)}..."`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalText: { type: Type.STRING, description: "The exact short snippet from the text to change" },
              suggestion: { type: Type.STRING, description: "The rewritten version" },
              reasoning: { type: Type.STRING, description: "Brief explanation of the literary principle involved" },
              category: { 
                type: Type.STRING, 
                enum: ['Adverb', 'Passive Voice', 'Cliché', 'Show, Don\'t Tell', 'Structure', 'Tone'],
                description: "The type of writing issue"
              }
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
            config: {
                systemInstruction: "You are a creative writing partner. Help the user brainstorm, outline, and refine their story. Be encouraging but offer specific, high-level craft advice (pacing, character development, theme). DO NOT use emojis in your output.",
            },
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