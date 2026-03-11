import { and, desc, eq, inArray } from "drizzle-orm";
import { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCoursesUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchBestYoutubeLessons, generateCourseCurriculum } from "@/lib/lms";
import connectDB from "@/lib/mongodb";
import { Course } from "@/models/Course";
import { CourseChapter } from "@/models/CourseChapter";
import { CourseLesson } from "@/models/CourseLesson";
import { CourseProgress } from "@/models/CourseProgress";
import { chapters, courses, lessons, userProgress } from "@/lib/schema";

const createCourseSchema = z.object({
  courseName: z.string().min(3),
  chapterCount: z.number().int().min(1).max(30),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  duration: z.string().min(2),
  description: z.string().min(10),
  thumbnail: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || /^https?:\/\//i.test(value) || /^data:image\//i.test(value), {
      message: "Thumbnail must be a valid image URL or image data",
    })
    .optional(),
  thumbnailPositionX: z.number().min(0).max(100).optional(),
  thumbnailPositionY: z.number().min(0).max(100).optional(),
});

export async function GET() {
  try {
    const userId = await getCoursesUserId();
    try {
      const userCourses = await db
        .select()
        .from(courses)
        .where(eq(courses.userId, userId))
        .orderBy(desc(courses.createdAt));

      const data = await Promise.all(
        userCourses.map(async (course) => {
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
          const completed =
            lessonIds.length > 0
              ? await db
                  .select()
                  .from(userProgress)
                  .where(
                    and(
                      eq(userProgress.userId, userId),
                      inArray(userProgress.lessonId, lessonIds),
                      eq(userProgress.completed, true)
                    )
                  )
              : [];

          const latestProgress =
            lessonIds.length > 0
              ? await db
                  .select()
                  .from(userProgress)
                  .where(
                    and(
                      eq(userProgress.userId, userId),
                      inArray(userProgress.lessonId, lessonIds)
                    )
                  )
                  .orderBy(desc(userProgress.lastWatchedAt))
                  .limit(1)
              : [];

          const totalLessons = courseLessons.length;
          const completionPercentage =
            totalLessons === 0 ? 0 : Math.round((completed.length / totalLessons) * 100);

          return {
            id: course.id,
            name: course.name,
            level: course.level,
            duration: course.duration,
            description: course.description,
            thumbnail: course.thumbnail ?? "",
            thumbnailPositionX: course.thumbnailPositionX ?? 50,
            thumbnailPositionY: course.thumbnailPositionY ?? 50,
            createdAt: course.createdAt,
            totalChapters: courseChapters.length,
            totalLessons,
            completedLessons: completed.length,
            completionPercentage,
            resumeLessonId: latestProgress[0]?.lessonId ?? null,
          };
        })
      );

      return NextResponse.json({ courses: data }, { status: 200 });
    } catch (pgError) {
      console.warn("Courses GET falling back to MongoDB:", pgError);

      await connectDB();
      const userCourses = await Course.find({ userId }).sort({ createdAt: -1 }).lean();

      const data = await Promise.all(
        userCourses.map(async (course) => {
          const courseId = String(course._id);
          const courseChapters = await CourseChapter.find({ courseId: course._id }).lean();
          const chapterIds = courseChapters.map((chapter) => chapter._id);

          const courseLessons =
            chapterIds.length > 0
              ? await CourseLesson.find({ chapterId: { $in: chapterIds } }).lean()
              : [];

          const lessonIds = courseLessons.map((lesson) => lesson._id);
          const completed =
            lessonIds.length > 0
              ? await CourseProgress.find({
                  userId,
                  lessonId: { $in: lessonIds },
                  completed: true,
                }).lean()
              : [];

          const latestProgress =
            lessonIds.length > 0
              ? await CourseProgress.find({
                  userId,
                  lessonId: { $in: lessonIds },
                })
                  .sort({ lastWatchedAt: -1 })
                  .limit(1)
                  .lean()
              : [];

          const totalLessons = courseLessons.length;
          const completionPercentage =
            totalLessons === 0 ? 0 : Math.round((completed.length / totalLessons) * 100);

          return {
            id: courseId,
            name: course.name,
            level: course.level,
            duration: course.duration,
            description: course.description,
            thumbnail: course.thumbnail ?? "",
            thumbnailPositionX: course.thumbnailPositionX ?? 50,
            thumbnailPositionY: course.thumbnailPositionY ?? 50,
            createdAt: course.createdAt,
            totalChapters: courseChapters.length,
            totalLessons,
            completedLessons: completed.length,
            completionPercentage,
            resumeLessonId: latestProgress[0] ? String(latestProgress[0].lessonId) : null,
          };
        })
      );

      return NextResponse.json({ courses: data }, { status: 200 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch courses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCoursesUserId();

    const body = await request.json();
    const payload = createCourseSchema.parse(body);

    const curriculum = await generateCourseCurriculum(payload);

    try {
      let createdCourseId: string | null = null;

      const [createdCourse] = await db
        .insert(courses)
        .values({
          userId,
          name: payload.courseName,
          level: payload.level,
          duration: payload.duration,
          description: payload.description,
          thumbnail: payload.thumbnail || null,
          thumbnailPositionX: Math.round(payload.thumbnailPositionX ?? 50),
          thumbnailPositionY: Math.round(payload.thumbnailPositionY ?? 50),
          curriculum,
        })
        .returning();

      createdCourseId = createdCourse.id;

      try {
        for (let chapterIndex = 0; chapterIndex < curriculum.chapters.length; chapterIndex += 1) {
          const chapter = curriculum.chapters[chapterIndex];

          const [insertedChapter] = await db
            .insert(chapters)
            .values({
              courseId: createdCourse.id,
              title: chapter.title,
              summary: chapter.summary,
              orderIndex: chapterIndex,
            })
            .returning();

          const topicVideoGroups = await Promise.all(
            chapter.topics.map((topic) => fetchBestYoutubeLessons(topic, payload.level, 2))
          );

          const chapterLessons = topicVideoGroups.flat();

          for (let lessonIndex = 0; lessonIndex < chapterLessons.length; lessonIndex += 1) {
            const lesson = chapterLessons[lessonIndex];

            await db.insert(lessons).values({
              chapterId: insertedChapter.id,
              youtubeVideoId: lesson.youtubeVideoId,
              title: lesson.title,
              duration: lesson.duration,
              thumbnail: lesson.thumbnail,
              orderIndex: lessonIndex,
            });
          }
        }
      } catch (creationError) {
        if (createdCourseId) {
          await db.delete(courses).where(eq(courses.id, createdCourseId));
        }
        throw creationError;
      }

      return NextResponse.json({ courseId: createdCourse.id }, { status: 201 });
    } catch (pgError) {
      console.warn("Courses POST falling back to MongoDB:", pgError);

      await connectDB();

      const createdCourse = await Course.create({
        userId,
        name: payload.courseName,
        level: payload.level,
        duration: payload.duration,
        description: payload.description,
        thumbnail: payload.thumbnail || "",
        thumbnailPositionX: Math.round(payload.thumbnailPositionX ?? 50),
        thumbnailPositionY: Math.round(payload.thumbnailPositionY ?? 50),
        curriculum,
      });

      const createdChapterIds: Types.ObjectId[] = [];

      try {
        for (let chapterIndex = 0; chapterIndex < curriculum.chapters.length; chapterIndex += 1) {
          const chapter = curriculum.chapters[chapterIndex];

          const insertedChapter = await CourseChapter.create({
            courseId: createdCourse._id,
            title: chapter.title,
            summary: chapter.summary,
            orderIndex: chapterIndex,
          });
          createdChapterIds.push(insertedChapter._id);

          const topicVideoGroups = await Promise.all(
            chapter.topics.map((topic) => fetchBestYoutubeLessons(topic, payload.level, 2))
          );

          const chapterLessons = topicVideoGroups.flat();

          for (let lessonIndex = 0; lessonIndex < chapterLessons.length; lessonIndex += 1) {
            const lesson = chapterLessons[lessonIndex];
            await CourseLesson.create({
              chapterId: insertedChapter._id,
              youtubeVideoId: lesson.youtubeVideoId,
              title: lesson.title,
              duration: lesson.duration,
              thumbnail: lesson.thumbnail,
              orderIndex: lessonIndex,
            });
          }
        }
      } catch (mongoError) {
        if (createdChapterIds.length > 0) {
          await CourseLesson.deleteMany({ chapterId: { $in: createdChapterIds } });
          await CourseChapter.deleteMany({ _id: { $in: createdChapterIds } });
        }
        await Course.deleteOne({ _id: createdCourse._id });
        throw mongoError;
      }

      return NextResponse.json({ courseId: String(createdCourse._id) }, { status: 201 });
    }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Failed to create course";
    const message = /429|quota|RESOURCE_EXHAUSTED|QuotaFailure/i.test(rawMessage)
      ? "AI generation quota reached. Please verify AI API keys in backend/.env and try again."
      : rawMessage;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
