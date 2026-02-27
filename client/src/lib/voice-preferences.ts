export type VoicePreferenceLanguage = "en-IN" | "hi-IN" | "bn-IN";

export type VoicePreferences = {
  language: VoicePreferenceLanguage;
  voiceModel: string;
};

const STORAGE_KEY = "edugenie.voice.preferences";

const DEFAULT_PREFERENCES: VoicePreferences = {
  language: "en-IN",
  voiceModel: "manisha",
};

const validLanguages: VoicePreferenceLanguage[] = ["en-IN", "hi-IN", "bn-IN"];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizePreferences = (value: unknown): VoicePreferences => {
  if (!isObject(value)) {
    return DEFAULT_PREFERENCES;
  }

  const language =
    typeof value.language === "string" && validLanguages.includes(value.language as VoicePreferenceLanguage)
      ? (value.language as VoicePreferenceLanguage)
      : DEFAULT_PREFERENCES.language;

  const voiceModel =
    typeof value.voiceModel === "string" && value.voiceModel.trim().length > 0
      ? value.voiceModel.trim()
      : DEFAULT_PREFERENCES.voiceModel;

  return { language, voiceModel };
};

export const getVoicePreferences = (): VoicePreferences => {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

export const setVoicePreferences = (preferences: Partial<VoicePreferences>) => {
  if (typeof window === "undefined") {
    return;
  }

  const current = getVoicePreferences();
  const next = normalizePreferences({ ...current, ...preferences });
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const VOICE_PREFERENCES_STORAGE_KEY = STORAGE_KEY;
