import { currentUser } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { CoursePlayer } from "@/app/courses/[courseId]/player";
import { db } from "@/lib/db";
import { chapters, courses, lessons, userProgress } from "@/lib/schema";

type Params = {
  params: {
    courseId: string;
  };
  searchParams: {
    lesson?: string;
  };
};

export default async function CoursePage({ params, searchParams }: Params) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, params.courseId), eq(courses.userId, user.id)))
    .limit(1);

  if (!course || course.userId !== user.id) {
    notFound();
  }

  const courseChapters = await db
    .select()
    .from(chapters)
    .where(eq(chapters.courseId, course.id));

  const chapterIds = courseChapters.map((chapter) => chapter.id);
  const courseLessons =
    chapterIds.length > 0
      ? await db.select().from(lessons).where(inArray(lessons.chapterId, chapterIds))
      : [];

  const lessonIds = courseLessons.map((lesson) => lesson.id);
  const progressRows =
    lessonIds.length > 0
      ? await db
          .select()
          .from(userProgress)
          .where(and(eq(userProgress.userId, user.id), inArray(userProgress.lessonId, lessonIds)))
      : [];

  const progressMap = new Map(progressRows.map((row) => [row.lessonId, row]));

  const chapterPayload = courseChapters
    .sort((first, second) => first.orderIndex - second.orderIndex)
    .map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary,
      orderIndex: chapter.orderIndex,
      lessons: courseLessons
        .filter((lesson) => lesson.chapterId === chapter.id)
        .sort((first, second) => first.orderIndex - second.orderIndex)
        .map((lesson) => ({
          ...lesson,
          completed: progressMap.get(lesson.id)?.completed ?? false,
          watchedSeconds: progressMap.get(lesson.id)?.watchedSeconds ?? 0,
        })),
    }));

  const totalLessons = courseLessons.length;
  const completedLessons = progressRows.filter((row) => row.completed).length;
  const completionPercentage =
    totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

  return (
    <CoursePlayer
      course={{
        id: course.id,
        name: course.name,
        level: course.level,
        duration: course.duration,
        description: course.description,
      }}
      chapters={chapterPayload}
      stats={{
        totalChapters: chapterPayload.length,
        totalLessons,
        completedLessons,
        completionPercentage,
      }}
      initialLessonId={searchParams.lesson ?? null}
    />
  );
}
