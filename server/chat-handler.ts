import { GoogleGenAI, Type } from "@google/genai";
import type { IncomingMessage, ServerResponse } from "http";

export interface ChatRequest {
  message?: string;
  audioBase64?: string;
  audioMimeType?: string;
  history?: Array<{ role: "user" | "model"; text: string }>;
  memory?: {
    userName?: string;
    currentTopic?: string;
    memoryNotes?: string[];
  };
  isVoiceMode?: boolean;
}

export interface ChatResponseData {
  reply: string;
  userSpokenText?: string;
  detectedUserName: string;
  currentTopic: string;
  memoryNotes: string[];
}

let aiInstance: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

export function formatGeminiError(err: unknown): string {
  if (!err) return "An unexpected error occurred.";
  const rawMsg = err instanceof Error ? err.message : String(err);

  try {
    const jsonMatch = rawMsg.match(/\{[\s\S]*"error"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error) {
        const code = parsed.error.code;
        const msg = parsed.error.message || "";
        const status = parsed.error.status || "";
        if (
          code === 503 ||
          status === "UNAVAILABLE" ||
          msg.includes("high demand") ||
          msg.includes("temporarily unavailable")
        ) {
          return "Google's AI service is temporarily experiencing high demand. Please try again in a few moments.";
        }
        if (
          code === 429 ||
          status === "RESOURCE_EXHAUSTED" ||
          msg.includes("quota") ||
          msg.includes("rate limit")
        ) {
          return "Rate limit reached. Please wait a few seconds before sending another message.";
        }
        if (
          (code === 400 || code === 403) &&
          (msg.includes("API key") || msg.includes("API_KEY"))
        ) {
          return "The provided GEMINI_API_KEY appears invalid or unauthorized. Please verify your API key in Settings.";
        }
        if (msg) return msg;
      }
    }
  } catch {
    // ignore JSON parsing errors
  }

  if (
    rawMsg.includes("GEMINI_API_KEY environment variable is not set") ||
    rawMsg.includes("GEMINI_API_KEY is not set")
  ) {
    return "GEMINI_API_KEY is not configured yet. Please add your Gemini API key in Settings.";
  }
  if (
    rawMsg.includes("503") ||
    rawMsg.includes("high demand") ||
    rawMsg.includes("UNAVAILABLE")
  ) {
    return "Google's AI service is temporarily experiencing high demand. Please try again in a few moments.";
  }
  if (rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED")) {
    return "Rate limit reached. Please wait a few seconds before trying again.";
  }
  if (rawMsg.includes("API_KEY_INVALID") || rawMsg.includes("API key not valid")) {
    return "The provided GEMINI_API_KEY appears invalid. Please verify it in Settings.";
  }

  return rawMsg;
}

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not set. Please configure it in Settings."
    );
  }
  if (!aiInstance || currentApiKey !== apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
    currentApiKey = apiKey;
  }
  return aiInstance;
}

