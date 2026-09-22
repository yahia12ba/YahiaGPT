// Web Speech API Types
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
    __activeUtterance?: SpeechSynthesisUtterance | null;
    __speechKeepAliveInterval?: any;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean("speechSynthesis" in window && window.speechSynthesis);
}

export function isMediaRecorderSupported(): boolean {
  if (typeof window === "undefined" || !navigator.mediaDevices) return false;
  return Boolean(typeof window.MediaRecorder !== "undefined");
}

export function isInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Strips markdown code blocks, links, bullets, and bold markers so text speaks naturally.
 */
export function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "Code block omitted.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/#+\s+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/>\s+/g, "")
    .replace(/[-*•]\s+/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

/**
 * Unlocks audio autoplay policies on user interaction (clicks or taps).
 * Call this on any button click (Mic, Voice Mode, Send).
 */
export function unlockAudioContext(): void {
  if (typeof window === "undefined") return;

  // Unlock Web Speech Synthesis
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.resume();
      // Prime with an empty utterance
      const emptyUtterance = new SpeechSynthesisUtterance("");
      emptyUtterance.volume = 0;
      window.speechSynthesis.speak(emptyUtterance);
    } catch (e) {
      console.warn("Could not prime speechSynthesis:", e);
    }
  }

  // Unlock Web Audio API context if present
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
    }
  } catch (e) {
    console.warn("Could not unlock AudioContext:", e);
  }
}

/**
 * MediaRecorder helper for browsers where Web Speech Recognition is unavailable or blocked.
 */
let activeStream: MediaStream | null = null;
let activeRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

export async function startAudioRecording(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not supported in this browser.");
  }

  try {
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    activeStream = stream;
    recordedChunks = [];

    // Determine supported mimeType
    let mimeType = "audio/webm";
    if (typeof MediaRecorder.isTypeSupported === "function") {
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
        mimeType = "audio/ogg";
      }
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    activeRecorder = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    recorder.start(100); // 100ms slices
    return true;
  } catch (err: any) {
    console.error("Failed to start audio recording:", err);
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      throw new Error(
        isInIframe()
          ? "Microphone access was blocked by the browser. Click 'Open in New Tab' to grant direct microphone access."
          : "Microphone permission was denied. Please allow microphone access in your browser address bar."
      );
    }
    throw new Error(`Microphone error: ${err.message || err.name}`);
  }
}

export function stopAudioRecording(): Promise<{ base64: string; mimeType: string; blob: Blob } | null> {
  return new Promise((resolve) => {
    if (!activeRecorder || activeRecorder.state === "inactive") {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
        activeStream = null;
      }
      resolve(null);
      return;
    }

    const mimeType = activeRecorder.mimeType || "audio/webm";

    activeRecorder.onstop = async () => {
      try {
        const audioBlob = new Blob(recordedChunks, { type: mimeType });
        if (activeStream) {
          activeStream.getTracks().forEach((track) => track.stop());
          activeStream = null;
        }
        activeRecorder = null;

        if (audioBlob.size === 0) {
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Strip data url prefix (e.g. "data:audio/webm;base64,")
          const base64 = result.split(",")[1] || "";
          resolve({ base64, mimeType, blob: audioBlob });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(audioBlob);
      } catch (err) {
        console.error("Error finalizing audio blob:", err);
        resolve(null);
      }
    };

    try {
      activeRecorder.stop();
    } catch {
      resolve(null);
    }
  });
}

export function isCurrentlyRecordingAudio(): boolean {
  return activeRecorder !== null && activeRecorder.state === "recording";
}

/**
 * Creates and configures a SpeechRecognition instance with event callbacks.
 */
export function createSpeechRecognizer(callbacks: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
  onStart: () => void;
}) {
  if (!isSpeechRecognitionSupported()) {
    callbacks.onError("Speech recognition not natively supported. Using direct audio recording mode.");
    return null;
  }

  const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer: any = null;
  try {
    recognizer = new SpeechRecognitionConstructor();
  } catch (err: any) {
    callbacks.onError("Could not initialize SpeechRecognition: " + err.message);
    return null;
  }

  recognizer.continuous = false;
  recognizer.interimResults = true;
  recognizer.lang = "en-US";

  recognizer.onstart = () => {
    callbacks.onStart();
  };

  recognizer.onresult = (event: any) => {
    let interim = "";
    let final = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    if (final) {
      callbacks.onResult(final.trim(), true);
    } else if (interim) {
      callbacks.onResult(interim.trim(), false);
    }
  };

  recognizer.onerror = (event: any) => {
    if (event.error === "no-speech") {
      // User was silent, not a fatal failure
      callbacks.onEnd();
      return;
    }
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      const msg = isInIframe()
        ? "Microphone access blocked in preview iframe. Click 'Open in New Tab' to grant direct permission."
        : "Microphone permission was denied. Please allow microphone access in your browser.";
      callbacks.onError(msg);
      return;
    }
    callbacks.onError(`Speech recognition note: ${event.error}`);
  };

  recognizer.onend = () => {
    callbacks.onEnd();
  };

  return recognizer;
}

/**
 * Retrieves available synthesis voices.
 */
