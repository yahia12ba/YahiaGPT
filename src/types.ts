export interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: number;
  detectedUserName?: string;
  currentTopic?: string;
  memoryNotes?: string[];
}

export interface MemoryState {
  userName: string;
  currentTopic: string;
  memoryNotes: string[];
}

export interface VoiceSettings {
  autoSpeak: boolean;
  continuousMode: boolean;
  voiceURI: string;
  rate: number;
  pitch: number;
}
