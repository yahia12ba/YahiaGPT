import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  Phone,
} from "lucide-react";
import type { Message, MemoryState, VoiceSettings } from "./types";
import {
  createSpeechRecognizer,
  speakText,
  stopSpeaking,
  unlockAudioContext,
  startAudioRecording,
  stopAudioRecording,
  isSpeechRecognitionSupported,
  isInIframe,
  getAvailableVoices,
  getBestMaleVoice,
} from "./utils/speech";
import { ChatMessage } from "./components/ChatMessage";
import { VoiceModal } from "./components/VoiceModal";
import { boyIdleImg } from "./assets/avatar";

// Background image of the World Trade Center towers
import wtcBgImage from "./assets/images/wtc_towers_bg_1790050779198.jpg";

const STORAGE_KEY_MESSAGES = "yahiagpt_chat_messages_v3";
const STORAGE_KEY_MEMORY = "yahiagpt_chat_memory_v3";
const STORAGE_KEY_SETTINGS = "yahiagpt_chat_settings_v3";
const STORAGE_KEY_BG_DIM = "yahiagpt_chat_bg_dim_v3";

const INITIAL_MESSAGE: Message = {
  id: "welcome-yahiagpt-1",
  role: "model",
  text: "Hello! I am YahiaGPT, your conversational AI companion. I have an active memory system—tell me your name, explore any topic, and I will remember our context as we talk. Voice-to-voice is ready: tap the microphone or click Voice Call anytime to speak with me!",
  timestamp: Date.now(),
  currentTopic: "Introduction & greetings",
};

