import { and, eq, inArray } from "drizzle-orm";
import mongoose, { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { getCoursesUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import connectDB from "@/lib/mongodb";
import { chapters, courses, lessons, userProgress } from "@/lib/schema";
import { Course } from "@/models/Course";
import { CourseChapter } from "@/models/CourseChapter";
import { CourseLesson } from "@/models/CourseLesson";
import { CourseProgress } from "@/models/CourseProgress";

type Context = {
  params: {
    id: string;
  };
};

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const userId = await getCoursesUserId();

    try {
      const [course] = await db
        .select()
        .from(courses)
        .where(and(eq(courses.id, params.id), eq(courses.userId, userId)))
        .limit(1);

      if (!course) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }

      const courseChapters = await db.select().from(chapters).where(eq(chapters.courseId, course.id));

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
              .where(and(eq(userProgress.userId, userId), inArray(userProgress.lessonId, lessonIds)))
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
              id: lesson.id,
              youtubeVideoId: lesson.youtubeVideoId,
              title: lesson.title,
              duration: lesson.duration,
              thumbnail: lesson.thumbnail,
              orderIndex: lesson.orderIndex,
              completed: progressMap.get(lesson.id)?.completed ?? false,
              watchedSeconds: progressMap.get(lesson.id)?.watchedSeconds ?? 0,
            })),
        }));

      const totalLessons = courseLessons.length;
      const completedLessons = progressRows.filter((row) => row.completed).length;
      const completionPercentage =
        totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

      return NextResponse.json(
        {
          course: {
            id: course.id,
            name: course.name,
            level: course.level,
            duration: course.duration,
            description: course.description,
          },
          chapters: chapterPayload,
          stats: {
            totalChapters: chapterPayload.length,
            totalLessons,
            completedLessons,
            completionPercentage,
          },
        },
        { status: 200 }
      );
    } catch (pgError) {
      console.warn("Course detail GET falling back to MongoDB:", pgError);

      if (!Types.ObjectId.isValid(params.id)) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }

      await connectDB();

      const courseId = new mongoose.Types.ObjectId(params.id);
      const course = await Course.findOne({ _id: courseId, userId }).lean();

      if (!course) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }

      const courseChapters = await CourseChapter.find({ courseId: course._id }).lean();
      const chapterIds = courseChapters.map((chapter) => chapter._id);

      const courseLessons =
        chapterIds.length > 0
          ? await CourseLesson.find({ chapterId: { $in: chapterIds } }).lean()
          : [];

      const lessonIds = courseLessons.map((lesson) => lesson._id);
      const progressRows =
        lessonIds.length > 0
          ? await CourseProgress.find({ userId, lessonId: { $in: lessonIds } }).lean()
          : [];

      const progressMap = new Map(progressRows.map((row) => [String(row.lessonId), row]));

      const chapterPayload = courseChapters
        .sort((first, second) => first.orderIndex - second.orderIndex)
        .map((chapter) => ({
          id: String(chapter._id),
          title: chapter.title,
          summary: chapter.summary,
          orderIndex: chapter.orderIndex,
          lessons: courseLessons
            .filter((lesson) => String(lesson.chapterId) === String(chapter._id))
            .sort((first, second) => first.orderIndex - second.orderIndex)
            .map((lesson) => ({
              id: String(lesson._id),
              youtubeVideoId: lesson.youtubeVideoId,
              title: lesson.title,
              duration: lesson.duration,
              thumbnail: lesson.thumbnail,
              orderIndex: lesson.orderIndex,
              completed: progressMap.get(String(lesson._id))?.completed ?? false,
              watchedSeconds: progressMap.get(String(lesson._id))?.watchedSeconds ?? 0,
            })),
        }));

      const totalLessons = courseLessons.length;
      const completedLessons = progressRows.filter((row) => row.completed).length;
      const completionPercentage =
        totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

      return NextResponse.json(
        {
          course: {
            id: String(course._id),
            name: course.name,
            level: course.level,
            duration: course.duration,
            description: course.description,
          },
          chapters: chapterPayload,
          stats: {
            totalChapters: chapterPayload.length,
            totalLessons,
            completedLessons,
            completionPercentage,
          },
        },
        { status: 200 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch course";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const userId = await getCoursesUserId();

    try {
      const [existingCourse] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, params.id), eq(courses.userId, userId)))
        .limit(1);

      if (!existingCourse) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }

      await db.delete(courses).where(eq(courses.id, params.id));
      return NextResponse.json({ success: true }, { status: 200 });
    } catch (pgError) {
      console.warn("Course delete falling back to MongoDB:", pgError);

      if (!Types.ObjectId.isValid(params.id)) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }

      await connectDB();

      const courseId = new mongoose.Types.ObjectId(params.id);
      const existingCourse = await Course.findOne({ _id: courseId, userId }).lean();

      if (!existingCourse) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }

      const courseChapters = await CourseChapter.find({ courseId }).select({ _id: 1 }).lean();
      const chapterIds = courseChapters.map((chapter) => chapter._id);
      const courseLessons =
        chapterIds.length > 0
          ? await CourseLesson.find({ chapterId: { $in: chapterIds } }).select({ _id: 1 }).lean()
          : [];
      const lessonIds = courseLessons.map((lesson) => lesson._id);

      if (lessonIds.length > 0) {
        await CourseProgress.deleteMany({ userId, lessonId: { $in: lessonIds } });
      }
      if (chapterIds.length > 0) {
        await CourseLesson.deleteMany({ chapterId: { $in: chapterIds } });
      }
      await CourseChapter.deleteMany({ courseId });
      await Course.deleteOne({ _id: courseId, userId });

      return NextResponse.json({ success: true }, { status: 200 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete course";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