export async function processChatMessage(data: ChatRequest): Promise<ChatResponseData> {
  const { message = "", audioBase64, audioMimeType = "audio/webm", history = [], memory = {}, isVoiceMode = false } = data;
  const userName = memory.userName?.trim() || "";
  const currentTopic = memory.currentTopic?.trim() || "General conversation";
  const memoryNotes = Array.isArray(memory.memoryNotes) ? memory.memoryNotes : [];

  const systemInstruction = `You are "YahiaGPT", an intelligent, warm, attentive, and charismatic AI chatbot companion.
Your name is YahiaGPT. You speak with a natural, friendly tone, intellectual curiosity, and warmth.

ACTIVE MEMORY SYSTEM:
- User's Name: ${userName ? userName : "Not known yet (watch for it if the user introduces themselves)"}
- Current General Topic: ${currentTopic}
- Retained User Facts & Preferences: ${memoryNotes.length > 0 ? memoryNotes.join("; ") : "None recorded yet"}

RULES & MEMORY GUIDELINES:
1. Recalling Name: If the user introduces themselves or mentions their name, record it in "detectedUserName" and warmly address them by name when appropriate. If already known and not changed, keep "detectedUserName" as "${userName}".
2. Context & Topic Continuity: YahiaGPT can recall the general topic of the last few messages and the user's name. Weave previous context into your response whenever relevant so the conversation feels coherent, natural, and continuous.
3. Updating Topics: In "currentTopic", synthesize the current discussion topic (e.g., "Web Development with React", "Planning a trip to Japan", "Career Advice", "Philosophy of Artificial Intelligence").
4. Storing Memories: In "memoryNotes", maintain an updated list (up to 6 items) of important personal facts, preferences, or goals the user shared (e.g. "User is learning TypeScript", "Prefers concise code examples", "Lives in London").
5. Audio / Voice Input: If the user provided an audio recording, accurately transcribe what they said in "userSpokenText". If they provided text, set "userSpokenText" to their text message.
6. Voice-to-Voice Friendliness: ${
    isVoiceMode
      ? "Voice mode is currently ACTIVE. Keep your response conversational, concise, natural, and easy to listen to (avoid markdown tables, raw markdown syntax, code walls, or bullet overload unless specifically asked)."
      : "Provide clear, engaging, helpful answers formatted nicely with markdown when beneficial."
  }`;

  // Build multi-turn contents
  const contents: Array<{ role: string; parts: Array<any> }> = [];

  // Include up to the last 10 messages for immediate conversation context
  const recentHistory = history.slice(-10);
  for (const item of recentHistory) {
    contents.push({
      role: item.role === "user" ? "user" : "model",
      parts: [{ text: item.text }],
    });
  }

  // Construct current user parts
  const userParts: Array<any> = [];

  if (audioBase64) {
    userParts.push({
      inlineData: {
        mimeType: audioMimeType,
        data: audioBase64,
      },
    });
  }

  if (message.trim()) {
    userParts.push({ text: message.trim() });
  } else if (!audioBase64) {
    userParts.push({ text: "Hello YahiaGPT!" });
  }

  contents.push({
    role: "user",
    parts: userParts,
  });

  const ai = getGenAI();

  // Robust candidate models in priority order:
  // If gemini-3.8-flash experiences high demand spikes (HTTP 503), it immediately falls back to gemini-3.1-flash-lite
  const CANDIDATE_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
  ];

  let rawText = "";
  let lastError: unknown = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: "YahiaGPT's verbal/textual response to the user.",
              },
              userSpokenText: {
                type: Type.STRING,
                description: "If user sent audio, the transcription of what they spoke. Otherwise their input text.",
              },
              detectedUserName: {
                type: Type.STRING,
                description: "The user's identified name, or existing name, or empty string if unknown.",
              },
              currentTopic: {
                type: Type.STRING,
                description: "A concise 2-5 word label of the active discussion topic.",
              },
              memoryNotes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of retained user facts, preferences, or ongoing conversational context.",
              },
            },
            required: ["reply", "detectedUserName", "currentTopic", "memoryNotes"],
          },
        },
      });

      if (response && response.text) {
        rawText = response.text;
        break; // Successfully generated content!
      }
    } catch (err: unknown) {
      console.warn(`Model "${modelName}" failed during generation:`, err);
      lastError = err;
      const errStr = String(err);
      // Check if it's a transient overload (503 / 429 / 500)
      const isTransient =
        errStr.includes("503") ||
        errStr.includes("UNAVAILABLE") ||
        errStr.includes("high demand") ||
        errStr.includes("429") ||
        errStr.includes("RESOURCE_EXHAUSTED") ||
        errStr.includes("500") ||
        errStr.includes("Internal error");

      if (!isTransient) {
        // Fatal error (e.g. invalid credentials) - no need to burn other models
        throw err;
      }
      // Brief pause before fallback attempt
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  if (!rawText) {
    throw lastError || new Error("Unable to obtain a response from Gemini service.");
  }

  try {
    const parsed = JSON.parse(rawText) as ChatResponseData;
    return {
      reply: parsed.reply || "I'm here to help!",
      userSpokenText: parsed.userSpokenText || message,
      detectedUserName: parsed.detectedUserName || userName,
      currentTopic: parsed.currentTopic || currentTopic,
      memoryNotes: Array.isArray(parsed.memoryNotes) ? parsed.memoryNotes : memoryNotes,
    };
  } catch (err) {
    console.error("Failed to parse JSON response from Gemini:", rawText, err);
    return {
      reply: rawText,
      userSpokenText: message,
      detectedUserName: userName,
      currentTopic,
      memoryNotes,
    };
  }
}

export function handleChatHttpRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}") as ChatRequest;
      if (!data.message && !data.audioBase64) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Either a message string or audioBase64 is required" }));
        return;
      }

      const result = await processChatMessage(data);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (err: unknown) {
      console.error("Error processing chat message:", err);
      const cleanError = formatGeminiError(err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: cleanError }));
    }
  });
}
