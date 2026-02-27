import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getVoicePreferences, setVoicePreferences } from "@/lib/voice-preferences";
import {
  Languages,
  Loader2,
  Mic,
  Send,
  Sparkles,
  Volume2,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

const TTS_MAX_CHARS = 700;
const TTS_RETRY_MAX_CHARS = 320;

type AssistantLanguage = "en-IN" | "hi-IN" | "bn-IN";
type MessageRole = "user" | "assistant";

type VoiceMessage = {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: string;
};

const LANGUAGES: Array<{ value: AssistantLanguage; label: string }> = [
  { value: "en-IN", label: "English" },
  { value: "hi-IN", label: "Hindi" },
  { value: "bn-IN", label: "Bengali" },
];

const VOICE_MODELS = [
  { value: "anushka", label: "Anushka" },
  { value: "abhilash", label: "Abhilash" },
  { value: "manisha", label: "Manisha" },
  { value: "vidya", label: "Vidya" },
  { value: "arya", label: "Arya" },
  { value: "karun", label: "Karun" },
  { value: "hitesh", label: "Hitesh" },
];

const languageLabel = (language: AssistantLanguage) =>
  LANGUAGES.find((item) => item.value === language)?.label || "English";

const supportsRecording =
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== "undefined";

export default function VoiceAssistant() {
  const { toast } = useToast();
  const storedPreferences = getVoicePreferences();
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState<AssistantLanguage>(storedPreferences.language);
  const [voiceModel, setVoiceModel] = useState<string>(storedPreferences.voiceModel);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const ttsCancelRef = useRef(false);

  useEffect(() => {
    setVoicePreferences({ language, voiceModel });
  }, [language, voiceModel]);

  const isBusy = isSending || isTranscribing;

  const stopActiveAudio = (keepSpeaking = false) => {
    if (!keepSpeaking) {
      ttsCancelRef.current = true;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (!keepSpeaking) {
      setIsSpeaking(false);
    }
  };

  const sanitizeForSpeech = (text: string) =>
    text
      .replace(/[`*_~#^]/g, " ")
      .replace(/[\[\]{}<>|\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const splitByLength = (value: string, maxLength: number) => {
    const tokens = value.trim().split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    let current = "";

    for (const token of tokens) {
      if (token.length > maxLength) {
        if (current) {
          chunks.push(current);
          current = "";
        }
        for (let index = 0; index < token.length; index += maxLength) {
          chunks.push(token.slice(index, index + maxLength));
        }
        continue;
      }

      const candidate = current ? `${current} ${token}` : token;
      if (candidate.length <= maxLength) {
        current = candidate;
      } else {
        if (current) {
          chunks.push(current);
        }
        current = token;
      }
    }

    if (current) {
      chunks.push(current);
    }

    return chunks;
  };

  const splitForTts = (text: string, maxLength: number) => {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) return [];
    if (cleaned.length <= maxLength) return [cleaned];

    const sentenceLikeParts = cleaned
      .split(/(?<=[.!?])\s+|\n+/)
      .map((part) => part.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    let buffer = "";

    for (const part of sentenceLikeParts) {
      if (part.length > maxLength) {
        if (buffer) {
          chunks.push(buffer);
          buffer = "";
        }
        chunks.push(...splitByLength(part, maxLength));
        continue;
      }

      const candidate = buffer ? `${buffer} ${part}` : part;
      if (candidate.length <= maxLength) {
        buffer = candidate;
      } else {
        if (buffer) {
          chunks.push(buffer);
        }
        buffer = part;
      }
    }

    if (buffer) {
      chunks.push(buffer);
    }

    return chunks;
  };

  const requestTtsAudio = async (text: string) => {
    const response = await fetch("/api/voice-assistant/text-to-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        language,
        voice: voiceModel,
      }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || "Failed to generate speech audio.");
    }

    return response.blob();
  };

  const playAudioBlob = async (blob: Blob) => {
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    audioRef.current = audio;

    await audio.play();

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(objectUrl);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to play audio."));
      };
    });
  };

  const addMessage = (role: MessageRole, text: string) => {
    const next: VoiceMessage = {
      id: crypto.randomUUID(),
      role,
      text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, next]);
    window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    return next;
  };

  const speakText = async (text: string) => {
    try {
      ttsCancelRef.current = false;
      setIsSpeaking(true);
      stopActiveAudio(true);
      const chunks = splitForTts(sanitizeForSpeech(text), TTS_MAX_CHARS);

      for (const chunk of chunks) {
        if (ttsCancelRef.current) break;
        try {
          const blob = await requestTtsAudio(chunk);
          await playAudioBlob(blob);
        } catch {
          const retryParts = splitForTts(chunk, TTS_RETRY_MAX_CHARS);
          for (const retryPart of retryParts) {
            if (ttsCancelRef.current) break;
            const retryBlob = await requestTtsAudio(retryPart);
            await playAudioBlob(retryBlob);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      setIsSpeaking(false);
    } catch (error) {
      setIsSpeaking(false);
      toast({
        title: "Speech output failed",
        description: error instanceof Error ? error.message : "Unable to play assistant voice.",
        variant: "destructive",
      });
    }
  };

  const sendToAssistant = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;

    addMessage("user", trimmed);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch("/api/voice-assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          language,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Assistant response failed.");
      }

      const data = (await response.json().catch(() => null)) as
        | { text?: string; reply?: string; message?: string }
        | null;
      const replyText = data?.text || data?.reply || data?.message;

      if (!replyText) {
        throw new Error("Assistant response was empty.");
      }

      addMessage("assistant", replyText);

      if (autoSpeak) {
        await speakText(replyText);
      }
    } catch (error) {
      toast({
        title: "Assistant request failed",
        description: error instanceof Error ? error.message : "Unable to reach the assistant.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendToAssistant(input);
  };

  const startRecording = async () => {
    if (!supportsRecording) {
      toast({
        title: "Recording not supported",
        description: "Your browser does not support audio recording.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isSpeaking) {
        stopActiveAudio();
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some((device) => device.kind === "audioinput");
      if (!hasMic) {
        toast({
          title: "No microphone detected",
          description: "Connect a microphone and try again.",
          variant: "destructive",
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorderRef.current = recorder;
      streamRef.current = stream;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      const message =
        error instanceof Error && "name" in error
          ? (error as Error & { name?: string }).name
          : "";
      const description =
        message === "NotFoundError"
          ? "No microphone was found. Plug one in and try again."
          : message === "NotAllowedError"
            ? "Allow microphone access in your browser settings."
            : error instanceof Error
              ? error.message
              : "Unable to access your microphone.";
      toast({
        title: "Microphone access denied",
        description,
        variant: "destructive",
      });
    }
  };

  const stopRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    const stopPromise = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.stop();
    await stopPromise;
    recorderRef.current = null;
    setIsRecording(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];

    if (!audioBlob.size) return;

    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("file", audioBlob, "recording.webm");
      formData.append("language", language);

      const response = await fetch("/api/voice-assistant/speech-to-text", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Unable to transcribe audio.");
      }

      const data = (await response.json().catch(() => null)) as
        | { text?: string; transcript?: string; transcription?: string }
        | null;
      const transcript = data?.text || data?.transcript || data?.transcription;

      if (!transcript) {
        throw new Error("No transcription returned.");
      }

      await sendToAssistant(transcript);
    } catch (error) {
      toast({
        title: "Speech to text failed",
        description: error instanceof Error ? error.message : "Unable to transcribe your audio.",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <Layout>
      <div className="relative flex flex-col gap-8">
        <style>{`
          @keyframes soft-wave {
            0% { transform: translateX(-6%); opacity: 0.35; }
            50% { transform: translateX(6%); opacity: 0.85; }
            100% { transform: translateX(-6%); opacity: 0.35; }
          }
          @keyframes pulse-dot {
            0% { transform: scale(0.9); opacity: 0.6; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(0.9); opacity: 0.6; }
          }
          .soft-wave { animation: soft-wave 3.2s ease-in-out infinite; }
          .pulse-dot { animation: pulse-dot 1.8s ease-in-out infinite; }
        `}</style>

        <div className="flex items-start justify-between">
          <div className="inline-flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 shadow-lg shadow-violet-500/30">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Voice Assistant</h1>
              <p className="text-muted-foreground">
                Premium purple voice UI with crystal-clear replies.
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs tracking-wide">
            Sarvam Connected
          </Badge>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-violet-50 via-background to-violet-100/70 dark:from-violet-950/60 dark:via-slate-950 dark:to-slate-900/80 px-8 py-10 shadow-[0_40px_90px_-70px_rgba(120,85,255,0.6)]">
          <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-violet-400/35 via-transparent to-transparent blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-6 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-400/30 via-transparent to-transparent blur-3xl" />

          <div className="flex flex-col items-center text-center gap-4">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Talk to your AI assistant now
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              Natural voice conversations with premium clarity and a soft purple aura.
            </p>
          </div>

          <div className="mt-10 flex items-center justify-center">
            <div className="relative h-20 w-full max-w-3xl">
              <div className="absolute inset-0 soft-wave rounded-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-violet-400/30 via-indigo-400/20 to-transparent blur-2xl" />
              <div
                className="absolute inset-0 soft-wave rounded-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-fuchsia-300/25 via-sky-300/15 to-transparent blur-2xl"
                style={{ animationDelay: "-1.2s" }}
              />
              <div className="absolute inset-0 flex items-center justify-center gap-2">
                {[0, 1, 2, 3, 4, 5, 6].map((index) => (
                  <span
                    key={index}
                    className={cn(
                      "block h-6 w-2 rounded-full bg-gradient-to-b from-violet-500 via-indigo-500 to-sky-400",
                      !isRecording && !isTranscribing ? "opacity-40" : "opacity-90 pulse-dot",
                    )}
                    style={{ animationDelay: `${index * 0.12}s` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-3 rounded-full border border-border/60 bg-background/80 dark:bg-slate-900/60 px-4 py-2 shadow-sm">
              <Languages className="h-4 w-4 text-muted-foreground" />
              <div className="w-[180px]">
                <Select value={language} onValueChange={(value) => setLanguage(value as AssistantLanguage)}>
                  <SelectTrigger className="h-8 rounded-full">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="outline" className="rounded-full">
                {languageLabel(language)}
              </Badge>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-border/60 bg-background/80 dark:bg-slate-900/60 px-4 py-2 shadow-sm">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <div className="w-[160px]">
                <Select value={voiceModel} onValueChange={setVoiceModel}>
                  <SelectTrigger className="h-8 rounded-full">
                    <SelectValue placeholder="Voice model" />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_MODELS.map((voice) => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="outline" className="rounded-full">
                {voiceModel}
              </Badge>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-border/60 bg-background/80 dark:bg-slate-900/60 px-4 py-2 shadow-sm">
              <span className="text-sm text-muted-foreground">Auto voice reply</span>
              <Switch checked={autoSpeak} onCheckedChange={setAutoSpeak} />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setMessages([]);
                stopActiveAudio();
              }}
            >
              Clear chat
            </Button>
          </div>

          <form onSubmit={onSubmit} className="mt-8 flex items-center justify-center">
            <div className="flex w-full max-w-3xl items-center gap-3 rounded-full border border-border/60 bg-background/90 dark:bg-slate-900/70 px-4 py-3 shadow-[0_20px_40px_-30px_rgba(124,58,237,0.45)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-500">
                <Mic className="h-4 w-4" />
              </div>
                <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask me anything..."
                  className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 outline-none"
                disabled={isBusy}
              />
              <Button
                type="submit"
                disabled={isBusy || !input.trim()}
                className="rounded-full bg-violet-600 text-white hover:bg-violet-700"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send
              </Button>
              {!isRecording ? (
                <Button type="button" variant="secondary" onClick={startRecording} disabled={isBusy}>
                  Start Voice
                </Button>
              ) : (
                <Button type="button" variant="destructive" onClick={stopRecording}>
                  Stop
                </Button>
              )}
            </div>
          </form>

          <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className={cn("pulse-dot", isRecording && "text-violet-600")}>*</span>
            <span>{isRecording ? "Listening..." : "Ready"}</span>
            {isTranscribing && <span>Transcribing voice...</span>}
            {isSpeaking && (
              <button type="button" onClick={() => stopActiveAudio()} className="ml-2 text-violet-600">
                Stop voice
              </button>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[24px] border border-border/60 bg-card/90 dark:bg-slate-950/70 p-6 shadow-[0_30px_80px_-70px_rgba(120,85,255,0.6)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Conversation</h3>
              <p className="text-sm text-muted-foreground">Your latest voice and text exchanges.</p>
            </div>
          </div>
          <div className="h-[42vh] overflow-y-auto space-y-3 pr-2">
            {messages.length === 0 ? (
              <div className="h-full min-h-[240px] flex items-center justify-center text-center text-muted-foreground px-6">
                Ask your first question by text or voice. The assistant will reply in your selected language.
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 border",
                    message.role === "user"
                      ? "ml-auto bg-violet-600 text-white border-violet-600/20"
                      : "bg-background/80 dark:bg-slate-900/60 border-violet-100 text-foreground",
                  )}
                >
                  <div className="text-[11px] uppercase tracking-[0.2em] mb-1 opacity-60">
                    {message.role === "user" ? "You" : "Assistant"}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
                  {message.role === "assistant" && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => speakText(message.text)}
                        disabled={isSpeaking}
                      >
                        {isSpeaking ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Volume2 className="h-4 w-4 mr-1" />
                        )}
                        Speak
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