export function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      resolve([]);
      return;
    }

    const synth = window.speechSynthesis;
    let voices = synth.getVoices();

    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    const handler = () => {
      voices = synth.getVoices();
      synth.removeEventListener("voiceschanged", handler);
      resolve(voices);
    };

    synth.addEventListener("voiceschanged", handler);

    // Fallback timeout in case voiceschanged doesn't fire
    setTimeout(() => {
      resolve(synth.getVoices());
    }, 800);
  });
}

/**
 * Specifically finds and selects the best natural male voice available in the browser.
 */
export function getBestMaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (!voices || voices.length === 0) return undefined;

  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  // Known female voice keywords to filter out
  const femaleKeywords = [
    "female", "woman", "girl", "zira", "jenny", "aria", "samantha", "victoria",
    "karen", "moira", "fiona", "susan", "hazel", "serena", "stephanie", "sara",
    "eva", "sonia", "linda", "heather", "helena", "catherine", "alice", "kendra"
  ];

  // Specific male voices ranked in order of natural English quality
  const malePreferences = [
    // British male voices (matches the Harry Potter aesthetic)
    "daniel",
    "george",
    "oliver",
    "arthur",
    "google uk english male",
    "en-gb-wavenet-b",
    "en-gb-standard-b",
    // American & other English male voices
    "alex",
    "fred",
    "david",
    "guy",
    "ryan",
    "mark",
    "microsoft david",
    "microsoft mark",
    "google us english male",
    "male",
  ];

  for (const pref of malePreferences) {
    const match = pool.find((v) => {
      const lower = v.name.toLowerCase();
      return lower.includes(pref) && !femaleKeywords.some((fk) => lower.includes(fk));
    });
    if (match) return match;
  }

  // Filter out any known female voice
  const nonFemaleVoices = pool.filter((v) => {
    const lower = v.name.toLowerCase();
    return !femaleKeywords.some((fk) => lower.includes(fk));
  });

  if (nonFemaleVoices.length > 0) {
    return nonFemaleVoices[0];
  }

  return pool[0];
}

/**
 * Speaks text aloud using SpeechSynthesis with robust Chrome GC and pause bug fixes.
 */
export function speakText(
  text: string,
  options: {
    voiceURI?: string;
    rate?: number;
    pitch?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
): () => void {
  if (!isSpeechSynthesisSupported()) {
    options.onEnd?.();
    return () => {};
  }

  const synth = window.speechSynthesis;

  // Clear previous keep-alive interval if any
  if (window.__speechKeepAliveInterval) {
    clearInterval(window.__speechKeepAliveInterval);
    window.__speechKeepAliveInterval = null;
  }

  // Cancel prior utterance
  synth.cancel();
  synth.resume();

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    options.onEnd?.();
    return () => {};
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = options.rate ?? 1.0;
  // Use a natural, warm male pitch (around 0.92 gives an authentic male voice)
  utterance.pitch = options.pitch ?? 0.92;

  // Crucial fix: retain global reference so Chrome garbage collector does not destroy it mid-speech
  window.__activeUtterance = utterance;

  const voices = synth.getVoices();
  if (options.voiceURI && voices.length > 0) {
    const matchedVoice = voices.find((v) => v.voiceURI === options.voiceURI);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    } else {
      const maleVoice = getBestMaleVoice(voices);
      if (maleVoice) utterance.voice = maleVoice;
    }
  } else if (voices.length > 0) {
    // Automatically select the best male voice
    const maleVoice = getBestMaleVoice(voices);
    if (maleVoice) {
      utterance.voice = maleVoice;
    }
  }

  const cleanup = () => {
    if (window.__speechKeepAliveInterval) {
      clearInterval(window.__speechKeepAliveInterval);
      window.__speechKeepAliveInterval = null;
    }
    window.__activeUtterance = null;
  };

  utterance.onstart = () => {
    options.onStart?.();

    // Chrome bug workaround: speech synthesis can pause after ~14 seconds
    window.__speechKeepAliveInterval = setInterval(() => {
      if (synth.speaking && !synth.paused) {
        synth.pause();
        synth.resume();
      }
    }, 10000);
  };

  utterance.onend = () => {
    cleanup();
    options.onEnd?.();
  };

  utterance.onerror = (e) => {
    cleanup();
    if (e.error === "canceled" || e.error === "interrupted") {
      options.onEnd?.();
      return;
    }
    console.warn("SpeechSynthesis error:", e);
    options.onError?.(e);
    options.onEnd?.();
  };

  // Give the browser 30ms after cancel() to re-arm the speech engine
  setTimeout(() => {
    try {
      synth.resume();
      synth.speak(utterance);
    } catch (err) {
      console.error("synth.speak failed:", err);
      cleanup();
      options.onError?.(err);
      options.onEnd?.();
    }
  }, 40);

  return () => {
    cleanup();
    synth.cancel();
    options.onEnd?.();
  };
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    if (window.__speechKeepAliveInterval) {
      clearInterval(window.__speechKeepAliveInterval);
      window.__speechKeepAliveInterval = null;
    }
    window.__activeUtterance = null;
    window.speechSynthesis.cancel();
  }
}
