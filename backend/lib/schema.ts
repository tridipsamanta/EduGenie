import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

export type CourseLevel = "Beginner" | "Intermediate" | "Advanced";

export type GeneratedCurriculum = {
	courseTitle: string;
	summary: string;
	chapters: Array<{
		title: string;
		summary: string;
		topics: string[];
	}>;
};

export const courses = pgTable(
	"courses",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		name: text("name").notNull(),
		level: text("level").notNull(),
		duration: text("duration").notNull(),
		description: text("description").notNull(),
		curriculum: jsonb("curriculum").$type<GeneratedCurriculum>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		userIdIdx: index("courses_user_id_idx").on(table.userId),
		createdAtIdx: index("courses_created_at_idx").on(table.createdAt),
	})
);

export const chapters = pgTable(
	"chapters",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		courseId: uuid("course_id")
			.notNull()
			.references(() => courses.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		summary: text("summary").notNull(),
		orderIndex: integer("order_index").notNull(),
	},
	(table) => ({
		courseIdIdx: index("chapters_course_id_idx").on(table.courseId),
		uniqueCourseOrder: uniqueIndex("chapters_course_order_unique").on(
			table.courseId,
			table.orderIndex
		),
	})
);

export const lessons = pgTable(
	"lessons",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		chapterId: uuid("chapter_id")
			.notNull()
			.references(() => chapters.id, { onDelete: "cascade" }),
		youtubeVideoId: text("youtube_video_id").notNull(),
		title: text("title").notNull(),
		duration: text("duration").notNull(),
		thumbnail: text("thumbnail").notNull(),
		orderIndex: integer("order_index").notNull(),
	},
	(table) => ({
		chapterIdIdx: index("lessons_chapter_id_idx").on(table.chapterId),
		uniqueChapterOrder: uniqueIndex("lessons_chapter_order_unique").on(
			table.chapterId,
			table.orderIndex
		),
	})
);

export const userProgress = pgTable(
	"user_progress",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		lessonId: uuid("lesson_id")
			.notNull()
			.references(() => lessons.id, { onDelete: "cascade" }),
		completed: boolean("completed").default(false).notNull(),
		watchedSeconds: integer("watched_seconds").default(0).notNull(),
		lastWatchedAt: timestamp("last_watched_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		userIdIdx: index("user_progress_user_id_idx").on(table.userId),
		lessonIdIdx: index("user_progress_lesson_id_idx").on(table.lessonId),
		uniqueUserLesson: uniqueIndex("user_progress_user_lesson_unique").on(
			table.userId,
			table.lessonId
		),
	})
);
