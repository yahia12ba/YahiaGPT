import React, { useEffect, useState } from "react";
import { X, Volume2, Sliders, Check, Play, Mic, AlertCircle } from "lucide-react";
import type { VoiceSettings } from "../types";
import {
  getAvailableVoices,
  speakText,
  stopSpeaking,
  unlockAudioContext,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  isInIframe,
} from "../utils/speech";

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onUpdateSettings: (newSettings: VoiceSettings) => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [micStatus, setMicStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getAvailableVoices().then((list) => {
        setVoices(list);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestVoice = () => {
    unlockAudioContext();
    stopSpeaking();
    setIsTestingVoice(true);

    speakText("Hello! I am YahiaGPT. Your voice audio is connected and working.", {
      voiceURI: settings.voiceURI,
      rate: settings.rate,
      pitch: settings.pitch,
      onEnd: () => setIsTestingVoice(false),
      onError: (err) => {
        console.error("Test voice error:", err);
        setIsTestingVoice(false);
      },
    });
  };

  const handleTestMic = async () => {
    setMicStatus("Testing microphone...");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicStatus("Microphone API not available in this browser environment.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicStatus("Microphone access confirmed! Working properly.");
    } catch (err: any) {
      if (isInIframe()) {
        setMicStatus("Microphone restricted by preview iframe. Open app in a new tab for direct access.");
      } else {
        setMicStatus(`Microphone error: ${err.message || "Permission denied"}`);
      }
    }
  };

  return (
    <div
      id="voice-settings-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div
        id="voice-settings-modal"
        className="w-full max-w-md bg-stone-900 text-stone-100 rounded-2xl shadow-2xl border border-stone-800 p-6"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-semibold text-white">Voice & Audio Diagnostics</h3>
          </div>
          <button
            id="close-voice-settings-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Quick Voice Audio Test */}
          <div className="p-3 bg-stone-800/80 rounded-xl border border-stone-700/60 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-white block">Speaker / Voice Output</span>
              <span className="text-[11px] text-stone-400">Play a test phrase through your speakers</span>
            </div>
            <button
              id="test-voice-audio-btn"
              type="button"
              onClick={handleTestVoice}
              disabled={isTestingVoice}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs rounded-lg shadow-xs transition-colors shrink-0 disabled:opacity-50"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{isTestingVoice ? "Speaking..." : "Test Audio"}</span>
            </button>
          </div>

          {/* Quick Mic Test */}
          <div className="p-3 bg-stone-800/80 rounded-xl border border-stone-700/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-white block">Microphone Input</span>
                <span className="text-[11px] text-stone-400">Verify browser microphone permission</span>
              </div>
              <button
                id="test-mic-access-btn"
                type="button"
                onClick={handleTestMic}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors shrink-0"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Test Mic</span>
              </button>
            </div>
            {micStatus && (
              <p
                className={`mt-2 text-xs p-2 rounded-md ${
                  micStatus.includes("confirmed")
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                    : "bg-red-950/80 text-red-300 border border-red-800/60"
                }`}
              >
                {micStatus}
              </p>
            )}
          </div>

          {/* Voice selector */}
          <div>
            <label
              htmlFor="voice-select-dropdown"
              className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1.5"
            >
              YahiaGPT's Voice
            </label>
            <select
              id="voice-select-dropdown"
              value={settings.voiceURI}
              onChange={(e) => onUpdateSettings({ ...settings, voiceURI: e.target.value })}
              className="w-full text-sm bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Default Natural Voice</option>
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          {/* Speech Rate */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
              <span>Speech Speed: {settings.rate}x</span>
            </div>
            <input
              id="slider-speech-rate"
              type="range"
              min="0.7"
              max="1.5"
              step="0.1"
              value={settings.rate}
              onChange={(e) =>
                onUpdateSettings({ ...settings, rate: parseFloat(e.target.value) })
              }
              className="w-full accent-amber-500"
            />
          </div>

          {/* Auto Speak Toggles */}
          <div className="pt-2 border-t border-stone-800 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-stone-200">
                Auto-read YahiaGPT's responses aloud
              </span>
              <input
                id="checkbox-auto-speak"
                type="checkbox"
                checked={settings.autoSpeak}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, autoSpeak: e.target.checked })
                }
                className="w-4 h-4 rounded text-amber-500 accent-amber-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-stone-200 block">
                  Hands-Free Voice Conversation Loop
                </span>
                <span className="text-xs text-stone-400">
                  Automatically listens again after YahiaGPT finishes speaking
                </span>
              </div>
              <input
                id="checkbox-continuous-mode"
                type="checkbox"
                checked={settings.continuousMode}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, continuousMode: e.target.checked })
                }
                className="w-4 h-4 rounded text-amber-500 accent-amber-500"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-stone-800 flex justify-end">
          <button
            id="btn-done-settings"
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
