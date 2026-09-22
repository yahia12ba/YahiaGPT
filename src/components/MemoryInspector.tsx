import React, { useState } from "react";
import { Brain, User, Tag, Sparkles, Trash2, Plus, X, Edit3, Check } from "lucide-react";
import type { MemoryState } from "../types";

interface MemoryInspectorProps {
  memory: MemoryState;
  onUpdateMemory: (updater: (prev: MemoryState) => MemoryState) => void;
  onClose: () => void;
}

export const MemoryInspector: React.FC<MemoryInspectorProps> = ({
  memory,
  onUpdateMemory,
  onClose,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(memory.userName);
  const [newNoteInput, setNewNoteInput] = useState("");

  const handleSaveName = () => {
    onUpdateMemory((prev) => ({
      ...prev,
      userName: nameInput.trim(),
    }));
    setIsEditingName(false);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteInput.trim()) return;
    onUpdateMemory((prev) => ({
      ...prev,
      memoryNotes: [...prev.memoryNotes, newNoteInput.trim()],
    }));
    setNewNoteInput("");
  };

  const handleRemoveNote = (index: number) => {
    onUpdateMemory((prev) => ({
      ...prev,
      memoryNotes: prev.memoryNotes.filter((_, i) => i !== index),
    }));
  };

  const handleClearAllMemory = () => {
    onUpdateMemory(() => ({
      userName: "",
      currentTopic: "General conversation",
      memoryNotes: [],
    }));
    setNameInput("");
  };

  return (
    <div
      id="memory-inspector-panel"
      className="relative z-25 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/80 shadow-2xl p-4 sm:p-5 transition-all text-slate-100"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                YahiaGPT's Active Memory & Context
              </h2>
              <p className="text-xs text-slate-400">
                YahiaGPT uses these details to provide context-aware, personalized conversations.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="clear-all-memory-btn"
              type="button"
              onClick={handleClearAllMemory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-red-400 hover:bg-red-950/40 rounded-md border border-slate-700 transition-colors"
              title="Reset YahiaGPT's memory"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Memory</span>
            </button>
            <button
              id="close-memory-btn"
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
              aria-label="Close memory panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Item 1: User's Name */}
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Your Name</span>
              </span>
              {!isEditingName && (
                <button
                  type="button"
                  onClick={() => {
                    setNameInput(memory.userName);
                    setIsEditingName(true);
                  }}
                  className="text-slate-400 hover:text-white p-1"
                  title="Edit recalled name"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {isEditingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full text-xs px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="p-1 text-emerald-400 hover:text-emerald-300 bg-emerald-950 rounded"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p className="text-sm font-semibold text-white">
                {memory.userName ? (
                  <span className="text-emerald-400">{memory.userName}</span>
                ) : (
                  <span className="text-slate-500 italic">Not set yet</span>
                )}
              </p>
            )}
            <span className="text-[10px] text-slate-400 block mt-1">
              YahiaGPT automatically updates this when you introduce yourself.
            </span>
          </div>

          {/* Item 2: Current Topic */}
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Tag className="w-3.5 h-3.5 text-blue-400" />
                <span>Current Topic</span>
              </span>
            </div>
            <p className="text-sm font-semibold text-amber-300 truncate">
              {memory.currentTopic || "General conversation"}
            </p>
            <span className="text-[10px] text-slate-400 block mt-1">
              Recalled from the context of your recent questions and answers.
            </span>
          </div>

          {/* Item 3: Personal Facts & Preferences */}
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col justify-between">
            <div>
              <span className="font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px] mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Retained Facts ({memory.memoryNotes.length})</span>
              </span>

              {memory.memoryNotes.length > 0 ? (
                <ul className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                  {memory.memoryNotes.map((note, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between text-[11px] bg-slate-900/90 text-slate-200 px-2 py-1 rounded border border-slate-700"
                    >
                      <span className="truncate max-w-[190px]">{note}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveNote(idx)}
                        className="text-slate-500 hover:text-red-400 ml-1"
                        title="Remove fact"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 italic text-xs">No facts saved yet</p>
              )}
            </div>

            <form onSubmit={handleAddNote} className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-700">
              <input
                type="text"
                value={newNoteInput}
                onChange={(e) => setNewNoteInput(e.target.value)}
                placeholder="Add custom memory..."
                className="w-full text-xs px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="submit"
                className="p-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded shrink-0"
                title="Add fact"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
