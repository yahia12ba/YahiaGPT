import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Volume2, VolumeX, Copy, Check, RotateCcw, CheckCheck } from "lucide-react";
import type { Message } from "../types";
import { unlockAudioContext } from "../utils/speech";
import { boyIdleImg } from "../assets/avatar";

interface ChatMessageProps {
  message: Message;
  currentSpeakingId: string | null;
  onSpeak: (messageId: string, text: string) => void;
  onStopSpeaking: () => void;
  onRetry?: () => void;
  currentUserName?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  currentSpeakingId,
  onSpeak,
  onStopSpeaking,
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);
  const isSpeakingThis = currentSpeakingId === message.id;
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeak = () => {
    unlockAudioContext();
    if (isSpeakingThis) {
      onStopSpeaking();
    } else {
      onSpeak(message.id, message.text);
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      id={`message-${message.id}`}
      className={`w-full flex gap-2.5 ${isUser ? "justify-end" : "justify-start"} py-1.5`}
    >
      {/* Bot Mini Avatar */}
      {!isUser && (
        <div
          id={`avatar-yahiagpt-${message.id}`}
          className="w-7 h-7 rounded-full overflow-hidden bg-slate-800 shrink-0 shadow-sm border border-slate-700 mt-0.5"
          title="YahiaGPT"
        >
          <img
            src={boyIdleImg}
            alt="YahiaGPT"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Message Bubble Container */}
      <div
        className={`relative max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 shadow-md transition-all ${
          isUser
            ? "bg-emerald-600/90 text-white rounded-2xl rounded-tr-xs"
            : message.id.startsWith("error-")
            ? "bg-amber-950/80 text-amber-100 border border-amber-600/60 rounded-2xl rounded-tl-xs"
            : "bg-slate-900/90 backdrop-blur-md text-slate-100 border border-slate-700/60 rounded-2xl rounded-tl-xs"
        }`}
      >
        {/* Message body */}
        <div className="text-[13.5px] sm:text-sm leading-relaxed break-words">
          {isUser ? (
            <p className="whitespace-pre-wrap m-0">{message.text}</p>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed text-slate-100">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5 text-slate-200">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5 text-slate-200">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  return isBlock ? (
                    <pre className="bg-slate-950/90 text-slate-200 p-2.5 rounded-lg text-xs overflow-x-auto my-1.5 border border-slate-800">
                      <code>{children}</code>
                    </pre>
                  ) : (
                    <code className="bg-slate-800/80 text-amber-300 px-1 py-0.5 rounded text-xs font-mono border border-slate-700/60">
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.text}
            </ReactMarkdown>
          )}
        </div>

        {/* Messaging app metadata footer (time, listen, copy, checks) */}
        <div
          className={`flex items-center gap-1.5 mt-1 pt-0.5 text-[10px] select-none ${
            isUser ? "justify-end text-emerald-100/70" : "justify-end text-slate-400"
          }`}
        >
          {onRetry && (
            <button
              id={`retry-btn-${message.id}`}
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 font-medium transition-colors cursor-pointer mr-auto"
              title="Retry"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}

          {!isUser && !message.id.startsWith("error-") && (
            <button
              id={`speak-btn-${message.id}`}
              type="button"
              onClick={handleToggleSpeak}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors ${
                isSpeakingThis ? "text-amber-400 font-semibold" : "hover:text-slate-200"
              }`}
              title={isSpeakingThis ? "Stop audio" : "Play voice"}
            >
              {isSpeakingThis ? (
                <>
                  <VolumeX className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span className="text-[9px]">Stop</span>
                </>
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
            </button>
          )}

          {!isUser && (
            <button
              id={`copy-btn-${message.id}`}
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center px-1.5 py-0.5 rounded hover:bg-slate-800 hover:text-slate-200 transition-colors"
              title="Copy"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          )}

          <span>{formatTime(message.timestamp)}</span>
          {isUser && <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />}
        </div>
      </div>
    </div>
  );
};
