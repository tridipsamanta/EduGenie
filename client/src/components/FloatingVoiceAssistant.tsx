import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getVoicePreferences,
  setVoicePreferences,
  VOICE_PREFERENCES_STORAGE_KEY,
} from "@/lib/voice-preferences";

type StreamRole = "user" | "assistant";

type StreamHistoryItem = {
  role: StreamRole;
  text: string;
};

type StreamEvent =
  | { type: "status"; state: "listening" | "processing" | "speaking" }
  | { type: "language"; language: "en-IN" | "hi-IN" | "bn-IN" }
  | { type: "assistant_chunk"; text: string }
  | { type: "assistant_done"; text: string }
  | { type: "error"; message: string };

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

const SILENCE_TIMEOUT_MS = 1100;
const TURN_COOLDOWN_MS = 900;
const MIN_UTTERANCE_LENGTH = 2;
const MAX_HISTORY = 10;
const CHUNK_INTERVAL_MS = 280;

const voiceByLanguage: Record<"en-IN" | "hi-IN" | "bn-IN", string> = {
  "en-IN": "manisha",
  "hi-IN": "anushka",
  "bn-IN": "vidya",
};

const supportsSpeechRecognition =
  typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

const supportsMediaRecorder = typeof window !== "undefined" && typeof MediaRecorder !== "undefined";

function createRecognition() {
  if (typeof window === "undefined") return null;
  const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  return RecognitionCtor ? new RecognitionCtor() : null;
}

