"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/app/components/ui/accordion";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";

type LessonItem = {
  id: string;
  youtubeVideoId: string;
  title: string;
  duration: string;
  thumbnail: string;
  orderIndex: number;
  completed: boolean;
  watchedSeconds: number;
};

type ChapterItem = {
  id: string;
  title: string;
  summary: string;
  orderIndex: number;
  lessons: LessonItem[];
};

type PlayerProps = {
  course: {
    id: string;
    name: string;
    level: string;
    duration: string;
    description: string;
  };
  chapters: ChapterItem[];
  stats: {
    totalChapters: number;
    totalLessons: number;
    completedLessons: number;
    completionPercentage: number;
  };
  initialLessonId: string | null;
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

function YouTubeTrackedPlayer(props: {
  lessonId: string;
  videoId: string;
  onPersistProgress: (payload: {
    lessonId: string;
    watchedSeconds: number;
    totalSeconds: number;
  }) => Promise<void>;
}) {
  const playerRef = useRef<any>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentSecondsRef = useRef(0);
  const containerId = useMemo(() => `yt-player-${props.lessonId}`, [props.lessonId]);

  useEffect(() => {
    let isMounted = true;

    function clearTimer() {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }

    async function sendProgress(force = false) {
      if (!playerRef.current) {
        return;
      }

      const currentTime = Number(playerRef.current.getCurrentTime?.() ?? 0);
      const duration = Number(playerRef.current.getDuration?.() ?? 0);

      if (!duration || currentTime < 0) {
        return;
      }

      const hasEnoughDelta = currentTime - lastSentSecondsRef.current >= 8;
      if (!force && !hasEnoughDelta) {
        return;
      }

      lastSentSecondsRef.current = currentTime;
      await props.onPersistProgress({
        lessonId: props.lessonId,
        watchedSeconds: currentTime,
        totalSeconds: duration,
      });
    }

    function bootstrapPlayer() {
      if (!isMounted || !window.YT?.Player) {
        return;
      }

      playerRef.current = new window.YT.Player(containerId, {
        videoId: props.videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onStateChange: async (event: any) => {
            const state = event?.data;

            if (state === window.YT.PlayerState.PLAYING) {
              clearTimer();
              progressTimerRef.current = setInterval(() => {
                sendProgress(false);
              }, 5000);
            }

            if (
              state === window.YT.PlayerState.PAUSED ||
              state === window.YT.PlayerState.ENDED
            ) {
              clearTimer();
              await sendProgress(true);
            }
          },
        },
      });
    }

    if (window.YT?.Player) {
      bootstrapPlayer();
    } else {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.body.appendChild(script);
      window.onYouTubeIframeAPIReady = bootstrapPlayer;
    }

    return () => {
      isMounted = false;
      clearTimer();
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [containerId, props]);

  return (
    <div className="overflow-hidden rounded-xl shadow-sm">
      <div className="aspect-video bg-muted">
        <div id={containerId} className="h-full w-full" />
      </div>
    </div>
  );
}

export function CoursePlayer({ course, chapters, stats, initialLessonId }: PlayerProps) {
  const [chapterState, setChapterState] = useState(chapters);
  const [localStats, setLocalStats] = useState(stats);
  const [isPersisting, setIsPersisting] = useState(false);
  const [learningAdvice, setLearningAdvice] = useState<LearningAdvice | null>(null);

  const allLessons = useMemo(
    () => chapterState.flatMap((chapter) => chapter.lessons),
    [chapterState]
  );

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    initialLessonId && allLessons.some((lesson) => lesson.id === initialLessonId)
      ? initialLessonId
      : allLessons[0]?.id ?? null
  );

  const selectedLesson = allLessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

  async function persistProgress(payload: {
    lessonId: string;
    watchedSeconds: number;
    totalSeconds: number;
  }) {
    setIsPersisting(true);

    try {
      const response = await fetch("/api/progress/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        completed?: boolean;
        stats?: {
          totalLessons: number;
          completedLessons: number;
          completionPercentage: number;
        };
        learningAdvice?: LearningAdvice | null;
      };

      if (!response.ok) {
        return;
      }

      if (data.stats) {
        setLocalStats((previous) => ({
          ...previous,
          totalLessons: data.stats?.totalLessons ?? previous.totalLessons,
          completedLessons: data.stats?.completedLessons ?? previous.completedLessons,
          completionPercentage:
            data.stats?.completionPercentage ?? previous.completionPercentage,
        }));
      }

      if (data.completed) {
        setChapterState((previous) =>
          previous.map((chapter) => ({
            ...chapter,
            lessons: chapter.lessons.map((lesson) =>
              lesson.id === payload.lessonId
                ? {
                    ...lesson,
                    completed: true,
                    watchedSeconds: Math.max(lesson.watchedSeconds, Math.floor(payload.watchedSeconds)),
                  }
                : lesson
            ),
          }))
        );
      }

      if (data.learningAdvice) {
        setLearningAdvice(data.learningAdvice);
      }
    } finally {
      setIsPersisting(false);
    }
  }

  if (!selectedLesson) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No lessons available for this course yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{course.name}</h1>
            <p className="text-sm text-muted-foreground">
              {course.level} • {course.duration}
            </p>
          </div>
          <Link href="/workspace/my-courses">
            <Button variant="outline" className="rounded-xl">
              Back to My Courses
            </Button>
          </Link>
        </div>

        <Card className="mb-6 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Course Progress</CardTitle>
            <CardDescription>
              {localStats.completedLessons}/{localStats.totalLessons} lessons completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={localStats.completionPercentage} className="mb-2" />
            <p className="text-sm text-muted-foreground">{localStats.completionPercentage}% complete</p>
          </CardContent>
        </Card>

        {learningAdvice ? (
          <Card className="mb-6 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Personalized Advice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{learningAdvice.advice}</p>
              <p className="text-muted-foreground">Next focus: {learningAdvice.nextChapterFocus}</p>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          <Card className="h-fit rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Chapters</CardTitle>
              <CardDescription>{localStats.totalChapters} total chapters</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                {chapterState.map((chapter, chapterIndex) => (
                  <AccordionItem key={chapter.id} value={chapter.id}>
                    <AccordionTrigger>
                      <span className="text-left text-sm">
                        {chapterIndex + 1}. {chapter.title}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-3 text-xs text-muted-foreground">{chapter.summary}</p>
                      <div className="space-y-2">
                        {chapter.lessons.map((lesson) => (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => setSelectedLessonId(lesson.id)}
                            className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                              selectedLessonId === lesson.id
                                ? "border-primary bg-secondary"
                                : "border-border hover:bg-secondary"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span>{lesson.title}</span>
                              {lesson.completed ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{lesson.duration}</p>
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle>{selectedLesson.title}</CardTitle>
                <CardDescription>{selectedLesson.duration}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <YouTubeTrackedPlayer
                  lessonId={selectedLesson.id}
                  videoId={selectedLesson.youtubeVideoId}
                  onPersistProgress={persistProgress}
                />

                <p className="text-sm text-muted-foreground">
                  Continue learning with this lesson and your progress will be saved automatically.
                </p>

                {isPersisting ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving progress...
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle>Course Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{course.description}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
