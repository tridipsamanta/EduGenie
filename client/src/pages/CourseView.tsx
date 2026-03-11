import { Layout } from "@/components/Layout";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Lesson = {
  id: string;
  youtubeVideoId: string;
  title: string;
  duration: string;
  thumbnail: string;
  orderIndex: number;
  completed: boolean;
  watchedSeconds: number;
};

type Chapter = {
  id: string;
  title: string;
  summary: string;
  orderIndex: number;
  lessons: Lesson[];
};

type CourseDetailResponse = {
  course: {
    id: string;
    name: string;
    level: string;
    duration: string;
    description: string;
  };
  chapters: Chapter[];
  stats: {
    totalChapters: number;
    totalLessons: number;
    completedLessons: number;
    completionPercentage: number;
  };
};

type LearningAdvice = {
  advice: string;
  nextChapterFocus: string;
};

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function YouTubeTrackedPlayer({
  lesson,
  onPersistProgress,
}: {
  lesson: Lesson;
  onPersistProgress: (payload: {
    lessonId: string;
    watchedSeconds: number;
    totalSeconds: number;
  }) => Promise<void>;
}) {
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentRef = useRef(0);
  const onPersistProgressRef = useRef(onPersistProgress);
  const playerId = `lesson-player-${lesson.id}`;

  useEffect(() => {
    onPersistProgressRef.current = onPersistProgress;
  }, [onPersistProgress]);

  useEffect(() => {
    let mounted = true;

    const clearProgressTimer = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const sendProgress = async (force = false) => {
      if (!playerRef.current) return;
      const watchedSeconds = Number(playerRef.current.getCurrentTime?.() ?? 0);
      const totalSeconds = Number(playerRef.current.getDuration?.() ?? 0);

      if (!totalSeconds || watchedSeconds < 0) return;

      if (!force && watchedSeconds - lastSentRef.current < 8) return;
      lastSentRef.current = watchedSeconds;

      await onPersistProgressRef.current({ lessonId: lesson.id, watchedSeconds, totalSeconds });
    };

    const mountPlayer = () => {
      if (!mounted || !window.YT?.Player) return;

      playerRef.current = new window.YT.Player(playerId, {
        videoId: lesson.youtubeVideoId,
        playerVars: { rel: 0, modestbranding: 1, fs: 1, playsinline: 1 },
        events: {
          onReady: (event: any) => {
            const iframe = event?.target?.getIframe?.();
            if (iframe) {
              iframe.setAttribute("allowfullscreen", "true");
              iframe.setAttribute("allow", "fullscreen; autoplay; encrypted-media");
              iframe.style.width = "100%";
              iframe.style.height = "100%";
              iframe.style.display = "block";
            }

            if (lesson.watchedSeconds > 8) {
              event?.target?.seekTo?.(Math.floor(lesson.watchedSeconds), true);
            }
          },
          onStateChange: async (event: any) => {
            const state = event?.data;
            if (state === window.YT.PlayerState.PLAYING) {
              clearProgressTimer();
              intervalRef.current = setInterval(() => {
                void sendProgress(false);
              }, 5000);
            }
            if (state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.ENDED) {
              clearProgressTimer();
              await sendProgress(true);
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      mountPlayer();
    } else {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.body.appendChild(script);
      window.onYouTubeIframeAPIReady = mountPlayer;
    }

    return () => {
      mounted = false;
      clearProgressTimer();
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [lesson.id, lesson.youtubeVideoId, playerId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-muted/30 bg-card shadow-lg">
      <div className="aspect-video bg-muted">
        <div id={playerId} className="h-full w-full" />
      </div>
    </div>
  );
}

function GradientProgress({ value, heightClass = "h-1.5" }: { value: number; heightClass?: string }) {
  return (
    <div className={`w-full rounded-full bg-muted/50 ${heightClass}`}>
      <div
        className={`rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 ${heightClass} transition-all duration-300`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default function CourseView() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const [courseDetail, setCourseDetail] = useState<CourseDetailResponse | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [learningAdvice, setLearningAdvice] = useState<LearningAdvice | null>(null);
  const [lessonNotesByLessonId, setLessonNotesByLessonId] = useState<Record<string, string>>({});
  const [isGeneratingLessonNote, setIsGeneratingLessonNote] = useState(false);
  const [lessonNoteError, setLessonNoteError] = useState<string>("");

  const lessonNoteMarkdown = selectedLessonId ? lessonNotesByLessonId[selectedLessonId] || "" : "";

  const selectedLesson = useMemo(() => {
    if (!courseDetail || !selectedLessonId) return null;
    for (const chapter of courseDetail.chapters) {
      const found = chapter.lessons.find((lesson) => lesson.id === selectedLessonId);
      if (found) return found;
    }
    return null;
  }, [courseDetail, selectedLessonId]);

  const allLessons = useMemo(
    () => (courseDetail ? courseDetail.chapters.flatMap((chapter) => chapter.lessons) : []),
    [courseDetail]
  );

  const selectedLessonIndex = useMemo(
    () => allLessons.findIndex((lesson) => lesson.id === selectedLessonId),
    [allLessons, selectedLessonId]
  );

  const nextLesson =
    selectedLessonIndex >= 0 && selectedLessonIndex < allLessons.length - 1
      ? allLessons[selectedLessonIndex + 1]
      : null;

  useEffect(() => {
    setLessonNoteError("");
  }, [selectedLesson?.id]);

  useEffect(() => {
    setLessonNotesByLessonId({});
  }, [courseId]);

  // Load persisted lesson note from DB when lesson changes
  useEffect(() => {
    if (!courseId || !selectedLessonId) return;
    if (lessonNotesByLessonId[selectedLessonId]) return;

    let cancelled = false;

    const loadPersistedLessonNote = async () => {
      try {
        const params = new URLSearchParams({ courseId, lessonId: selectedLessonId });
        const response = await fetch(`/api/courses/lesson-note?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as { noteMarkdown?: string; found?: boolean };
        if (!cancelled && data.found && data.noteMarkdown) {
          setLessonNotesByLessonId((prev) => ({
            ...prev,
            [selectedLessonId]: data.noteMarkdown as string,
          }));
        }
      } catch (error) {
        console.error("Failed to load persisted lesson note:", error);
      }
    };

    void loadPersistedLessonNote();

    return () => {
      cancelled = true;
    };
  }, [courseId, selectedLessonId, lessonNotesByLessonId]);

  const fetchCourseDetail = async (targetCourseId: string, preferredLessonId?: string | null) => {
    setIsLoadingDetail(true);
    try {
      const response = await fetch(`/api/courses/${targetCourseId}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await response.json()) as CourseDetailResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to load course workspace");
      }

      setCourseDetail(data);

      const allLessons = data.chapters.flatMap((chapter) => chapter.lessons);
      const firstLessonId = allLessons[0]?.id || null;
      const chosenLesson =
        preferredLessonId && allLessons.some((lesson) => lesson.id === preferredLessonId)
          ? preferredLessonId
          : firstLessonId;

      setSelectedLessonId(chosenLesson);
    } catch (error) {
      toast({
        title: "Could not open workspace",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (!courseId) return;
    const preferredLessonId = searchParams.get("lesson");
    void fetchCourseDetail(courseId, preferredLessonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const handleSaveProgress = useCallback(async (payload: {
    lessonId: string;
    watchedSeconds: number;
    totalSeconds: number;
    completedOverride?: boolean;
  }) => {
    try {
      console.log("📤 [CourseView] Sending progress update:", payload);
      const response = await fetch("/api/progress/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        success?: boolean;
        completed?: boolean;
        stats?: {
          totalLessons: number;
          completedLessons: number;
          completionPercentage: number;
        };
        learningAdvice?: LearningAdvice | null;
        error?: string;
      };

      console.log("📥 [CourseView] Response status:", response.status, "Data:", data);

      if (!response.ok) {
        console.error("❌ [CourseView] API error:", data.error);
        throw new Error(data.error || "Failed to save progress");
      }

      console.log("✅ [CourseView] Progress saved successfully");

      if (courseDetail && data.stats) {
        setCourseDetail({
          ...courseDetail,
          stats: {
            totalChapters: courseDetail.stats.totalChapters,
            totalLessons: data.stats.totalLessons,
            completedLessons: data.stats.completedLessons,
            completionPercentage: data.stats.completionPercentage,
          },
          chapters: courseDetail.chapters.map((chapter) => ({
            ...chapter,
            lessons: chapter.lessons.map((lesson) =>
              lesson.id === payload.lessonId
                ? {
                    ...lesson,
                    completed: data.completed ?? lesson.completed,
                    watchedSeconds:
                      payload.completedOverride === false
                        ? Math.floor(payload.watchedSeconds)
                        : Math.max(lesson.watchedSeconds, Math.floor(payload.watchedSeconds)),
                  }
                : lesson
            ),
          })),
        });
      }

      if (data.learningAdvice) {
        setLearningAdvice(data.learningAdvice);
      }
    } catch (error) {
      toast({
        title: "Progress sync failed",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
      throw error; // Re-throw so optimistic updates can be reverted
    }
  }, [courseDetail, toast]);

  const handleManualToggle = async (lessonId: string, checked: boolean) => {
    // Optimistic UI update - update immediately before API call
    if (courseDetail) {
      setCourseDetail({
        ...courseDetail,
        chapters: courseDetail.chapters.map((chapter) => ({
          ...chapter,
          lessons: chapter.lessons.map((lesson) =>
            lesson.id === lessonId
              ? { ...lesson, completed: checked }
              : lesson
          ),
        })),
      });
    }

    // Then sync with server in background
    try {
      await handleSaveProgress({
        lessonId,
        watchedSeconds: checked ? 1 : 0,
        totalSeconds: 1,
        completedOverride: checked,
      });
    } catch (error) {
      // Revert optimistic update on error
      if (courseDetail) {
        setCourseDetail({
          ...courseDetail,
          chapters: courseDetail.chapters.map((chapter) => ({
            ...chapter,
            lessons: chapter.lessons.map((lesson) =>
              lesson.id === lessonId
                ? { ...lesson, completed: !checked }
                : lesson
            ),
          })),
        });
      }
      // Error toast already shown by handleSaveProgress
    }
  };

  const handleGenerateLessonNote = async () => {
    if (!selectedLesson || !courseDetail || !courseId) return;

    setIsGeneratingLessonNote(true);
    setLessonNoteError("");
    try {
      const response = await fetch("/api/courses/lesson-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          courseId,
          lessonId: selectedLesson.id,
        }),
      });

      const data = (await response.json()) as {
        noteMarkdown?: string;
        usedFallback?: boolean;
        warning?: string;
        error?: string;
      };

      if (!response.ok || !data.noteMarkdown) {
        throw new Error(data.error || "Failed to generate note");
      }

      setLessonNotesByLessonId((prev) => ({
        ...prev,
        [selectedLesson.id]: data.noteMarkdown as string,
      }));
      if (data.usedFallback && data.warning) {
        toast({
          title: "Generated with fallback",
          description: data.warning,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      setLessonNoteError(message);
      toast({
        title: "Note generation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingLessonNote(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="ghost" className="gap-2" onClick={() => navigate("/my-courses")}> 
            <ArrowLeft className="h-4 w-4" />
            Back to Courses
          </Button>
        </div>

        {isLoadingDetail ? (
          <Card className="rounded-2xl border border-muted/30 bg-card/80 shadow-lg shadow-black/10 backdrop-blur">
            <CardContent className="min-h-[220px] flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </CardContent>
          </Card>
        ) : !courseDetail ? (
          <Card className="rounded-2xl border border-muted/30 bg-card/80 shadow-lg shadow-black/10 backdrop-blur">
            <CardContent className="min-h-[220px] flex items-center justify-center text-muted-foreground">
              Course not found.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="rounded-2xl border border-muted/30 bg-card/80 shadow-lg shadow-black/10 backdrop-blur">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <CardTitle className="text-2xl font-semibold">{courseDetail.course.name}</CardTitle>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      {courseDetail.course.level}
                    </span>
                    <span className="text-sm text-muted-foreground">{courseDetail.course.duration}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <GradientProgress value={courseDetail.stats.completionPercentage} heightClass="h-2" />
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Total Chapters: {courseDetail.stats.totalChapters}</span>
                  <span>Total Lessons: {courseDetail.stats.totalLessons}</span>
                  <span>Completion: {courseDetail.stats.completionPercentage}%</span>
                </div>
              </CardContent>
            </Card>

            {learningAdvice ? (
              <Card className="rounded-2xl border border-muted/30 bg-card/80 shadow-lg shadow-black/10 backdrop-blur">
                <CardHeader>
                  <CardTitle>Personalized Advice</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>{learningAdvice.advice}</p>
                  <p className="text-muted-foreground">Focus next: {learningAdvice.nextChapterFocus}</p>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
              <div className="min-w-0 space-y-6">
                {selectedLesson ? (
                  <Card className="overflow-hidden rounded-2xl border border-muted/30 bg-card/80 shadow-lg shadow-black/10 backdrop-blur">
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-xl font-semibold">{selectedLesson.title}</CardTitle>
                          <CardDescription>{selectedLesson.duration}</CardDescription>
                        </div>
                        {nextLesson ? (
                          <Button variant="outline" onClick={() => setSelectedLessonId(nextLesson.id)}>
                            Next Lesson
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <YouTubeTrackedPlayer lesson={selectedLesson} onPersistProgress={handleSaveProgress} />
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="rounded-2xl border border-muted/30 bg-card/80 shadow-lg shadow-black/10 backdrop-blur">
                    <CardContent className="min-h-[220px] flex items-center justify-center text-muted-foreground">
                      No lesson found for this course.
                    </CardContent>
                  </Card>
                )}

                {selectedLesson ? (
                  <Card className="rounded-2xl border border-muted/30 bg-card/80 shadow-lg shadow-black/10 backdrop-blur">
                    <CardHeader className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          AI Lesson Notes
                        </CardTitle>
                        <Button onClick={handleGenerateLessonNote} disabled={isGeneratingLessonNote}>
                          {isGeneratingLessonNote ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          {lessonNoteMarkdown ? "Regenerate" : "Generate Notes"}
                        </Button>
                      </div>
                      <CardDescription>
                        Structured notes are shown here only for the selected video lesson (not saved to My Notes).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="min-w-0">
                      {lessonNoteError ? (
                        <p className="text-sm text-destructive">{lessonNoteError}</p>
                      ) : lessonNoteMarkdown ? (
                        <div className="prose prose-purple max-w-none min-w-0 space-y-4 overflow-x-hidden break-words leading-7 dark:prose-invert">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ children, ...props }) => (
                                <h1 className="mb-6 mt-8 break-words border-b-4 border-gradient-to-r from-blue-200 via-purple-200 to-pink-200 pb-3 text-3xl font-bold text-black dark:text-white md:text-4xl" {...props}>
                                  {children}
                                </h1>
                              ),
                              h2: ({ children, ...props }) => (
                                <h2 className="mb-4 mt-8 flex items-center gap-2 break-words text-2xl font-bold text-teal-600 dark:text-teal-400 md:text-3xl" {...props}>
                                  {children}
                                </h2>
                              ),
                              h3: ({ children, ...props }) => (
                                <h3 className="mb-3 mt-6 break-words text-xl font-semibold text-indigo-500 dark:text-indigo-400 md:text-2xl" {...props}>
                                  {children}
                                </h3>
                              ),
                              h4: ({ children, ...props }) => (
                                <h4 className="mb-2 mt-4 break-words text-lg font-semibold text-rose-600 dark:text-rose-400 md:text-xl" {...props}>
                                  {children}
                                </h4>
                              ),
                              p: ({ children, ...props }) => (
                                <p className="mb-4 break-words text-base leading-relaxed text-slate-700 dark:text-slate-300" {...props}>
                                  {children}
                                </p>
                              ),
                              ul: ({ children, ...props }) => (
                                <ul className="mb-4 space-y-2 pl-6 list-none text-base" {...props}>
                                  {children}
                                </ul>
                              ),
                              ol: ({ children, ...props }) => (
                                <ol className="mb-4 space-y-2 pl-6 list-decimal marker:text-blue-500 marker:font-semibold text-base" {...props}>
                                  {children}
                                </ol>
                              ),
                              li: ({ children, ...props }) => (
                                <li className="relative break-words pl-6 text-base text-slate-700 before:absolute before:left-0 before:font-bold before:text-emerald-500 before:content-['▸'] dark:text-slate-300" {...props}>
                                  {children}
                                </li>
                              ),
                              strong: ({ children, ...props }) => (
                                <strong className="font-bold text-blue-700 dark:text-blue-400 text-base" {...props}>
                                  {children}
                                </strong>
                              ),
                              em: ({ children, ...props }) => (
                                <em className="italic text-amber-600 dark:text-amber-400 text-base" {...props}>
                                  {children}
                                </em>
                              ),
                              code: ({ children, className, ...props }) => {
                                const isInline = !className;
                                return isInline ? (
                                  <code className="break-all rounded bg-sky-100 px-2 py-1 font-mono text-base text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" {...props}>
                                    {children}
                                  </code>
                                ) : (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              },
                              pre: ({ children, ...props }) => (
                                <pre className="mb-4 max-w-full overflow-x-auto rounded-lg border-l-4 border-cyan-400 bg-slate-900 p-4 text-base dark:bg-slate-950" {...props}>
                                  <code className="text-slate-100 font-mono text-base">{children}</code>
                                </pre>
                              ),
                              blockquote: ({ children, ...props }) => (
                                <blockquote className="mb-4 pl-4 py-2 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-r-lg italic text-amber-900 dark:text-amber-200 text-base" {...props}>
                                  {children}
                                </blockquote>
                              ),
                              table: ({ children, ...props }) => (
                                <div className="mb-4 w-full max-w-full overflow-x-auto text-base">
                                  <table className="min-w-full border-collapse border border-teal-200 dark:border-teal-700" {...props}>
                                    {children}
                                  </table>
                                </div>
                              ),
                              thead: ({ children, ...props }) => (
                                <thead className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-pink-900/30" {...props}>
                                  {children}
                                </thead>
                              ),
                              th: ({ children, ...props }) => (
                                <th className="border border-teal-200 px-4 py-2 text-left text-base font-bold text-teal-800 dark:border-teal-700 dark:text-teal-200" {...props}>
                                  {children}
                                </th>
                              ),
                              td: ({ children, ...props }) => (
                                <td className="border border-teal-200 px-4 py-2 text-base text-slate-700 dark:border-teal-700 dark:text-slate-300" {...props}>
                                  {children}
                                </td>
                              ),
                              hr: ({ ...props }) => (
                                <hr className="my-8 border-t-2 border-gradient-to-r from-blue-200 via-purple-200 to-pink-200" {...props} />
                              ),
                              a: ({ children, ...props }) => (
                                <a className="break-all text-base font-medium text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" {...props}>
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {lessonNoteMarkdown}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Click Generate Notes to create a detailed note for this lesson.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="rounded-2xl border border-muted/30 bg-card/80 shadow-lg shadow-black/10 backdrop-blur">
                  <CardHeader>
                    <CardTitle>Course Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{courseDetail.course.description}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden">
                <Card className="rounded-2xl border border-muted/30 bg-gradient-to-br from-card/95 to-card/80 shadow-2xl shadow-purple-500/10 backdrop-blur-xl h-full flex flex-col overflow-hidden">
                  <CardHeader className="border-b border-muted/20 bg-gradient-to-r from-purple-500/5 to-indigo-500/5">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                        {courseDetail.course.name}
                      </CardTitle>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">Progress</span>
                        <span className="text-xs font-semibold text-emerald-600">
                          {courseDetail.stats.completedLessons} of {courseDetail.stats.totalLessons} lessons
                        </span>
                      </div>
                      <GradientProgress value={courseDetail.stats.completionPercentage} heightClass="h-2.5" />
                      <p className="text-xs font-semibold text-purple-600">{courseDetail.stats.completionPercentage}% Complete</p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 overflow-y-auto px-4 py-4 smooth-scroll">
                    <Accordion type="single" collapsible className="space-y-3">
                      {courseDetail.chapters.map((chapter, chapterIndex) => {
                        const chapterCompleted = chapter.lessons.filter((lesson) => lesson.completed).length;
                        const chapterTotal = chapter.lessons.length;
                        const isCurrentChapter = chapter.lessons.some((lesson) => lesson.id === selectedLessonId);
                        return (
                          <AccordionItem
                            value={chapter.id}
                            key={chapter.id}
                            className="border-0 rounded-lg overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <AccordionTrigger className="hover:no-underline px-4 py-3 [&[data-state=open]]:bg-muted/60">
                              <div className="flex w-full items-center justify-between pr-2 text-left gap-3">
                                <div className="flex items-center gap-3">
                                  {isCurrentChapter && (
                                    <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                                  )}
                                  <span className="text-sm font-semibold">
                                    {chapterIndex + 1}. {chapter.title}
                                  </span>
                                </div>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-full">
                                  {chapterCompleted}/{chapterTotal}
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-3">
                              <p className="mb-4 mt-2 text-xs leading-relaxed text-muted-foreground italic border-l-2 border-purple-500/30 pl-3">
                                {chapter.summary}
                              </p>
                              <div className="space-y-1.5">
                                {chapter.lessons.map((lesson, lessonIndex) => {
                                  const isSelected = selectedLessonId === lesson.id;
                                  return (
                                    <div
                                      key={lesson.id}
                                      className={`group relative rounded-lg transition-all ${
                                        isSelected
                                          ? "bg-gradient-to-r from-purple-500/10 to-indigo-500/10 ring-2 ring-purple-500/20"
                                          : "hover:bg-muted/70"
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => setSelectedLessonId(lesson.id)}
                                        className="w-full text-left p-3"
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className="flex-shrink-0 mt-0.5">
                                            {lesson.completed ? (
                                              <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                                <CheckCircle2 className="h-3 w-3 text-white" />
                                              </div>
                                            ) : (
                                              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                                                <div className="h-0 w-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-muted-foreground/50 border-b-[4px] border-b-transparent ml-0.5" />
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                              <span className={`text-sm leading-snug ${
                                                isSelected 
                                                  ? "font-semibold text-foreground" 
                                                  : lesson.completed
                                                  ? "font-medium text-muted-foreground"
                                                  : "font-medium"
                                              }`}>
                                                {lesson.title}
                                              </span>
                                            </div>
                                            <div className="mt-1.5 flex items-center gap-3">
                                              <p className="text-xs text-muted-foreground font-medium">
                                                {lesson.duration}
                                              </p>
                                              {!lesson.completed && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    void handleManualToggle(lesson.id, true);
                                                  }}
                                                  className="text-xs text-purple-600 hover:text-purple-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                  Mark complete
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
