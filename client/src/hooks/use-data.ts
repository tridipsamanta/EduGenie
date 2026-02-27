import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { 
  InsertSubject, InsertTopic, InsertQuiz, InsertSavedNote, 
  GenerateMCQRequest, SubmitQuizRequest, AttemptAnswerPayload
} from "@/lib/types";

// Mock API routes (frontend-only mode)
const api = {
  subjects: {
    list: { path: "/api/subjects", responses: { 200: { parse: (d: any) => d } } },
    create: { path: "/api/subjects", responses: { 201: { parse: (d: any) => d } } },
  },
  topics: {
    list: { path: "/api/topics", responses: { 200: { parse: (d: any) => d } } },
    create: { path: "/api/topics", responses: { 201: { parse: (d: any) => d } } },
  },
  questions: {
    generate: { path: "/api/mcq/generate", responses: { 200: { parse: (d: any) => d } } },
  },
  quizzes: {
    list: { path: "/api/quizzes", responses: { 200: { parse: (d: any) => d } } },
    get: { path: "/api/quizzes/:id", responses: { 200: { parse: (d: any) => d } } },
    create: { path: "/api/quizzes", responses: { 201: { parse: (d: any) => d } } },
    delete: { path: "/api/quizzes/:id", responses: { 200: { parse: (d: any) => d } } },
    submit: { path: "/api/quizzes/submit", responses: { 200: { parse: (d: any) => d } } },
  },
  attempts: {
    start: { path: "/api/attempt/start", responses: { 200: { parse: (d: any) => d } } },
    get: { path: "/api/attempt/:id", responses: { 200: { parse: (d: any) => d } } },
    answer: { path: "/api/attempt/answer", responses: { 200: { parse: (d: any) => d } } },
    finish: { path: "/api/attempt/finish", responses: { 200: { parse: (d: any) => d } } },
  },
  stats: {
    get: { path: "/api/dashboard/stats", responses: { 200: { parse: (d: any) => d } } },
  },
  ai: {
    analyzeDashboard: {
      path: "/api/ai/analyze-dashboard",
      responses: { 200: { parse: (d: any) => d } },
    },
  },
  notes: {
    list: { path: "/api/notes", responses: { 200: { parse: (d: any) => d } } },
    create: { path: "/api/notes", responses: { 201: { parse: (d: any) => d } } },
    get: { path: "/api/notes/:id", responses: { 200: { parse: (d: any) => d } } },
    update: { path: "/api/notes/:id", responses: { 200: { parse: (d: any) => d } } },
    delete: { path: "/api/notes/:id", responses: { 200: { parse: (d: any) => d } } },
    generate: { path: "/api/notes/generate", responses: { 201: { parse: (d: any) => d } } },
    youtube: { path: "/api/notes/youtube", responses: { 201: { parse: (d: any) => d } } },
    url: { path: "/api/notes/url", responses: { 201: { parse: (d: any) => d } } },
    search: { path: "/api/notes/search", responses: { 200: { parse: (d: any) => d } } },
    mcq: { path: "/api/notes/:id/mcq", responses: { 201: { parse: (d: any) => d } } },
  },
};

const buildUrl = (path: string, params?: Record<string, any>) => {
  if (!params) return path;

  let resolvedPath = path;
  const queryParams: Record<string, string> = {};

  Object.entries(params).forEach(([key, value]) => {
    const placeholder = `:${key}`;
    if (resolvedPath.includes(placeholder)) {
      resolvedPath = resolvedPath.replace(placeholder, encodeURIComponent(String(value)));
    } else {
      queryParams[key] = String(value);
    }
  });

  const url = new URL(resolvedPath, window.location.origin);
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  return url.pathname + url.search;
};

const fallbackStats = {
  totalCourses: 0,
  totalChapters: 0,
  totalLessons: 0,
  totalQuizzes: 0,
  totalMcqGenerated: 0,
  totalNotes: 0,
  averageScore: 0,
  totalStudyTime: 0,
  totalMcqTimeSec: 0,
  totalNotesTimeSec: 0,
  totalMcqTimeMinutes: 0,
  totalNotesTimeMinutes: 0,
  totalCourseWatchedSec: 0,
  totalCourseTimeMinutes: 0,
  weeklyStudyStreak: 0,
  hasStudiedToday: false,
  weakTopics: [],
  strongTopics: [],
  activityTrend: [],
  weeklyActivity: [],
  dailyStudyMinutes: [],
  featureUsage: [],
  recentActivity: [],
  topicPerformance: [],
  performanceHistory: [],
};

