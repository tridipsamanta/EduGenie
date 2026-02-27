// Gradient and badge helpers for premium card design
const gradients = [
  { icon: "from-violet-500 to-purple-600", bar: "from-violet-500 to-purple-600" },
  { icon: "from-blue-500 to-indigo-600", bar: "from-blue-500 to-indigo-600" },
  { icon: "from-emerald-500 to-teal-600", bar: "from-emerald-500 to-teal-600" },
  { icon: "from-orange-500 to-amber-500", bar: "from-orange-500 to-amber-500" },
  { icon: "from-pink-500 to-rose-500", bar: "from-pink-500 to-rose-500" },
];
function getGradient(index: number) {
  return gradients[index % gradients.length];
}
function getLevelBadge(level: string) {
  if (level === "Beginner") return "bg-green-100 text-green-700";
  if (level === "Intermediate") return "bg-yellow-100 text-yellow-700";
  if (level === "Advanced") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
}
import { Layout } from "@/components/Layout";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
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
};

const initialFormState: CreateFormState = {
  courseName: "",
  chapterCount: 6,
  level: "Beginner",
  duration: "8 weeks",
  description: "",
};

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

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full px-6" size="lg">
                <Plus className="mr-2 h-4 w-4" />
                New Course
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl overflow-hidden border-border/50 bg-gradient-to-br from-background via-background to-muted/40 p-0 shadow-2xl shadow-black/20 backdrop-blur">
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
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate with AI"}
                </Button>
              </div>
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

        <Card className="rounded-2xl border border-border/50 bg-white dark:bg-zinc-900 shadow-lg hover:shadow-xl transition-all duration-300">
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
                {courses.map((course, idx) => {
                  const { icon, bar } = getGradient(idx);
                  return (
                    <div
                      key={course.id}
                      className="flex flex-col justify-between h-full min-h-[260px] rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-border/50 bg-white dark:bg-zinc-900"
                    >
                      {/* Top Section (Header) - Fully Responsive */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start w-full">
                        {/* Left: Icon, Title, Badges */}
                        <div className="flex flex-col max-w-full sm:max-w-[75%]">
                          <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${icon} flex items-center justify-center text-white shadow-md mb-2`}>
                            <img src="/app_logo.png" alt="EduGenie Logo" className="h-full w-full object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
                          </div>
                          <div className="text-lg font-semibold leading-tight line-clamp-2 text-gray-900 dark:text-white">
                            {course.name}
                          </div>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getLevelBadge(course.level)}`}>{course.level}</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300">{course.duration}</span>
                          </div>
                          {/* Chapters/Lessons for mobile */}
                          <span className="block sm:hidden text-xs text-muted-foreground font-semibold mt-2">
                            {course.totalChapters} chapters • {course.totalLessons} lessons
                          </span>
                        </div>
                        {/* Right: Chapters/Lessons, Buttons (stacked on mobile) */}
                        <div className="flex flex-col items-stretch sm:items-end min-w-0 sm:min-w-[120px] flex-shrink-0 h-full justify-between">
                          <span className="hidden sm:block text-xs text-muted-foreground font-semibold mb-3 whitespace-nowrap">
                            {course.totalChapters} chapters • {course.totalLessons} lessons
                          </span>
                        </div>
                      </div>
                      {/* Description */}
                      <div className="text-sm text-muted-foreground mt-3 line-clamp-2">
                        {course.description}
                      </div>
                      {/* Progress Section */}
                      <div className="mt-4">
                        <div className="w-full h-2 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${bar} transition-all duration-700`}
                            style={{ width: `${course.completionPercentage}%` }}
                          />
                        </div>
                      </div>
                      {/* Bottom Section + Buttons (stacked on mobile) */}
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-4 text-sm gap-2 sm:gap-0">
                        <div className="flex justify-between items-center w-full sm:w-auto">
                          <span className="font-bold text-primary">{course.completionPercentage}% Complete</span>
                          <span className="text-muted-foreground ml-2">{course.completedLessons}/{course.totalLessons} lessons completed</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <Button
                            className={`w-full sm:w-auto rounded-full px-4 py-1.5 text-sm font-semibold shadow-md bg-gradient-to-r ${bar} text-white hover:opacity-90 transition`}
                            onClick={() => {
                              const lessonQuery = course.resumeLessonId ? `?lesson=${course.resumeLessonId}` : "";
                              navigate(`/my-courses/${course.id}${lessonQuery}`);
                            }}
                          >
                            Resume
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full sm:w-auto rounded-full px-4 py-1.5 text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            disabled={deletingCourseId === course.id}
                            onClick={() => setDeleteTarget(course)}
                          >
                            {deletingCourseId === course.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Delete"
                            )}
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
