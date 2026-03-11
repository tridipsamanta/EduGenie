function getLevelBadge(level: string) {
  if (level === "Beginner") return "bg-green-100 text-green-700";
  if (level === "Intermediate") return "bg-yellow-100 text-yellow-700";
  if (level === "Advanced") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

import { Layout } from "@/components/Layout";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Brain, Clock3, GraduationCap, ImagePlus, Loader2, PlayCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CourseLevel = "Beginner" | "Intermediate" | "Advanced";

type CourseSummary = {
  id: string;
  name: string;
  level: string;
  duration: string;
  description: string;
  thumbnail?: string;
  thumbnailPositionX?: number;
  thumbnailPositionY?: number;
  totalChapters: number;
  totalLessons: number;
  completedLessons: number;
  completionPercentage: number;
  resumeLessonId: string | null;
};

type CreateFormState = {
  courseName: string;
  chapterCount: number;
  level: CourseLevel;
  duration: string;
  description: string;
  thumbnail: string;
  thumbnailPositionX: number;
  thumbnailPositionY: number;
};

const initialFormState: CreateFormState = {
  courseName: "",
  chapterCount: 6,
  level: "Beginner",
  duration: "8 weeks",
  description: "",
  thumbnail: "",
  thumbnailPositionX: 50,
  thumbnailPositionY: 50,
};

const generationMessages = [
  "Mapping out a learning journey tailored to your goal...",
  "Designing chapter milestones and knowledge checkpoints...",
  "Blending real-world practice with crisp theory lessons...",
  "Sequencing lessons for steady momentum and quick wins...",
  "Polishing your AI course so it feels clear, structured, and exciting...",
];

const generationSteps = [
  {
    title: "Planning the roadmap",
    description: "Finding the right scope, chapter flow, and pacing.",
    icon: Brain,
  },
  {
    title: "Crafting the curriculum",
    description: "Breaking your topic into practical lessons and milestones.",
    icon: BookOpen,
  },
  {
    title: "Preparing a smooth start",
    description: "Finishing the course structure so you can jump in right away.",
    icon: GraduationCap,
  },
];

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

export default function MyCourses() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseSummary | null>(null);
  const [formState, setFormState] = useState<CreateFormState>(initialFormState);
  const [generationMessageIndex, setGenerationMessageIndex] = useState(0);

  const handleThumbnailUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Please choose an image under 2MB.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setFormState((prev) => ({ ...prev, thumbnail: result, thumbnailPositionX: 50, thumbnailPositionY: 50 }));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const totalSummary = useMemo(() => {
    const totalCourses = courses.length;
    const totalLessons = courses.reduce((acc, item) => acc + item.totalLessons, 0);
    const completedLessons = courses.reduce((acc, item) => acc + item.completedLessons, 0);
    const completionPercentage = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
    return { totalCourses, totalLessons, completedLessons, completionPercentage };
  }, [courses]);

  const fetchCourses = async () => {
    setIsLoadingCourses(true);
    try {
      const response = await fetch("/api/courses", { credentials: "include", cache: "no-store" });
      const data = (await response.json()) as { courses?: CourseSummary[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to load courses");
      }

      const result = data.courses || [];
      setCourses(result);
    } catch (error) {
      toast({
        title: "Could not load courses",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCourses(false);
    }
  };

  useEffect(() => {
    void fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isCreating) {
      setGenerationMessageIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setGenerationMessageIndex((current) => (current + 1) % generationMessages.length);
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, [isCreating]);

  const handleCreateCourse = async () => {
    setIsCreating(true);

    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formState),
      });
      const data = (await response.json()) as { courseId?: string; error?: string };

      if (!response.ok || !data.courseId) {
        throw new Error(data.error || "Failed to create course");
      }

      setIsCreateOpen(false);
      setFormState(initialFormState);
      await fetchCourses();
      navigate(`/my-courses/${data.courseId}`);

      toast({ title: "Course created", description: "AI curriculum and lessons are ready." });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Unexpected error";
      const description = /429|quota|RESOURCE_EXHAUSTED|QuotaFailure/i.test(rawMessage)
        ? "AI quota reached. Verify API keys in backend/.env and restart backend."
        : rawMessage;
      toast({
        title: "Create course failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCourse = async (course: CourseSummary) => {
    setDeletingCourseId(course.id);
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete course");
      }

      await fetchCourses();
      setDeleteTarget(null);
      toast({ title: "Course deleted", description: `"${course.name}" was removed.` });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setDeletingCourseId(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">My Courses</h1>
            <p className="text-muted-foreground">
              Create AI-powered course plans, stream lessons, and continue from saved progress.
            </p>
          </div>

          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              if (isCreating) return;
              setIsCreateOpen(open);
            }}
          >
            <DialogTrigger asChild>
              <Button className="rounded-full px-6" size="lg">
                <Plus className="mr-2 h-4 w-4" />
                New Course
              </Button>
            </DialogTrigger>
            <DialogContent
              hideCloseButton={isCreating}
              onEscapeKeyDown={(event) => {
                if (isCreating) event.preventDefault();
              }}
              onInteractOutside={(event) => {
                if (isCreating) event.preventDefault();
              }}
              className="max-h-[92vh] max-w-2xl overflow-y-auto border-border/50 bg-gradient-to-br from-background via-background to-muted/40 p-0 shadow-2xl shadow-black/20 backdrop-blur"
            >
              {isCreating ? (
                <div className="relative min-h-[540px] overflow-hidden px-6 py-8">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(79,70,229,0.18),transparent_30%)]" />
                  <div className="pointer-events-none absolute -right-10 top-10 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl" />
                  <div className="pointer-events-none absolute -left-10 bottom-10 h-36 w-36 rounded-full bg-indigo-500/20 blur-3xl" />

                  <div className="relative flex min-h-[492px] flex-col justify-between">
                    <div className="space-y-4 text-center">
                      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary shadow-sm shadow-primary/10">
                        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                        AI Curriculum Studio
                      </div>

                      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-primary/20 bg-background/70 shadow-2xl shadow-primary/10 backdrop-blur">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary via-purple-500 to-indigo-500 text-primary-foreground shadow-lg shadow-primary/30">
                          <Loader2 className="h-7 w-7 animate-spin" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <DialogTitle className="text-3xl font-semibold tracking-tight">Generating your course</DialogTitle>
                        <DialogDescription className="mx-auto max-w-xl text-base leading-7 text-muted-foreground">
                          Sit back while the AI designs your course structure, chapters, and learning flow.
                        </DialogDescription>
                      </div>

                      <div className="mx-auto max-w-xl rounded-3xl border border-border/60 bg-background/75 px-6 py-5 text-left shadow-xl shadow-black/10 backdrop-blur-sm">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">Currently happening</p>
                        <p className="min-h-[56px] text-lg font-medium leading-8 text-foreground transition-all duration-500">
                          {generationMessages[generationMessageIndex]}
                        </p>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted/70">
                          <div className="h-full w-1/2 animate-[pulse_1.8s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-primary via-purple-500 to-indigo-500" />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      {generationSteps.map((step, index) => {
                        const Icon = step.icon;
                        return (
                          <div
                            key={step.title}
                            className="rounded-2xl border border-border/60 bg-background/70 p-4 shadow-lg shadow-black/5 backdrop-blur-sm"
                            style={{ animationDelay: `${index * 180}ms` }}
                          >
                            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-purple-500/20 to-indigo-500/20 text-primary">
                              <Icon className="h-5 w-5" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">{step.title}</p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative space-y-6 p-6">
                    <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
                    <div className="pointer-events-none absolute -left-20 bottom-0 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl" />
                    <DialogHeader className="space-y-3">
                      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm shadow-black/10">
                        <Sparkles className="h-3.5 w-3.5" />
                        AI Curriculum Studio
                      </div>
                      <DialogTitle className="text-2xl font-semibold tracking-tight">Create a new course</DialogTitle>
                      <DialogDescription className="text-sm text-muted-foreground">
                        Share your learning goal and we will generate a structured curriculum with lessons.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 rounded-2xl border border-border/60 bg-background/65 p-4 shadow-xl shadow-black/10 backdrop-blur-sm">
                      <div className="space-y-2">
                        <Label htmlFor="courseName" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Course name
                        </Label>
                        <Input
                          id="courseName"
                          className="h-11 rounded-lg border-border/60 bg-background/90 shadow-sm shadow-black/5"
                          value={formState.courseName}
                          onChange={(event) => setFormState((prev) => ({ ...prev, courseName: event.target.value }))}
                          placeholder="Prompt engineering"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="chapterCount" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Chapters
                          </Label>
                          <Input
                            id="chapterCount"
                            className="h-11 rounded-lg border-border/60 bg-background/90 shadow-sm shadow-black/5"
                            type="number"
                            min={3}
                            max={12}
                            value={formState.chapterCount}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                chapterCount: Number(event.target.value),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Level</Label>
                          <Select
                            value={formState.level}
                            onValueChange={(value) => setFormState((prev) => ({ ...prev, level: value as CourseLevel }))}
                          >
                            <SelectTrigger className="h-11 rounded-lg border-border/60 bg-background/90 shadow-sm shadow-black/5">
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Beginner">Beginner</SelectItem>
                              <SelectItem value="Intermediate">Intermediate</SelectItem>
                              <SelectItem value="Advanced">Advanced</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="duration" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Estimated duration
                          </Label>
                          <Input
                            id="duration"
                            className="h-11 rounded-lg border-border/60 bg-background/90 shadow-sm shadow-black/5"
                            value={formState.duration}
                            onChange={(event) => setFormState((prev) => ({ ...prev, duration: event.target.value }))}
                            placeholder="6 weeks"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="thumbnail" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Course thumbnail
                        </Label>
                        <Input
                          id="thumbnail"
                          className="h-11 rounded-lg border-border/60 bg-background/90 shadow-sm shadow-black/5"
                          value={formState.thumbnail}
                          onChange={(event) => setFormState((prev) => ({ ...prev, thumbnail: event.target.value }))}
                          placeholder="https://example.com/cover.jpg"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Label
                            htmlFor="thumbnailUpload"
                            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/40"
                          >
                            <ImagePlus className="h-3.5 w-3.5" />
                            Upload image
                          </Label>
                          <Input id="thumbnailUpload" type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
                          {formState.thumbnail ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 rounded-full px-3 text-xs"
                              onClick={() =>
                                setFormState((prev) => ({
                                  ...prev,
                                  thumbnail: "",
                                  thumbnailPositionX: 50,
                                  thumbnailPositionY: 50,
                                }))
                              }
                            >
                              Clear thumbnail
                            </Button>
                          ) : null}
                        </div>
                        {formState.thumbnail ? (
                          <>
                            <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
                              <img
                                src={formState.thumbnail}
                                alt="Course thumbnail preview"
                                className="h-36 w-full object-cover"
                                style={{
                                  objectPosition: `${formState.thumbnailPositionX}% ${formState.thumbnailPositionY}%`,
                                }}
                              />
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Horizontal focus</span>
                                  <span>{formState.thumbnailPositionX}%</span>
                                </div>
                                <Input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={formState.thumbnailPositionX}
                                  onChange={(event) =>
                                    setFormState((prev) => ({
                                      ...prev,
                                      thumbnailPositionX: Number(event.target.value),
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Vertical focus</span>
                                  <span>{formState.thumbnailPositionY}%</span>
                                </div>
                                <Input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={formState.thumbnailPositionY}
                                  onChange={(event) =>
                                    setFormState((prev) => ({
                                      ...prev,
                                      thumbnailPositionY: Number(event.target.value),
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          What should the course cover?
                        </Label>
                        <Textarea
                          id="description"
                          className="min-h-[120px] rounded-lg border-border/60 bg-background/90 shadow-sm shadow-black/5"
                          value={formState.description}
                          onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                          placeholder="Include practical projects, checkpoints, and real-world examples."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-background/70 px-6 py-4 backdrop-blur-sm">
                    <Button variant="ghost" className="rounded-full" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      className="rounded-full bg-gradient-to-r from-primary via-purple-500 to-indigo-500 px-6 text-primary-foreground shadow-lg shadow-primary/30"
                      onClick={handleCreateCourse}
                      disabled={isCreating}
                    >
                      Generate with AI
                    </Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border border-muted/30 bg-card/80 shadow-lg shadow-black/10 backdrop-blur">
            <CardHeader>
              <CardDescription>Total Courses</CardDescription>
              <CardTitle className="text-3xl font-semibold">{totalSummary.totalCourses}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-2xl border border-muted/30 bg-card/80 shadow-lg shadow-black/10 backdrop-blur">
            <CardHeader>
              <CardDescription>Total Lessons</CardDescription>
              <CardTitle className="text-3xl font-semibold">{totalSummary.totalLessons}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-2xl border border-muted/30 bg-card/80 shadow-lg shadow-black/10 backdrop-blur">
            <CardHeader>
              <CardDescription>Completed Lessons</CardDescription>
              <CardTitle className="text-3xl font-semibold">{totalSummary.completedLessons}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-2xl border border-muted/30 bg-card/80 shadow-lg shadow-black/10 backdrop-blur">
            <CardHeader>
              <CardDescription>Overall Progress</CardDescription>
              <CardTitle className="text-3xl font-semibold">{totalSummary.completionPercentage}%</CardTitle>
            </CardHeader>
            <CardContent>
              <GradientProgress value={totalSummary.completionPercentage} heightClass="h-2" />
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border border-border/50 bg-card shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Your Courses</CardTitle>
            <CardDescription>Pick a course and resume from the latest lesson.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingCourses ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : courses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-muted/40 bg-muted/20 px-6 py-8 text-sm text-muted-foreground">
                No courses yet. Create your first AI course to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {courses.map((course) => {
                  return (
                    <div key={course.id} className="group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                      <div className="relative aspect-[16/9] overflow-hidden">
                        {course.thumbnail ? (
                          <img
                            src={course.thumbnail}
                            alt={course.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            style={{
                              objectPosition: `${course.thumbnailPositionX ?? 50}% ${course.thumbnailPositionY ?? 50}%`,
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500/70 via-indigo-500/60 to-cyan-500/60 text-4xl font-bold text-white/95">
                            {getInitials(course.name) || "AI"}
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent dark:from-black/70" />
                        <div className="absolute left-3 top-3 flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getLevelBadge(course.level)}`}>{course.level}</span>
                          <span className="rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white/90">AI Generated</span>
                        </div>
                        <div className="absolute right-3 top-3">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70"
                            disabled={deletingCourseId === course.id}
                            onClick={() => setDeleteTarget(course)}
                          >
                            {deletingCourseId === course.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="flex h-full flex-col p-4">
                        <h3 className="line-clamp-2 text-2xl font-bold leading-tight text-foreground">
                          {course.name}
                        </h3>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                            <p className="font-semibold">{course.totalChapters} Chapters</p>
                          </div>
                          <div className="rounded-xl border border-orange-500/35 bg-orange-500/10 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
                            <p className="font-semibold">{course.totalLessons} Lessons</p>
                          </div>
                          <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-xs text-sky-700 dark:text-sky-300">
                            <p className="flex items-center gap-1 font-semibold"><Clock3 className="h-3.5 w-3.5" />{course.duration}</p>
                          </div>
                          <div className="rounded-xl border border-violet-500/35 bg-violet-500/10 px-3 py-2 text-xs text-violet-700 dark:text-violet-300">
                            <p className="flex items-center gap-1 font-semibold"><BookOpen className="h-3.5 w-3.5" />{course.completedLessons}/{course.totalLessons}</p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="font-semibold text-muted-foreground">Progress</span>
                            <span className="font-semibold text-cyan-600 dark:text-cyan-300">{course.completionPercentage}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-all duration-700"
                              style={{ width: `${course.completionPercentage}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          <Button
                            className="w-full rounded-xl bg-primary/10 text-base font-semibold text-foreground shadow-none hover:bg-primary/20 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
                            onClick={() => {
                              const lessonQuery = course.resumeLessonId ? `?lesson=${course.resumeLessonId}` : "";
                              navigate(`/my-courses/${course.id}${lessonQuery}`);
                            }}
                          >
                            <PlayCircle className="mr-2 h-4 w-4" />
                            View Course
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete course?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{deleteTarget?.name}" and all its lessons. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel disabled={!!deletingCourseId}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTarget && handleDeleteCourse(deleteTarget)}
                disabled={!!deletingCourseId || !deleteTarget}
              >
                {deleteTarget && deletingCourseId === deleteTarget.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
