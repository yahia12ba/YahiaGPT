import React, { useEffect, useState } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  RefreshCw,
  PhoneOff,
  Radio,
  ExternalLink,
} from "lucide-react";
import type { MemoryState } from "../types";
import { isInIframe, unlockAudioContext } from "../utils/speech";
import { boyIdleImg, boyTalkImg } from "../assets/avatar";

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory: MemoryState;
  isListening: boolean;
  isSpeaking: boolean;
  isLoading: boolean;
  interimTranscript: string;
  lastUserSpeech: string;
  lastAiSpeech: string;
  continuousMode: boolean;
  errorMessage?: string | null;
  onToggleContinuous: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  onTestVoice?: () => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  memory,
  isListening,
  isSpeaking,
  isLoading,
  interimTranscript,
  lastUserSpeech,
  lastAiSpeech,
  continuousMode,
  errorMessage,
  onToggleContinuous,
  onStartListening,
  onStopListening,
  onStopSpeaking,
  onTestVoice,
}) => {
  const [pulseCount, setPulseCount] = useState(0);
  const [mouthToggle, setMouthToggle] = useState(false);

  // Animation pulse for talking and listening
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSpeaking) {
      interval = setInterval(() => {
        setPulseCount((c) => (c + 1) % 100);
        // Alternate mouth slightly while speaking for lively Funko animation
        setMouthToggle((prev) => !prev);
      }, 220);
    } else if (isListening) {
      interval = setInterval(() => {
        setPulseCount((c) => (c + 1) % 100);
      }, 180);
    }
    return () => clearInterval(interval);
  }, [isListening, isSpeaking]);

  if (!isOpen) return null;

  const inIframe = isInIframe();

  // Active character image: while YahiaGPT is speaking, show the talking character; otherwise idle character
  const activeCharacterImage = isSpeaking ? (mouthToggle ? boyTalkImg : boyIdleImg) : boyIdleImg;

  const getStatusText = () => {
    if (isLoading) return "YahiaGPT is thinking...";
    if (isSpeaking) return "YahiaGPT is speaking...";
    if (isListening) return "YahiaGPT is listening to your voice...";
    return "Microphone is ready";
  };

  return (
    <div
      id="voice-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-3 sm:p-6 animate-in fade-in duration-200"
    >
      <div
        id="voice-modal-card"
        className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 flex flex-col items-center text-white relative overflow-hidden"
      >
        {/* Top Call Bar */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isSpeaking ? "bg-amber-400" : isListening ? "bg-emerald-400" : "bg-emerald-500"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isSpeaking ? "bg-amber-400" : isListening ? "bg-emerald-400" : "bg-emerald-500"
                }`}
              />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Voice Call • YahiaGPT
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onTestVoice && (
              <button
                type="button"
                onClick={onTestVoice}
                className="text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-full border border-slate-700/80 transition-colors cursor-pointer"
                title="Verify speaker sound"
              >
                Test Audio
              </button>
            )}

            <button
              id="voice-modal-close-btn"
              type="button"
              onClick={() => {
                onStopListening();
                onStopSpeaking();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close voice call"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Character Stage: Funko Pop Boy (Harry Potter-like, curly hair, round glasses, no scar, casual clothes) */}
        <div className="relative my-5 sm:my-7 flex flex-col items-center justify-center">
          {/* Ambient Glow & Concentric Sound Waves */}
          {isSpeaking && (
            <>
              <div
                className="absolute rounded-full bg-amber-500/15 blur-xl transition-all duration-300 pointer-events-none"
                style={{
                  width: `${210 + (pulseCount % 4) * 15}px`,
                  height: `${210 + (pulseCount % 4) * 15}px`,
                }}
              />
              <div
                className="absolute rounded-full border border-amber-500/30 transition-all duration-300 pointer-events-none"
                style={{
                  width: `${200 + (pulseCount % 5) * 12}px`,
                  height: `${200 + (pulseCount % 5) * 12}px`,
                  transform: `scale(${1 + (pulseCount % 4) * 0.05})`,
                }}
              />
              <div
                className="absolute rounded-full border border-amber-400/20 transition-all duration-500 pointer-events-none"
                style={{
                  width: `${230 + (pulseCount % 6) * 14}px`,
                  height: `${230 + (pulseCount % 6) * 14}px`,
                }}
              />
            </>
          )}

          {isListening && (
            <>
              <div
                className="absolute rounded-full bg-emerald-500/15 blur-xl transition-all duration-300 pointer-events-none"
                style={{
                  width: `${210 + (pulseCount % 4) * 12}px`,
                  height: `${210 + (pulseCount % 4) * 12}px`,
                }}
              />
              <div
                className="absolute rounded-full border border-emerald-500/40 animate-ping pointer-events-none"
                style={{
                  width: "190px",
                  height: "190px",
                }}
              />
            </>
          )}

          {/* Central Character Avatar Container */}
          <div
            className={`relative z-10 w-40 h-40 sm:w-48 sm:h-48 rounded-full p-1.5 transition-all duration-300 ${
              isSpeaking
                ? "ring-4 ring-amber-400/80 shadow-2xl shadow-amber-500/30 scale-105"
                : isListening
                ? "ring-4 ring-emerald-400/80 shadow-2xl shadow-emerald-500/30 scale-105"
                : isLoading
                ? "ring-2 ring-amber-400/40 animate-pulse"
                : "ring-2 ring-slate-700/80 shadow-lg"
            }`}
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 shadow-inner flex items-center justify-center">
              <img
                src={activeCharacterImage}
                alt="YahiaGPT Funko Boy"
                referrerPolicy="no-referrer"
                className={`w-full h-full object-cover select-none transition-transform duration-200 ${
                  isSpeaking ? "scale-105" : "scale-100"
                }`}
              />
            </div>

            {/* Speaking equalizer badge */}
            {isSpeaking && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-500 text-slate-950 text-[11px] font-bold rounded-full shadow-lg flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-slate-950 rounded-full animate-bounce" />
                <span className="w-1.5 h-4 bg-slate-950 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-2.5 bg-slate-950 rounded-full animate-bounce [animation-delay:0.3s]" />
                <span>Talking</span>
              </div>
            )}

            {/* Listening mic badge */}
            {isListening && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-slate-950 text-[11px] font-bold rounded-full shadow-lg flex items-center gap-1.5 animate-pulse">
                <Mic className="w-3.5 h-3.5" />
                <span>Listening</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Headline */}
        <p className="text-sm font-medium text-slate-300 text-center tracking-wide mb-3 flex items-center gap-2">
          {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />}
          <span>{getStatusText()}</span>
        </p>

        {/* Live Subtitle Bubbles (Spoken dialogue) */}
        <div className="w-full space-y-2 my-2 min-h-[90px]">
          {/* User live speech transcript */}
          {(isListening || interimTranscript || lastUserSpeech) && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-2xl text-left">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block mb-1">
                You {isListening ? "(Speaking...)" : "said"}
              </span>
              <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed">
                {interimTranscript || lastUserSpeech || (isListening ? "Listening to your voice..." : "...")}
              </p>
            </div>
          )}

          {/* YahiaGPT's spoken reply */}
          {(isSpeaking || lastAiSpeech) && (
            <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-2xl text-left">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>YahiaGPT {isSpeaking ? "speaking" : "said"}</span>
              </span>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-h-24 overflow-y-auto pr-1">
                {lastAiSpeech}
              </p>
            </div>
          )}
        </div>

        {/* Iframe Warning if mic is blocked */}
        {inIframe && errorMessage && (
          <div className="w-full my-2 p-2.5 bg-amber-950/80 border border-amber-700/80 rounded-xl text-amber-200 text-xs flex items-center justify-between gap-2">
            <span>Microphone blocked in preview?</span>
            <a
              href={window.location.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded-md text-[11px] hover:bg-amber-400 shrink-0"
            >
              <span>Open in Tab</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Call Controls Bar: Mic Status Button, Stop Audio, End Call */}
        <div className="w-full flex items-center justify-center gap-6 pt-4 mt-2 border-t border-slate-800/80">
          {/* Mic Status Button: Displays what it is doing (Listening vs Mic Ready) */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              id="voice-call-mic-btn"
              type="button"
              onClick={() => {
                unlockAudioContext();
                if (isListening) {
                  onStopListening();
                } else {
                  onStartListening();
                }
              }}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                isListening
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-4 ring-emerald-400/40 shadow-emerald-500/30 scale-105"
                  : "bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-md"
              }`}
              title={isListening ? "Status: Listening to your voice" : "Status: Microphone ready"}
              aria-label={isListening ? "Status: Listening to your voice" : "Status: Microphone ready"}
            >
              <Mic className={`w-6 h-6 ${isListening ? "animate-pulse" : ""}`} />
            </button>
            <span className="text-[11px] font-semibold text-slate-300">
              {isListening ? "Listening..." : "Mic Ready"}
            </span>
          </div>

          {/* Stop Audio Button (if YahiaGPT is speaking) */}
          {isSpeaking && (
            <div className="flex flex-col items-center gap-1.5">
              <button
                id="voice-call-stop-audio-btn"
                type="button"
                onClick={onStopSpeaking}
                className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg transition-all cursor-pointer"
                title="Status: YahiaGPT is speaking"
                aria-label="Status: YahiaGPT is speaking"
              >
                <Volume2 className="w-6 h-6 animate-pulse" />
              </button>
              <span className="text-[11px] font-semibold text-amber-300">Speaking...</span>
            </div>
          )}

          {/* End Call Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              id="voice-call-end-btn"
              type="button"
              onClick={() => {
                onStopListening();
                onStopSpeaking();
                onClose();
              }}
              className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              title="End call"
              aria-label="End call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-[11px] font-semibold text-rose-300">End Call</span>
          </div>
        </div>

        {/* Continuous conversation toggle */}
        <div className="mt-4 flex items-center justify-center">
          <button
            type="button"
            onClick={onToggleContinuous}
            className={`text-[11px] px-3 py-1 rounded-full border transition-colors cursor-pointer flex items-center gap-1.5 ${
              continuousMode
                ? "bg-emerald-950/60 border-emerald-700/80 text-emerald-300"
                : "bg-slate-800/60 border-slate-700 text-slate-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                continuousMode ? "bg-emerald-400" : "bg-slate-500"
              }`}
            />
            <span>Hands-free Conversation: {continuousMode ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