export default function App() {
  // Chat & Memory State
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MESSAGES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Error reading saved messages:", e);
    }
    return [INITIAL_MESSAGE];
  });

  const [memory, setMemory] = useState<MemoryState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MEMORY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error reading saved memory:", e);
    }
    return {
      userName: "",
      currentTopic: "Introduction & greetings",
      memoryNotes: [],
    };
  });

  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error reading voice settings:", e);
    }
    return {
      autoSpeak: true, // Default to true so voice response plays automatically
      continuousMode: true,
      voiceURI: "",
      rate: 1.0,
      pitch: 1.0,
    };
  });

  // Background visual settings
  const [bgDimLevel, setBgDimLevel] = useState<"standard" | "vibrant" | "dark">(() => {
    const saved = localStorage.getItem(STORAGE_KEY_BG_DIM);
    if (saved === "vibrant" || saved === "dark" || saved === "standard") return saved;
    return "standard";
  });

  // UI & Active States
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  // Modals
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Voice-to-Voice state tracking
  const [lastUserSpeech, setLastUserSpeech] = useState("");
  const [lastAiSpeech, setLastAiSpeech] = useState("");

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const speechRecognizerRef = useRef<any>(null);
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const isVoiceModalOpenRef = useRef(isVoiceModalOpen);
  isVoiceModalOpenRef.current = isVoiceModalOpen;
  const isListeningRef = useRef(isListening);
  isListeningRef.current = isListening;

  const inIframe = isInIframe();

  // Persist State
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MEMORY, JSON.stringify(memory));
  }, [memory]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(voiceSettings));
  }, [voiceSettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BG_DIM, bgDimLevel);
  }, [bgDimLevel]);

  // Automatically detect and set the best natural male voice
  useEffect(() => {
    getAvailableVoices().then((voices) => {
      const maleVoice = getBestMaleVoice(voices);
      if (maleVoice) {
        setVoiceSettings((prev) => ({
          ...prev,
          voiceURI: maleVoice.voiceURI,
          pitch: 0.92,
        }));
      }
    });
  }, []);

  // Auto-scroll chat to bottom
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, interimTranscript, scrollToBottom]);

  // Stop any active speech
  const handleStopSpeaking = useCallback(() => {
    if (cancelSpeechRef.current) {
      cancelSpeechRef.current();
      cancelSpeechRef.current = null;
    }
    stopSpeaking();
    setIsSpeaking(false);
    setCurrentSpeakingId(null);
  }, []);

  // Voice playback of text
  const handleSpeakMessage = useCallback(
    (messageId: string, text: string, onDone?: () => void) => {
      unlockAudioContext();
      handleStopSpeaking();
      setCurrentSpeakingId(messageId);
      setIsSpeaking(true);

      cancelSpeechRef.current = speakText(text, {
        voiceURI: voiceSettings.voiceURI,
        rate: voiceSettings.rate,
        pitch: voiceSettings.pitch,
        onStart: () => {
          setIsSpeaking(true);
        },
        onEnd: () => {
          setIsSpeaking(false);
          setCurrentSpeakingId(null);
          cancelSpeechRef.current = null;
          onDone?.();
        },
        onError: (err) => {
          console.warn("Speech playback error:", err);
          setIsSpeaking(false);
          setCurrentSpeakingId(null);
          cancelSpeechRef.current = null;
          onDone?.();
        },
      });
    },
    [handleStopSpeaking, voiceSettings]
  );

  // Quick audio test
  const handleQuickAudioTest = useCallback(() => {
    unlockAudioContext();
    handleStopSpeaking();
    setIsTestingVoice(true);
    speakText("Hello! I am YahiaGPT. Your voice audio is working properly.", {
      voiceURI: voiceSettings.voiceURI,
      rate: voiceSettings.rate,
      pitch: voiceSettings.pitch,
      onEnd: () => setIsTestingVoice(false),
      onError: () => setIsTestingVoice(false),
    });
  }, [handleStopSpeaking, voiceSettings]);

  // Send message to YahiaGPT (handles text and voice inputs)
  const handleSendMessage = useCallback(
    async (
      textToSend?: string,
      fromVoiceMode = false,
      audioPayload?: { base64: string; mimeType: string } | null
    ) => {
      unlockAudioContext();
      const content = (textToSend ?? inputText).trim();

      // We need either text content or an audio recording payload
      if (!content && !audioPayload) return;
      if (isLoading) return;

      if (!textToSend && !audioPayload) {
        setInputText("");
      }
      setErrorMessage(null);

      const placeholderText = content || "🎙️ [Spoken Audio Message]";
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        text: placeholderText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLastUserSpeech(content || "Voice recording");
      setIsLoading(true);

      try {
        const historyPayload = messages.slice(-8).map((m) => ({
          role: m.role,
          text: m.text,
        }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: content,
            audioBase64: audioPayload?.base64,
            audioMimeType: audioPayload?.mimeType,
            history: historyPayload,
            memory: {
              userName: memory.userName,
              currentTopic: memory.currentTopic,
              memoryNotes: memory.memoryNotes,
            },
            isVoiceMode: fromVoiceMode || isVoiceModalOpenRef.current,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with ${response.status}`);
        }

        const data = await response.json();

        // If user sent voice audio, update the user's message with transcribed words
        if (data.userSpokenText && (!content || content.startsWith("🎙️"))) {
          setMessages((prev) =>
            prev.map((m) => (m.id === userMsg.id ? { ...m, text: data.userSpokenText } : m))
          );
          setLastUserSpeech(data.userSpokenText);
        }

        const yahiagptMsg: Message = {
          id: `yahiagpt-${Date.now()}`,
          role: "model",
          text: data.reply || "I am here.",
          timestamp: Date.now(),
          detectedUserName: data.detectedUserName || memory.userName,
          currentTopic: data.currentTopic || memory.currentTopic,
          memoryNotes: data.memoryNotes || memory.memoryNotes,
        };

        setMessages((prev) => [...prev, yahiagptMsg]);
        setLastAiSpeech(data.reply);

        // Update memory state
        setMemory((prev) => ({
          userName: data.detectedUserName?.trim() || prev.userName,
          currentTopic: data.currentTopic?.trim() || prev.currentTopic,
          memoryNotes: Array.isArray(data.memoryNotes) ? data.memoryNotes : prev.memoryNotes,
        }));

        // Voice playback handling: if in Voice Mode or autoSpeak is on
        const shouldSpeak = fromVoiceMode || isVoiceModalOpenRef.current || voiceSettings.autoSpeak;
        if (shouldSpeak && data.reply) {
          handleSpeakMessage(yahiagptMsg.id, data.reply, () => {
            // Callback when YahiaGPT finishes speaking:
            // If in Voice Mode and continuousMode is ON, re-arm microphone automatically!
            if (isVoiceModalOpenRef.current && voiceSettings.continuousMode) {
              setTimeout(() => {
                startListening();
              }, 450);
            }
          });
        }
      } catch (err: unknown) {
        console.error("Chat error:", err);
        const rawMsg = err instanceof Error ? err.message : "Failed to connect to YahiaGPT.";

        // Clean parse if it happens to be raw JSON from backend
        let cleanMsg = rawMsg;
        try {
          const match = rawMsg.match(/\{[\s\S]*"error"[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            cleanMsg = parsed?.error?.message || cleanMsg;
          }
        } catch {
          // keep cleanMsg
        }

        setErrorMessage(cleanMsg);

        let guidance = "";
        const lower = cleanMsg.toLowerCase();
        if (
          lower.includes("gemini_api_key") ||
          lower.includes("api key not valid") ||
          lower.includes("api key is not set")
        ) {
          guidance = " Please check that your GEMINI_API_KEY is configured in Settings.";
        } else if (
          lower.includes("high demand") ||
          lower.includes("busy") ||
          lower.includes("temporarily")
        ) {
          guidance = " The server has enabled fast fallback. Click Retry to re-run your request smoothly!";
        }

        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          role: "model",
          text: `⚠️ I encountered an issue: ${cleanMsg}.${guidance ? `\n\n${guidance}` : ""}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputText, isLoading, messages, memory, voiceSettings, handleSpeakMessage]
  );

  // Retry a message that failed
  const handleRetryMessage = useCallback(
    (errorMsgId: string) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === errorMsgId);
        if (idx === -1) return prev;

        // Find the user message before this error
        const userMsg = prev
          .slice(0, idx)
          .reverse()
          .find((m) => m.role === "user");
        const textToRetry = userMsg ? userMsg.text : "";

        // Remove error message from the chat list
        const next = prev.filter((m) => m.id !== errorMsgId);

        setErrorMessage(null);
        if (textToRetry && !textToRetry.startsWith("🎙️")) {
          setTimeout(() => {
            handleSendMessage(textToRetry);
          }, 60);
        } else if (lastUserSpeech) {
          setTimeout(() => {
            handleSendMessage(lastUserSpeech);
          }, 60);
        }

        return next;
      });
    },
    [handleSendMessage, lastUserSpeech]
  );

  // Stop listening and finalize audio/transcript
  const stopListening = useCallback(async () => {
    if (!isListeningRef.current) return;
    setIsListening(false);

    if (speechRecognizerRef.current) {
      try {
        speechRecognizerRef.current.abort();
      } catch (e) {
        // ignore
      }
      speechRecognizerRef.current = null;
    }

    // Stop and retrieve recorded audio
    try {
      const audioResult = await stopAudioRecording();
      const currentInterim = interimTranscript.trim();
      setInterimTranscript("");

      if (currentInterim) {
        // We have text from speech recognition
        handleSendMessage(currentInterim, isVoiceModalOpenRef.current);
      } else if (audioResult && audioResult.base64) {
        // We have raw audio from MediaRecorder
        handleSendMessage("", isVoiceModalOpenRef.current, audioResult);
      }
    } catch (err) {
      console.warn("Error finalizing audio recording:", err);
    }
  }, [interimTranscript, handleSendMessage]);

  // Start listening (Speech-to-Text & MediaRecorder dual pipeline)
  const startListening = useCallback(async () => {
    unlockAudioContext();
    handleStopSpeaking();

    // If already listening, stop
    if (isListeningRef.current) {
      await stopListening();
      return;
    }

    setErrorMessage(null);
    setInterimTranscript("");

    // 1. Start audio recording via MediaRecorder (universal fallback)
    try {
      await startAudioRecording();
      setIsListening(true);
    } catch (micErr: any) {
      console.error("Microphone capture failed:", micErr);
      setErrorMessage(
        inIframe
          ? "Microphone access blocked in preview frame. Click 'Open in New Tab' above to talk freely!"
          : micErr.message || "Microphone access was denied. Please allow microphone permission."
      );
      setIsListening(false);
      return;
    }

    // 2. Start SpeechRecognition if supported (for instant live transcription on screen)
    if (isSpeechRecognitionSupported()) {
      const recognizer = createSpeechRecognizer({
        onStart: () => {
          setIsListening(true);
        },
        onResult: (transcript, isFinal) => {
          if (isFinal) {
            setInterimTranscript("");
            setIsListening(false);
            stopAudioRecording().catch(() => null);
            handleSendMessage(transcript, isVoiceModalOpenRef.current);
          } else {
            setInterimTranscript(transcript);
          }
        },
        onError: (err) => {
          console.warn("Speech recognition note:", err);
          // Don't kill listening yet—MediaRecorder is still capturing raw audio!
        },
        onEnd: () => {
          // If ended without final, user can tap stop to submit audio
        },
      });

      if (recognizer) {
        speechRecognizerRef.current = recognizer;
        try {
          recognizer.start();
        } catch (err) {
          console.warn("Speech recognizer start caught:", err);
        }
      }
    }
  }, [handleStopSpeaking, stopListening, handleSendMessage, inIframe]);

  const handleResetChat = () => {
    handleStopSpeaking();
    stopListening();
    setMessages([INITIAL_MESSAGE]);
  };

  return (
    <div id="yahiagpt-chatbot-root" className="relative flex flex-col h-screen text-slate-100 font-sans overflow-hidden bg-slate-950">
      {/* 🏙️ World Trade Center Towers Background Layer */}
      <div
        id="wtc-towers-background"
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-500 pointer-events-none select-none"
        style={{
          backgroundImage: `url(${wtcBgImage})`,
        }}
      >
        {/* Transparent dark overlay for crisp messaging contrast */}
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-950/80 pointer-events-none" />
      </div>

      {/* Messaging App Header */}
      <header
        id="app-header"
        className="relative shrink-0 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5 shadow-md z-30"
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Contact Profile (YahiaGPT) */}
          <div className="flex items-center gap-3">
            <button
              id="yahiagpt-status-avatar"
              type="button"
              onClick={() => {
                unlockAudioContext();
                setIsVoiceModalOpen(true);
                startListening();
              }}
              className="relative w-10 h-10 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center font-bold text-sm shadow-md ring-1 ring-slate-700 overflow-hidden cursor-pointer"
              title="Tap to talk with YahiaGPT in Voice Mode"
              aria-label="Open Voice Call with YahiaGPT"
            >
              <img
                src={boyIdleImg}
                alt="YahiaGPT"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                  isSpeaking
                    ? "bg-amber-400 animate-ping"
                    : isListening
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-emerald-500"
                }`}
                title={isSpeaking ? "Speaking" : isListening ? "Listening" : "Online"}
              />
            </button>

            <div>
              <h1 className="text-sm font-semibold text-white tracking-tight leading-tight">YahiaGPT</h1>
              <p className="text-[11px] text-slate-400 leading-tight flex items-center gap-1">
                {isSpeaking ? (
                  <span className="text-amber-400 font-medium animate-pulse">speaking aloud...</span>
                ) : isListening ? (
                  <span className="text-emerald-400 font-medium animate-pulse">listening...</span>
                ) : isLoading ? (
                  <span className="text-amber-300 font-medium">typing...</span>
                ) : (
                  <span className="text-emerald-400 font-medium">online</span>
                )}
              </p>
            </div>
          </div>

          {/* Minimal Controls: Voice Call, Audio Toggle & Clear Chat */}
          <div className="flex items-center gap-1">
            {/* Call Button for Voice Mode */}
            <button
              id="btn-voice-call-mode"
              type="button"
              onClick={() => {
                unlockAudioContext();
                setIsVoiceModalOpen(true);
                startListening();
              }}
              className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              title="Voice Call (Talk with Funko YahiaGPT)"
              aria-label="Start voice call"
            >
              <Phone className="w-4 h-4" />
            </button>

            <button
              id="btn-toggle-auto-speak"
              type="button"
              onClick={() => {
                if (isSpeaking) handleStopSpeaking();
                setVoiceSettings((prev) => ({ ...prev, autoSpeak: !prev.autoSpeak }));
              }}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                voiceSettings.autoSpeak
                  ? "text-amber-400 hover:bg-slate-800"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
              }`}
              title={
                voiceSettings.autoSpeak
                  ? "Voice responses: Active (tap to mute)"
                  : "Voice responses: Muted (tap to unmute)"
              }
              aria-label="Toggle voice responses"
            >
              {voiceSettings.autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              id="btn-reset-chat"
              type="button"
              onClick={handleResetChat}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              title="Clear chat"
              aria-label="Clear chat"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Error / Notice Banner (if any) */}
      {errorMessage && (
        <div
          id="error-banner"
          className="relative z-20 bg-amber-950/90 border-b border-amber-800/80 px-4 py-2 text-xs text-amber-200 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 max-w-3xl mx-auto w-full">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="truncate">{errorMessage}</span>
            {inIframe && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-slate-950 font-bold rounded text-[11px] hover:bg-amber-400 shrink-0"
              >
                <span>Open in Tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-amber-400 hover:text-white p-1 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Messaging Stream */}
      <main
        id="chat-scroll-container"
        ref={chatContainerRef}
        className="relative z-10 flex-1 overflow-y-auto px-3 sm:px-4 py-4"
      >
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Chat Messages */}
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              currentSpeakingId={currentSpeakingId}
              onSpeak={handleSpeakMessage}
              onStopSpeaking={handleStopSpeaking}
              onRetry={
                message.id.startsWith("error-")
                  ? () => handleRetryMessage(message.id)
                  : undefined
              }
              currentUserName={memory.userName}
            />
          ))}

          {/* Typing Indicator (Messaging app style) */}
          {isLoading && (
            <div className="flex items-center gap-2 py-1">
              <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-800 shrink-0 border border-slate-700 shadow-xs">
                <img
                  src={boyIdleImg}
                  alt="YahiaGPT"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-sm flex items-center gap-1.5 text-slate-400 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}

          {/* Live speech transcription bubble while speaking */}
          {isListening && (
            <div className="flex justify-end py-1">
              <div className="bg-emerald-600/90 text-white rounded-2xl rounded-tr-xs px-3.5 py-2 text-xs flex items-center gap-2 shadow-md animate-pulse">
                <Mic className="w-3.5 h-3.5 text-emerald-200 animate-bounce" />
                <span>{interimTranscript || "Listening... Tap mic to send"}</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Messaging Input Bar with Exactly 1 Voice Button */}
      <footer
        id="app-input-bar"
        className="relative z-20 shrink-0 bg-slate-950/85 backdrop-blur-md border-t border-slate-800/80 px-3 sm:px-4 py-2.5 shadow-2xl"
      >
        <div className="max-w-3xl mx-auto">
          {/* Active Speaking Indicator Bar (if YahiaGPT is speaking) */}
          {isSpeaking && (
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-xs text-amber-300">
              <div className="flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                <span className="text-[12px]">YahiaGPT is speaking...</span>
              </div>
              <button
                type="button"
                onClick={handleStopSpeaking}
                className="text-slate-400 hover:text-white font-medium underline text-[11px] cursor-pointer"
              >
                Stop Audio
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Single Rounded Message Input Field */}
            <div className="relative flex-1">
              <input
                id="chat-text-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isListening
                    ? "Listening... Speak now or tap mic to send"
                    : "Message..."
                }
                disabled={isLoading}
                className="w-full bg-slate-900/90 border border-slate-700/80 focus:border-emerald-500 rounded-full px-4 py-2.5 text-[14px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
              />
            </div>

            {/* If user typed text, show Send button; otherwise show 1 Voice Button */}
            {inputText.trim() ? (
              <button
                id="send-message-btn"
                type="submit"
                disabled={isLoading}
                className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center shrink-0 shadow-md transition-all cursor-pointer"
                title="Send message"
                aria-label="Send message"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            ) : (
              /* 1 Voice Button: Displays current activity (Listening vs Mic Ready) */
              <button
                id="single-voice-btn"
                type="button"
                onClick={() => {
                  unlockAudioContext();
                  if (isListening) {
                    stopListening();
                  } else {
                    startListening();
                  }
                }}
                className={`h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md select-none ${
                  isListening
                    ? "px-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-4 ring-emerald-400/40 shadow-emerald-500/30 gap-1.5"
                    : "w-10 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white"
                }`}
                title={isListening ? "Status: Listening to your voice" : "Status: Microphone ready"}
                aria-label={isListening ? "Status: Listening to your voice" : "Status: Microphone ready"}
              >
                <Mic className={`w-5 h-5 ${isListening ? "animate-pulse text-slate-950" : "text-white"}`} />
                {isListening && (
                  <span className="flex items-center gap-1 text-xs font-bold text-slate-950">
                    <span>Listening</span>
                    <span className="flex items-end gap-0.5 h-3 ml-0.5">
                      <span className="w-0.5 h-2 bg-slate-950 rounded-full animate-bounce" />
                      <span className="w-0.5 h-3 bg-slate-950 rounded-full animate-bounce [animation-delay:0.15s]" />
                      <span className="w-0.5 h-1.5 bg-slate-950 rounded-full animate-bounce [animation-delay:0.3s]" />
                    </span>
                  </span>
                )}
              </button>
            )}
          </form>
        </div>
      </footer>

      {/* Voice Call Mode featuring the Funko Pop Boy character */}
      <VoiceModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        memory={memory}
        isListening={isListening}
        isSpeaking={isSpeaking}
        isLoading={isLoading}
        interimTranscript={interimTranscript}
        lastUserSpeech={lastUserSpeech}
        lastAiSpeech={lastAiSpeech}
        continuousMode={voiceSettings.continuousMode}
        errorMessage={errorMessage}
        onToggleContinuous={() =>
          setVoiceSettings((prev) => ({ ...prev, continuousMode: !prev.continuousMode }))
        }
        onStartListening={startListening}
        onStopListening={stopListening}
        onStopSpeaking={handleStopSpeaking}
        onTestVoice={handleQuickAudioTest}
      />
    </div>
  );
}