// --- SUBJECTS ---
export function useSubjects() {
  return useQuery({
    queryKey: [api.subjects.list.path],
    queryFn: async () => {
      try {
        const res = await fetch(api.subjects.list.path);
        if (!res.ok) throw new Error("Failed to fetch subjects");
        return api.subjects.list.responses[200].parse(await res.json());
      } catch {
        return [];
      }
    },
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertSubject) => {
      const res = await fetch(api.subjects.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create subject");
      return api.subjects.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.subjects.list.path] });
      toast({ title: "Success", description: "Subject created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

// --- TOPICS ---
export function useTopics(subjectId?: number) {
  return useQuery({
    queryKey: [api.topics.list.path, subjectId],
    queryFn: async () => {
      const url = subjectId 
        ? `${api.topics.list.path}?subjectId=${subjectId}` 
        : api.topics.list.path;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch topics");
        return api.topics.list.responses[200].parse(await res.json());
      } catch {
        return [];
      }
    },
    enabled: true, // Always allow fetching, filtering happens on backend if param provided
  });
}

export function useCreateTopic() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertTopic) => {
      const res = await fetch(api.topics.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create topic");
      return api.topics.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.topics.list.path] });
      toast({ title: "Success", description: "Topic created successfully" });
    },
  });
}

// --- QUESTIONS / MCQ ---
export function useGenerateMCQ() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: GenerateMCQRequest) => {
      const payload = {
        topic: data.topic,
        difficulty: data.difficulty ?? "medium",
        questionType: data.questionType ?? data.type ?? "school",
        numberOfQuestions: data.numberOfQuestions ?? data.count ?? 5,
        sourceText: data.sourceText ?? data.text ?? "",
      };

      const res = await fetch(api.questions.generate.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = "Failed to generate questions";
        try {
          const errorData = await res.json();
          message = errorData?.error || message;
        } catch {
          // ignore parse failures
        }
        throw new Error(message);
      }

      return api.questions.generate.responses[200].parse(await res.json());
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

// --- QUIZZES ---
export function useQuizzes() {
  return useQuery({
    queryKey: [api.quizzes.list.path],
    queryFn: async () => {
      try {
        const res = await fetch(api.quizzes.list.path);
        if (!res.ok) throw new Error("Failed to fetch quizzes");
        return api.quizzes.list.responses[200].parse(await res.json());
      } catch {
        return [];
      }
    },
  });
}

export function useQuiz(id: number) {
  return useQuery({
    queryKey: [api.quizzes.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.quizzes.get.path, { id });
      try {
        const res = await fetch(url);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("Failed to fetch quiz");
        return api.quizzes.get.responses[200].parse(await res.json());
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}

export function useCreateQuiz() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertQuiz) => {
      const res = await fetch(api.quizzes.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        let message = "Failed to create quiz";
        try {
          const errorData = await res.json();
          message = errorData?.error || message;
        } catch {
          // ignore parse failures
        }
        throw new Error(message);
      }

      return api.quizzes.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.quizzes.list.path] });
      toast({ title: "Success", description: "Quiz created successfully" });
    },
  });
}

export function useDeleteQuiz() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (quizId: string) => {
      const url = buildUrl(api.quizzes.delete.path, { id: quizId });
      const res = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        let message = "Failed to delete quiz";
        try {
          const errorData = await res.json();
          message = errorData?.error || message;
        } catch {
          // ignore parse failures
        }
        throw new Error(message);
      }

      return api.quizzes.delete.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.quizzes.list.path] });
      toast({ title: "Success", description: "Quiz deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useSubmitQuiz() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: SubmitQuizRequest }) => {
      const url = buildUrl(api.quizzes.submit.path, { id });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to submit quiz");
      return api.quizzes.submit.responses[200].parse(await res.json());
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [api.quizzes.get.path, id] });
      queryClient.invalidateQueries({ queryKey: [api.quizzes.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      toast({ title: "Completed", description: "Quiz submitted successfully!" });
    },
  });
}

