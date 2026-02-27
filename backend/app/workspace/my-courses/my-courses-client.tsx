"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Progress } from "@/app/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";

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

type CreateCourseForm = {
  courseName: string;
  chapterCount: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  description: string;
};

const initialForm: CreateCourseForm = {
  courseName: "",
  chapterCount: 6,
  level: "Beginner",
  duration: "8 weeks",
  description: "",
};

export function MyCoursesClient() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<CreateCourseForm>(initialForm);

  async function loadCourses() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/courses", { cache: "no-store" });
      const data = (await response.json()) as { courses?: CourseSummary[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load courses");
      }

      setCourses(data.courses ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load courses");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCourses();
  }, []);

  async function handleCreateCourse() {
    setIsCreating(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formState),
      });

      const data = (await response.json()) as { courseId?: string; error?: string };

      if (!response.ok || !data.courseId) {
        throw new Error(data.error ?? "Failed to create course");
      }

      setDialogOpen(false);
      setFormState(initialForm);
      await loadCourses();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create course");
    } finally {
      setIsCreating(false);
    }
  }

  const totals = useMemo(() => {
    const totalCourses = courses.length;
    const totalLessons = courses.reduce((sum, course) => sum + course.totalLessons, 0);
    const completedLessons = courses.reduce((sum, course) => sum + course.completedLessons, 0);
    const completionPercentage =
      totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

    return {
      totalCourses,
      totalLessons,
      completedLessons,
      completionPercentage,
    };
  }, [courses]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[240px_1fr]">
        <aside className="border-r border-border p-6">
          <h1 className="text-xl font-semibold">EduGenie</h1>
          <nav className="mt-8 space-y-2">
            <Link href="/workspace/my-courses" className="block rounded-xl bg-secondary px-3 py-2 text-sm font-medium">
              My Courses
            </Link>
            <Link href="/dashboard" className="block rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
              Dashboard
            </Link>
          </nav>
        </aside>

        <main className="p-6 md:p-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">My Courses</h2>
              <p className="text-sm text-muted-foreground">Create AI-powered learning paths with tracked video progress.</p>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Course
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Create Course</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="courseName">Course Name</Label>
                    <Input
                      id="courseName"
                      value={formState.courseName}
                      onChange={(event) =>
                        setFormState((previous) => ({ ...previous, courseName: event.target.value }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="chapterCount">Number of Chapters</Label>
                      <Input
                        id="chapterCount"
                        type="number"
                        min={1}
                        max={30}
                        value={formState.chapterCount}
                        onChange={(event) =>
                          setFormState((previous) => ({
                            ...previous,
                            chapterCount: Math.max(1, Number(event.target.value) || 1),
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Level</Label>
                      <Select
                        value={formState.level}
                        onValueChange={(value: "Beginner" | "Intermediate" | "Advanced") =>
                          setFormState((previous) => ({ ...previous, level: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Beginner">Beginner</SelectItem>
                          <SelectItem value="Intermediate">Intermediate</SelectItem>
                          <SelectItem value="Advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Total Duration</Label>
                    <Input
                      id="duration"
                      value={formState.duration}
                      onChange={(event) =>
                        setFormState((previous) => ({ ...previous, duration: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Course Description</Label>
                    <Textarea
                      id="description"
                      rows={5}
                      value={formState.description}
                      onChange={(event) =>
                        setFormState((previous) => ({ ...previous, description: event.target.value }))
                      }
                    />
                  </div>

                  <Button className="w-full rounded-xl" disabled={isCreating} onClick={handleCreateCourse}>
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate & Save Course"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle>Total Courses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{totals.totalCourses}</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle>Total Lessons</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{totals.totalLessons}</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle>Completion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{totals.completionPercentage}%</p>
              </CardContent>
            </Card>
          </div>

          {errorMessage ? (
            <Card className="mb-6 rounded-xl border-destructive">
              <CardContent className="p-4 text-sm text-destructive">{errorMessage}</CardContent>
            </Card>
          ) : null}

          {isLoading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : courses.length === 0 ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No courses yet. Create your first AI-generated course.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {courses.map((course) => (
                <Card key={course.id} className="rounded-xl shadow-sm">
                  <CardHeader>
                    <CardTitle>{course.name}</CardTitle>
                    <CardDescription>
                      {course.level} • {course.duration}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-sm text-muted-foreground">{course.description}</p>

                    <div className="mb-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                      <p>Total Chapters: {course.totalChapters}</p>
                      <p>Total Lessons: {course.totalLessons}</p>
                      <p>Completion: {course.completionPercentage}%</p>
                    </div>

                    <Progress value={course.completionPercentage} className="mb-4" />

                    <Link
                      href={
                        course.resumeLessonId
                          ? `/courses/${course.id}?lesson=${course.resumeLessonId}`
                          : `/courses/${course.id}`
                      }
                    >
                      <Button className="rounded-xl">Resume</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
