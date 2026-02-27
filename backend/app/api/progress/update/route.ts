import { and, eq, inArray } from "drizzle-orm";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCoursesUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateLearningAdvice } from "@/lib/lms";
import connectDB from "@/lib/mongodb";
import { Course } from "@/models/Course";
import { CourseChapter } from "@/models/CourseChapter";
import { CourseLesson } from "@/models/CourseLesson";
import { CourseProgress } from "@/models/CourseProgress";
import { chapters, courses, lessons, userProgress } from "@/lib/schema";

const payloadSchema = z.object({
  lessonId: z.string().min(1),
  watchedSeconds: z.number().min(0),
  totalSeconds: z.number().min(1),
  completedOverride: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getCoursesUserId();
    console.log("\n📊 [PROGRESS UPDATE] POST /api/progress/update");
    console.log("  User ID:", userId);

    const body = await request.json();
    const payload = payloadSchema.parse(body);
    console.log("  Payload:", {
      lessonId: payload.lessonId,
      watchedSeconds: payload.watchedSeconds,
      totalSeconds: payload.totalSeconds,
      completedOverride: payload.completedOverride,
    });

    try {
      const lessonWithCourse = await db
        .select({
          lessonId: lessons.id,
          courseId: courses.id,
          courseName: courses.name,
        })
        .from(lessons)
        .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
        .innerJoin(courses, eq(courses.id, chapters.courseId))
        .where(and(eq(lessons.id, payload.lessonId), eq(courses.userId, userId)))
        .limit(1);

      if (lessonWithCourse.length === 0) {
        return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
      }

      const progressFraction = payload.watchedSeconds / payload.totalSeconds;
      const isCompletedNow = payload.completedOverride ?? progressFraction >= 0.8;

      const existing = await db
        .select()
        .from(userProgress)
        .where(and(eq(userProgress.userId, userId), eq(userProgress.lessonId, payload.lessonId)))
        .limit(1);

      const existingProgress = existing[0] ?? null;
      const mergedCompleted =
        payload.completedOverride !== undefined
          ? payload.completedOverride
          : existingProgress?.completed
          ? true
          : isCompletedNow;
      const mergedWatchedSeconds =
        payload.completedOverride === false
          ? Math.floor(payload.watchedSeconds)
          : Math.max(existingProgress?.watchedSeconds ?? 0, Math.floor(payload.watchedSeconds));

      console.log("  [PostgreSQL] Existing progress:", existingProgress);
      console.log("  [PostgreSQL] Merged values:", {
        completed: mergedCompleted,
        watchedSeconds: mergedWatchedSeconds,
      });

      if (existingProgress) {
        console.log("  [PostgreSQL] Updating existing progress record");
        await db
          .update(userProgress)
          .set({
            completed: mergedCompleted,
            watchedSeconds: mergedWatchedSeconds,
            lastWatchedAt: new Date(),
          })
          .where(eq(userProgress.id, existingProgress.id));
        console.log("  ✅ [PostgreSQL] Update successful");
      } else {
        console.log("  [PostgreSQL] Creating new progress record");
        await db.insert(userProgress).values({
          userId,
          lessonId: payload.lessonId,
          completed: mergedCompleted,
          watchedSeconds: mergedWatchedSeconds,
          lastWatchedAt: new Date(),
        });
        console.log("  ✅ [PostgreSQL] Insert successful");
      }

      const chapterRows = await db
        .select({ chapterId: chapters.id })
        .from(chapters)
        .where(eq(chapters.courseId, lessonWithCourse[0].courseId));

      const chapterIds = chapterRows.map((row) => row.chapterId);
      const courseLessons =
        chapterIds.length > 0
          ? await db.select({ lessonId: lessons.id }).from(lessons).where(inArray(lessons.chapterId, chapterIds))
          : [];
      const lessonIds = courseLessons.map((row) => row.lessonId);

      const progressRows =
        lessonIds.length > 0
          ? await db
              .select()
              .from(userProgress)
              .where(and(eq(userProgress.userId, userId), inArray(userProgress.lessonId, lessonIds)))
          : [];

      const totalLessons = lessonIds.length;
      const completedLessons = progressRows.filter((row) => row.completed).length;
      const completionPercentage =
        totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

      let learningAdvice: { advice: string; nextChapterFocus: string } | null = null;
      const hasReachedAdviceThreshold = completedLessons >= 3;
      const hasNewCompletion = !existingProgress?.completed && mergedCompleted;

      if (hasReachedAdviceThreshold && hasNewCompletion) {
        try {
          learningAdvice = await generateLearningAdvice({
            courseName: lessonWithCourse[0].courseName,
            completedLessons,
            totalLessons,
            completionPercentage,
          });
        } catch (error) {
          console.warn("Learning advice generation skipped:", error);
        }
      }

      console.log("  ✅ [PROGRESS] Successfully updated stats:", {
        totalLessons,
        completedLessons,
        completionPercentage,
      });
      console.log("\n");

      return NextResponse.json(
        {
          success: true,
          completed: mergedCompleted,
          stats: {
            totalLessons,
            completedLessons,
            completionPercentage,
          },
          learningAdvice,
        },
        { status: 200 }
      );
    } catch (pgError) {
      console.error("❌ [Progress] PostgreSQL error:", pgError instanceof Error ? pgError.message : String(pgError));
      console.warn("  Falling back to MongoDB...");

      if (!isValidObjectId(payload.lessonId)) {
        return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
      }

      await connectDB();

      const lesson = await CourseLesson.findById(payload.lessonId).lean();
      if (!lesson) {
        return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
      }

      const chapter = await CourseChapter.findById(lesson.chapterId).lean();
      if (!chapter) {
        return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
      }

      const course = await Course.findOne({ _id: chapter.courseId, userId }).lean();
      if (!course) {
        return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
      }

      const progressFraction = payload.watchedSeconds / payload.totalSeconds;
      const isCompletedNow = payload.completedOverride ?? progressFraction >= 0.8;

      const existingProgress = await CourseProgress.findOne({
        userId,
        lessonId: lesson._id,
      }).lean();

      const mergedCompleted =
        payload.completedOverride !== undefined
          ? payload.completedOverride
          : existingProgress?.completed
          ? true
          : isCompletedNow;
      const mergedWatchedSeconds =
        payload.completedOverride === false
          ? Math.floor(payload.watchedSeconds)
          : Math.max(existingProgress?.watchedSeconds ?? 0, Math.floor(payload.watchedSeconds));

      console.log("  [MongoDB] Updating progress for lesson:", lesson._id.toString());
      const updatedProgress = await CourseProgress.findOneAndUpdate(
        { userId, lessonId: lesson._id },
        {
          $set: {
            completed: mergedCompleted,
            watchedSeconds: mergedWatchedSeconds,
            lastWatchedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
      console.log("  ✅ [MongoDB] Update successful:", {
        id: updatedProgress?._id,
        completed: updatedProgress?.completed,
        watchedSeconds: updatedProgress?.watchedSeconds,
      });

      const chapterRows = await CourseChapter.find({ courseId: course._id }).select({ _id: 1 }).lean();
      const chapterIds = chapterRows.map((row) => row._id);
      const courseLessons =
        chapterIds.length > 0
          ? await CourseLesson.find({ chapterId: { $in: chapterIds } }).select({ _id: 1 }).lean()
          : [];
      const lessonIds = courseLessons.map((row) => row._id);

      const progressRows =
        lessonIds.length > 0
          ? await CourseProgress.find({ userId, lessonId: { $in: lessonIds } }).lean()
          : [];

      const totalLessons = lessonIds.length;
      const completedLessons = progressRows.filter((row) => row.completed).length;
      const completionPercentage =
        totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

      let learningAdvice: { advice: string; nextChapterFocus: string } | null = null;
      const hasReachedAdviceThreshold = completedLessons >= 3;
      const hasNewCompletion = !existingProgress?.completed && mergedCompleted;

      if (hasReachedAdviceThreshold && hasNewCompletion) {
        try {
          learningAdvice = await generateLearningAdvice({
            courseName: course.name,
            completedLessons,
            totalLessons,
            completionPercentage,
          });
        } catch (error) {
          console.warn("Learning advice generation skipped:", error);
        }
      }

      console.log("  ✅ [PROGRESS] Successfully updated stats (MongoDB):", {
        totalLessons,
        completedLessons,
        completionPercentage,
      });
      console.log("\n");

      return NextResponse.json(
        {
          success: true,
          completed: mergedCompleted,
          stats: {
            totalLessons,
            completedLessons,
            completionPercentage,
          },
          learningAdvice,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update progress";
    console.error("❌ [PROGRESS] Fatal error:", message);
    console.error("Stack:", error instanceof Error ? error.stack : "");
    console.log("\n");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