// --- ATTEMPTS ---
export function useStartAttempt() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ quizId, userId }: { quizId: string; userId?: string }) => {
      const res = await fetch(api.attempts.start.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, userId }),
      });

      if (!res.ok) {
        let message = "Failed to start attempt";
        try {
          const errorData = await res.json();
          message = errorData?.error || message;
        } catch {
          // ignore parse failures
        }
        throw new Error(message);
      }

      return api.attempts.start.responses[200].parse(await res.json());
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useAttempt(id?: string) {
  return useQuery({
    queryKey: [api.attempts.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.attempts.get.path, { id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch attempt");
      return api.attempts.get.responses[200].parse(await res.json());
    },
    enabled: Boolean(id),
  });
}

export function useSubmitAttemptAnswer() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: AttemptAnswerPayload) => {
      const res = await fetch(api.attempts.answer.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        let message = "Failed to submit answer";
        try {
          const errorData = await res.json();
          message = errorData?.error || message;
        } catch {
          // ignore parse failures
        }
        throw new Error(message);
      }

      return api.attempts.answer.responses[200].parse(await res.json());
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useFinishAttempt() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ attemptId }: { attemptId: string }) => {
      const res = await fetch(api.attempts.finish.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });

      if (!res.ok) {
        let message = "Failed to finish attempt";
        try {
          const errorData = await res.json();
          message = errorData?.error || message;
        } catch {
          // ignore parse failures
        }
        throw new Error(message);
      }

      return api.attempts.finish.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.attempts.get.path, variables.attemptId] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}



// --- STATS ---
export function useStats() {
  return useQuery({
    queryKey: [api.stats.get.path],
    queryFn: async () => {
      try {
        const res = await fetch(api.stats.get.path);
        if (!res.ok) throw new Error("Failed to fetch stats");
        return api.stats.get.responses[200].parse(await res.json());
      } catch {
        return fallbackStats;
      }
    },
  });
}

export function useAnalyzeDashboardInsights() {
  return useMutation({
    mutationFn: async (payload: {
      totalCourses: number;
      totalNotes: number;
      avgScore: number;
      weakTopics: string[];
      strongTopics: string[];
      studyTime: number;
      recentActivity: Array<{ type?: string; title?: string; at?: string }>;
    }) => {
      const res = await fetch(api.ai.analyzeDashboard.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to analyze dashboard insights");
      }

      return api.ai.analyzeDashboard.responses[200].parse(await res.json());
    },
  });
}
// --- NOTES ---
export function useNotes() {
  return useQuery({
    queryKey: [api.notes.list.path],
    queryFn: async () => {
      try {
        const res = await fetch(api.notes.list.path);
        if (!res.ok) throw new Error("Failed to fetch notes");
        const data = await res.json();
        return data.notes || [];
      } catch {
        return [];
      }
    },
  });
}

export function useNote(id: string) {
  return useQuery({
    queryKey: [api.notes.get.path, id],
    queryFn: async () => {
      try {
        const url = buildUrl(api.notes.get.path, { id });
        const res = await fetch(url);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("Failed to fetch note");
        const data = await res.json();
        return data.note;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.notes.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create note");
      return (await res.json()).note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notes.list.path] });
      toast({ title: "Success", description: "Note created" });
    },
    onError: (error) => {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    },
  });
}

export function useGenerateNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { topic: string; title?: string }) => {
      const res = await fetch(api.notes.generate.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to generate note");
      return (await res.json()).note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notes.list.path] });
      toast({ title: "Success", description: "Note generated with AI" });
    },
    onError: (error) => {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    },
  });
}

export function useYouTubeNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { transcript: string; title?: string; videoUrl?: string }) => {
      const res = await fetch(api.notes.youtube.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to convert YouTube transcript");
      return (await res.json()).note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notes.list.path] });
      toast({ title: "Success", description: "YouTube lecture converted to notes" });
    },
    onError: (error) => {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    },
  });
}

export function useUrlNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { url: string; title?: string }) => {
      const res = await fetch(api.notes.url.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to convert URL to notes");
      return (await res.json()).note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notes.list.path] });
      toast({ title: "Success", description: "Article converted to study notes" });
    },
    onError: (error) => {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const url = buildUrl(api.notes.update.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update note");
      return (await res.json()).note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notes.list.path] });
      toast({ title: "Success", description: "Note updated" });
    },
    onError: (error) => {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const url = buildUrl(api.notes.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete note");
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notes.list.path] });
      toast({ title: "Success", description: "Note deleted" });
    },
    onError: (error) => {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    },
  });
}

export function useSearchNotes() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (query: string) => {
      const res = await fetch(api.notes.search.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error("Failed to search notes");
      return (await res.json()).results;
    },
    onError: (error) => {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    },
  });
}

export function useGenerateNoteMCQ() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (noteId: string) => {
      const url = buildUrl(api.notes.mcq.path, { id: noteId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to generate MCQ from note");
      return (await res.json()).quiz;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Quiz generated from note" });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    },
  });
}