export default function FloatingVoiceAssistant() {
  const storedPreferences = getVoicePreferences();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [caption, setCaption] = useState("Tap orb to start speaking");
  const [visualLevel, setVisualLevel] = useState(0.15);
  const [detectedLanguage, setDetectedLanguage] = useState<"en-IN" | "hi-IN" | "bn-IN">(
    storedPreferences.language,
  );
  const [voiceModel, setVoiceModel] = useState<string>(storedPreferences.voiceModel);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recognitionShouldRunRef = useRef(false);
  const silenceTimerRef = useRef<number | null>(null);
  const utteranceBufferRef = useRef("");
  const interimTextRef = useRef("");
  const lastTurnAtRef = useRef(0);
  const activeStreamAbortRef = useRef<AbortController | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micDataRef = useRef<Uint8Array | null>(null);
  const meterFrameRef = useRef<number | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const speakingAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechQueueRef = useRef<string[]>([]);
  const speechWorkerRunningRef = useRef(false);
  const cancelSpeechRef = useRef(false);
  const pendingChunkTimerRef = useRef<number | null>(null);
  const pendingTtsTextRef = useRef("");

  const historyRef = useRef<StreamHistoryItem[]>([]);

  useEffect(() => {
    setVoicePreferences({ language: detectedLanguage, voiceModel });
  }, [detectedLanguage, voiceModel]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== VOICE_PREFERENCES_STORAGE_KEY) return;
      const next = getVoicePreferences();
      setDetectedLanguage(next.language);
      setVoiceModel(next.voiceModel);
    };

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const orbStateLabel = useMemo(() => {
    if (isProcessing) return "Thinking";
    if (isSpeaking) return "Speaking";
    if (isListening) return "Listening";
    return "Ready";
  }, [isListening, isProcessing, isSpeaking]);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const clearPendingTtsTimer = () => {
    if (pendingChunkTimerRef.current) {
      window.clearTimeout(pendingChunkTimerRef.current);
      pendingChunkTimerRef.current = null;
    }
  };

  const stopSpeechOutput = () => {
    cancelSpeechRef.current = true;
    speechQueueRef.current = [];
    pendingTtsTextRef.current = "";
    clearPendingTtsTimer();

    if (speakingAudioRef.current) {
      speakingAudioRef.current.pause();
      speakingAudioRef.current.currentTime = 0;
      speakingAudioRef.current = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
  };

  const speakWithBrowserFallback = async (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      throw new Error("No speech fallback available.");
    }

    await new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = detectedLanguage;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error("Browser speech synthesis failed."));
      window.speechSynthesis.speak(utterance);
    });
  };

  const stopRecognition = () => {
    recognitionShouldRunRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // no-op
    }
    setIsListening(false);
  };

  const stopMeter = () => {
    if (meterFrameRef.current) {
      cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }
  };

  const cleanupMedia = () => {
    stopMeter();

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // no-op
      }
      mediaRecorderRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => null);
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    micDataRef.current = null;
    setVisualLevel(0.15);
  };

  const cleanupAll = () => {
    clearSilenceTimer();
    stopRecognition();

    if (activeStreamAbortRef.current) {
      activeStreamAbortRef.current.abort();
      activeStreamAbortRef.current = null;
    }

    stopSpeechOutput();
    cleanupMedia();
    setIsProcessing(false);
  };

  const flushPendingSpeech = () => {
    const value = pendingTtsTextRef.current.trim();
    if (!value) return false;
    speechQueueRef.current.push(value);
    pendingTtsTextRef.current = "";
    clearPendingTtsTimer();
    return true;
  };

  const queueSpeechChunk = (text: string) => {
    const chunk = text.trim();
    if (!chunk) return;

    pendingTtsTextRef.current = `${pendingTtsTextRef.current} ${chunk}`.trim();

    const shouldFlushNow = /[.!?।]\s*$/.test(chunk) || pendingTtsTextRef.current.length >= 170;
    if (shouldFlushNow) {
      const pushed = flushPendingSpeech();
      if (pushed) {
        void runSpeechQueue();
      }
      return;
    }

    clearPendingTtsTimer();
    pendingChunkTimerRef.current = window.setTimeout(() => {
      const pushed = flushPendingSpeech();
      if (pushed) {
        void runSpeechQueue();
      }
    }, CHUNK_INTERVAL_MS);
  };

  const runSpeechQueue = async () => {
    if (speechWorkerRunningRef.current) return;
    speechWorkerRunningRef.current = true;

    try {
      while (speechQueueRef.current.length > 0 && !cancelSpeechRef.current) {
        const nextChunk = speechQueueRef.current.shift();
        if (!nextChunk) continue;

        setIsSpeaking(true);

        try {
          const response = await fetch("/api/voice-assistant/text-to-speech", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: nextChunk,
              language: detectedLanguage,
              voice: voiceModel || voiceByLanguage[detectedLanguage],
            }),
          });

          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(data?.error || "Failed generating speech.");
          }

          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          speakingAudioRef.current = audio;

          await audio.play();

          await new Promise<void>((resolve, reject) => {
            audio.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error("Unable to play AI audio."));
            };
          });
        } catch {
          try {
            await speakWithBrowserFallback(nextChunk);
          } catch (fallbackError) {
            setErrorText(
              fallbackError instanceof Error
                ? fallbackError.message
                : "Both server voice and browser speech failed.",
            );
          }
        }
      }
    } finally {
      speechWorkerRunningRef.current = false;
      speakingAudioRef.current = null;
      setIsSpeaking(false);

      if (isOpen && !isProcessing) {
        recognitionShouldRunRef.current = true;
        try {
          recognitionRef.current?.start();
          setIsListening(true);
          setCaption("Listening...");
        } catch {
          // no-op
        }
      }
    }
  };

  const interruptAndListen = () => {
    stopSpeechOutput();
    cancelSpeechRef.current = true;

    if (activeStreamAbortRef.current) {
      activeStreamAbortRef.current.abort();
      activeStreamAbortRef.current = null;
    }

    setIsProcessing(false);
    setCaption("Interrupted. Listening...");

    recognitionShouldRunRef.current = true;
    try {
      recognitionRef.current?.start();
      setIsListening(true);
    } catch {
      // no-op
    }
  };

  const sendTurnToAssistant = async (userText: string) => {
    if (!userText.trim()) return;

    const now = Date.now();
    if (now - lastTurnAtRef.current < TURN_COOLDOWN_MS) return;
    lastTurnAtRef.current = now;

    setIsProcessing(true);
    setCaption("Thinking...");
    setErrorText("");

    historyRef.current = [...historyRef.current, { role: "user", text: userText }].slice(-MAX_HISTORY);

    if (activeStreamAbortRef.current) {
      activeStreamAbortRef.current.abort();
    }
    const controller = new AbortController();
    activeStreamAbortRef.current = controller;

    cancelSpeechRef.current = false;
    let fullAssistantText = "";

    try {
      const response = await fetch("/api/voice-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userText,
          history: historyRef.current,
          preferredLanguage: detectedLanguage,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Voice stream failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const event = JSON.parse(trimmed) as StreamEvent;
          if (event.type === "language") {
            setDetectedLanguage(event.language);
          }

          if (event.type === "assistant_chunk") {
            fullAssistantText = `${fullAssistantText}${event.text}`;
            setCaption(event.text.slice(0, 120));
            queueSpeechChunk(event.text);
            void runSpeechQueue();
          }

          if (event.type === "assistant_done") {
            fullAssistantText = event.text || fullAssistantText;
            setCaption((event.text || fullAssistantText).slice(0, 140));
            const pushed = flushPendingSpeech();
            if (pushed) {
              void runSpeechQueue();
            }
          }

          if (event.type === "error") {
            throw new Error(event.message || "Voice stream failed.");
          }
        }
      }

      if (fullAssistantText.trim()) {
        historyRef.current = [...historyRef.current, { role: "assistant", text: fullAssistantText }].slice(
          -MAX_HISTORY,
        );
      }
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        return;
      }
      setErrorText(error instanceof Error ? error.message : "Voice stream unavailable.");
    } finally {
      setIsProcessing(false);
      activeStreamAbortRef.current = null;

      if (!speechWorkerRunningRef.current && isOpen) {
        recognitionShouldRunRef.current = true;
        try {
          recognitionRef.current?.start();
          setIsListening(true);
          setCaption("Listening...");
        } catch {
          // no-op
        }
      }
    }
  };

  const commitUtterance = () => {
    const raw = `${utteranceBufferRef.current} ${interimTextRef.current}`.replace(/\s+/g, " ").trim();
    utteranceBufferRef.current = "";
    interimTextRef.current = "";

    if (raw.length < MIN_UTTERANCE_LENGTH || isProcessing) {
      return;
    }

    stopRecognition();
    void sendTurnToAssistant(raw);
  };

  const scheduleSilenceCommit = () => {
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      commitUtterance();
    }, SILENCE_TIMEOUT_MS);
  };

  const setupRecognitionHandlers = () => {
    const recognition = createRecognition();
    recognitionRef.current = recognition;
    if (!recognition) return;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onstart = () => {
      setIsListening(true);
      setCaption("Listening...");
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setPermissionDenied(true);
        setErrorText("Microphone permission denied.");
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;

        if (result.isFinal) {
          utteranceBufferRef.current = `${utteranceBufferRef.current} ${text}`.trim();
        } else {
          interim = `${interim} ${text}`.trim();
        }
      }

      interimTextRef.current = interim;
      const preview = `${utteranceBufferRef.current} ${interim}`.replace(/\s+/g, " ").trim();
      if (preview) {
        setCaption(preview.slice(-150));
        scheduleSilenceCommit();
      }

      if (isSpeaking && preview.length >= 4) {
        interruptAndListen();
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (!isOpen) return;
      if (!recognitionShouldRunRef.current) return;
      if (isProcessing) return;

      try {
        recognition.start();
      } catch {
        // no-op
      }
    };
  };

  const startAudioMeter = () => {
    const analyser = analyserRef.current;
    const data = micDataRef.current;
    if (!analyser || !data) return;

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const normalized = (data[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / data.length);
      const level = Math.min(1, Math.max(0.08, rms * 4.2));
      setVisualLevel(level);

      if (isSpeaking && level > 0.42) {
        interruptAndListen();
      }

      meterFrameRef.current = requestAnimationFrame(tick);
    };

    tick();
  };

  const initMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      micStreamRef.current = stream;
      setPermissionDenied(false);

      if (supportsMediaRecorder) {
        const preferredMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const recorder = new MediaRecorder(stream, {
          mimeType: preferredMime,
          audioBitsPerSecond: 24000,
        });

        recorder.ondataavailable = () => {
          // Audio chunks are intentionally sampled at short intervals for future duplex transport.
        };

        recorder.start(300);
        mediaRecorderRef.current = recorder;
      }

      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      audioContextRef.current = context;
      analyserRef.current = analyser;
      micDataRef.current = new Uint8Array(analyser.frequencyBinCount);

      startAudioMeter();
      return true;
    } catch {
      setPermissionDenied(true);
      setErrorText("Please allow microphone to use real-time voice mode.");
      return false;
    }
  };

  const beginVoiceSession = async () => {
    setErrorText("");
    if (!supportsSpeechRecognition) {
      setErrorText("SpeechRecognition is not supported in this browser.");
      return;
    }

    const micReady = await initMicrophone();
    if (!micReady) return;

    if (!recognitionRef.current) {
      setupRecognitionHandlers();
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    recognitionShouldRunRef.current = true;

    try {
      recognitionRef.current?.start();
      setIsListening(true);
      setCaption("Listening...");
    } catch {
      setErrorText("Could not start live recognition.");
    }
  };

  useEffect(() => {
    if (!isOpen) {
      cleanupAll();
      return;
    }
    void beginVoiceSession();

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onEsc);

    return () => {
      window.removeEventListener("keydown", onEsc);
      cleanupAll();
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      cleanupAll();
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[90] h-16 w-16 overflow-hidden rounded-full bg-gradient-to-br from-purple-700 to-violet-800 shadow-2xl shadow-purple-600/35 transition-transform duration-300 hover:scale-105"
      >
        <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/30 to-indigo-500/20 blur-lg animate-pulse" />
        <img
          src="/app_logo.png"
          alt="EduGenie"
          className="mx-auto h-full w-full rounded-full object-cover brightness-0 invert"
        />
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-xl"
          onClick={() => setIsOpen(false)}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(139,92,246,0.34)_0%,_rgba(99,102,241,0.18)_35%,_transparent_70%)]" />
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsOpen(false);
            }}
            className="absolute right-6 top-6 z-20 rounded-full border border-white/20 bg-white/10 p-2 text-white/90 hover:bg-white/20"
            aria-label="Close voice assistant"
          >
            <X className="h-4 w-4" />
          </button>

          <div
            className="relative z-10 flex h-full flex-col items-center justify-center px-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="relative flex h-52 w-52 items-center justify-center rounded-full transition-transform duration-300 ease-in-out"
              style={{ transform: `scale(${1 + visualLevel * 0.12})` }}
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-700/90 to-violet-800/90 shadow-[0_0_80px_10px_rgba(99,102,241,0.45)]" />
              <div className="absolute inset-3 overflow-hidden rounded-full border border-white/25 bg-black/20 backdrop-blur">
                <img
                  src="/app_logo.png"
                  alt="EduGenie"
                  className="h-full w-full object-cover brightness-0 invert"
                />
              </div>
            </div>

            <div className="mt-8 flex items-end justify-center gap-2">
              {new Array(16).fill(0).map((_, index) => {
                const amplitude = Math.max(6, Math.min(56, Math.round(8 + visualLevel * 48 * ((index % 4) + 1) * 0.22)));
                return (
                  <span
                    key={index}
                    className="w-1.5 rounded-full bg-gradient-to-t from-fuchsia-400 via-violet-400 to-indigo-300 animate-pulse"
                    style={{
                      height: `${amplitude}px`,
                      animationDelay: `${index * 0.04}s`,
                      animationDuration: "0.95s",
                    }}
                  />
                );
              })}
            </div>

            <div className="mt-8 text-center">
              <p className="text-xs uppercase tracking-[0.28em] text-violet-200/80">{orbStateLabel}</p>
              {errorText ? <p className="mt-2 text-xs text-rose-300">{errorText}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {permissionDenied ? (
        <div className="fixed bottom-24 right-6 z-[110] w-[320px] rounded-2xl border border-rose-300/40 bg-rose-500/10 p-4 backdrop-blur">
          <p className="text-sm font-semibold text-rose-200">Microphone permission needed</p>
          <p className="mt-1 text-xs text-rose-100/90">
            Allow microphone access in browser settings and reopen the voice orb.
          </p>
          <button
            type="button"
            onClick={() => setPermissionDenied(false)}
            className={cn(
              "mt-3 rounded-full border border-rose-300/30 px-3 py-1 text-xs text-rose-100",
              "hover:bg-rose-500/20",
            )}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );
}
