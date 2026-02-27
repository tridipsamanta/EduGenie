import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Quiz } from "@/models/Quiz";
import { Note } from "@/models/Note";
import { Attempt } from "@/models/Attempt";
import { Course } from "@/models/Course";
import { CourseChapter } from "@/models/CourseChapter";
import { CourseLesson } from "@/models/CourseLesson";
import { CourseProgress } from "@/models/CourseProgress";
import { Conversation } from "@/models/Conversation";
import { getCoursesUserId, getNotesUserId, NOTES_GUEST_USER_ID } from "@/lib/auth";
import mongoose from "mongoose";

const CACHE_TTL_MS = 5 * 60 * 1000;
const dashboardStatsCache = new Map<string, { expiresAt: number; data: unknown }>();

function startOfDay(date: Date) {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	return next;
}

function dateKey(date: Date) {
	return date.toISOString().slice(0, 10);
}

function formatShortDate(key: string) {
	const date = new Date(`${key}T00:00:00`);
	return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function estimateNoteTimeSec(content: string) {
	const words = content.split(/\s+/).filter(Boolean).length;
	return Math.round((words / 180) * 60);
}

function getTodayKey() {
	return dateKey(startOfDay(new Date()));
}

function getConsecutiveStreak(activityDays: Set<string>) {
	let streak = 0;
	const cursor = startOfDay(new Date());

	for (;;) {
		const key = dateKey(cursor);
		if (!activityDays.has(key)) break;
		streak += 1;
		cursor.setDate(cursor.getDate() - 1);
	}

	return streak;
}

function buildUserMatch(userId: string, allowLegacyGuestFallback = false) {
	if (allowLegacyGuestFallback) {
		return {
			$or: [{ userId }, { userId: { $exists: false } }, { userId: null }, { userId: "" }],
		};
	}

	return { userId };
}

export async function GET() {
	try {
		const [notesUserId, coursesUserId] = await Promise.all([getNotesUserId(), getCoursesUserId()]);
		const analyticsUserId = notesUserId || coursesUserId;
		const allowLegacyGuestFallback = analyticsUserId === NOTES_GUEST_USER_ID;
		const cacheKey = `${analyticsUserId}:${coursesUserId}`;

		const cached = dashboardStatsCache.get(cacheKey);
		if (cached && cached.expiresAt > Date.now()) {
			return NextResponse.json(cached.data);
		}

		await connectDB();

		const now = new Date();
		const trendStart = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
		const streakScanStart = startOfDay(new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000));

		const quizMatch = buildUserMatch(analyticsUserId, allowLegacyGuestFallback);
		const notesMatch = { userId: analyticsUserId };
		const attemptMatch = buildUserMatch(analyticsUserId, allowLegacyGuestFallback);

		const [courses, totalNotes, totalQuizzes, totalMcqGenerated, conversationsCount] = await Promise.all([
			Course.find({ userId: coursesUserId }).select({ _id: 1, name: 1, createdAt: 1 }).lean(),
			Note.countDocuments(notesMatch),
			Quiz.countDocuments(quizMatch),
			Quiz.countDocuments({
				$and: [quizMatch, { $or: [{ isGenerated: true }, { source: "mcq-generator" }] }],
			}),
			Conversation.countDocuments(quizMatch),
		]);

		const courseIds = courses.map((course) => course._id as mongoose.Types.ObjectId);
		const totalCourses = courseIds.length;

		const chapters = courseIds.length
			? await CourseChapter.find({ courseId: { $in: courseIds } }).select({ _id: 1, courseId: 1 }).lean()
			: [];
		const chapterIds = chapters.map((chapter) => chapter._id as mongoose.Types.ObjectId);
		const totalChapters = chapterIds.length;

		const totalLessons = chapterIds.length
			? await CourseLesson.countDocuments({ chapterId: { $in: chapterIds } })
			: 0;

		const [attempts, recentQuizzesRaw, recentNotesRaw, recentAttemptsRaw, recentCoursesRaw, notesForTrend, allNotesForTime, quizTrendRaw, attemptTrendRaw, progressTrendRaw, streakNotes, streakAttempts, streakProgress, streakQuizzes] =
			await Promise.all([
				Attempt.find(attemptMatch).lean(),
				Quiz.find(quizMatch)
					.sort({ createdAt: -1 })
					.limit(5)
					.select({ title: 1, createdAt: 1 })
					.lean(),
				Note.find(notesMatch)
					.sort({ createdAt: -1 })
					.limit(5)
					.select({ title: 1, createdAt: 1 })
					.lean(),
				Attempt.find(attemptMatch)
					.sort({ createdAt: -1 })
					.limit(5)
					.select({ score: 1, createdAt: 1 })
					.lean(),
				Course.find({ userId: coursesUserId })
					.sort({ createdAt: -1 })
					.limit(5)
					.select({ name: 1, createdAt: 1 })
					.lean(),
				Note.find({ ...notesMatch, createdAt: { $gte: trendStart } })
					.select({ createdAt: 1, content: 1 })
					.lean(),
				Note.find(notesMatch).select({ content: 1 }).lean(),
				Quiz.find({ ...quizMatch, createdAt: { $gte: trendStart } })
					.select({ createdAt: 1, isGenerated: 1, source: 1 })
					.lean(),
				Attempt.find({ ...attemptMatch, createdAt: { $gte: trendStart } })
					.select({ createdAt: 1, totalTimeSec: 1 })
					.lean(),
				CourseProgress.find({ userId: coursesUserId, updatedAt: { $gte: trendStart } })
					.select({ updatedAt: 1, watchedSeconds: 1 })
					.lean(),
				Note.find({ ...notesMatch, createdAt: { $gte: streakScanStart } }).select({ createdAt: 1 }).lean(),
				Attempt.find({ ...attemptMatch, createdAt: { $gte: streakScanStart } }).select({ createdAt: 1 }).lean(),
				CourseProgress.find({ userId: coursesUserId, updatedAt: { $gte: streakScanStart } })
					.select({ updatedAt: 1 })
					.lean(),
				Quiz.find({ ...quizMatch, createdAt: { $gte: streakScanStart } }).select({ createdAt: 1 }).lean(),
			]);

		const quizTitleById = new Map<string, string>();
		const quizIds = attempts.map((attempt) => attempt.quizId).filter(Boolean);
		if (quizIds.length) {
			const attemptQuizzes = await Quiz.find({ _id: { $in: quizIds } }).select({ title: 1 }).lean();
			attemptQuizzes.forEach((quiz) => {
				quizTitleById.set(quiz._id.toString(), quiz.title || "General");
			});
		}

		const totalMcqTimeSec = attempts.reduce(
			(sum, attempt) => sum + Math.max(0, Number(attempt.totalTimeSec || 0)),
			0
		);
		const totalNotesTimeSec = allNotesForTime.reduce(
			(sum, note) => sum + estimateNoteTimeSec(note.content || ""),
			0
		);
		const totalCourseTimeSec = await CourseProgress.aggregate([
			{ $match: { userId: coursesUserId } },
			{ $group: { _id: null, total: { $sum: { $ifNull: ["$watchedSeconds", 0] } } } },
		]);
		const totalCourseWatchedSec = Number(totalCourseTimeSec?.[0]?.total || 0);
		const totalStudyTime = totalMcqTimeSec + totalNotesTimeSec + totalCourseWatchedSec;

		const scoredAttempts = attempts.filter((attempt) => typeof attempt.score === "number");
		const averageScore =
			scoredAttempts.length > 0
				? scoredAttempts.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0) /
					scoredAttempts.length
				: 0;

		const weakTopicCounter = new Map<string, number>();
		attempts.forEach((attempt) => {
			(attempt.weakTopics || []).forEach((topic) => {
				const key = (topic || "General").trim() || "General";
				weakTopicCounter.set(key, (weakTopicCounter.get(key) || 0) + 1);
			});
		});

		const weakTopics = [...weakTopicCounter.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([topic]) => topic);

		const strongTopicCounter = new Map<string, number>();
		attempts
			.filter((attempt) => Number(attempt.accuracy || 0) >= 70)
			.forEach((attempt) => {
				const key = quizTitleById.get(attempt.quizId.toString()) || "General";
				strongTopicCounter.set(key, (strongTopicCounter.get(key) || 0) + 1);
			});

		const strongTopics = [...strongTopicCounter.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([topic]) => topic);

		const trendMap = new Map<
			string,
			{ date: string; notesCreated: number; mcqGenerated: number; notesTimeMin: number; mcqTimeMin: number }
		>();

		for (let offset = 0; offset < 7; offset += 1) {
			const day = startOfDay(new Date(trendStart.getTime() + offset * 24 * 60 * 60 * 1000));
			const key = dateKey(day);
			trendMap.set(key, {
				date: formatShortDate(key),
				notesCreated: 0,
				mcqGenerated: 0,
				notesTimeMin: 0,
				mcqTimeMin: 0,
			});
		}

		notesForTrend.forEach((note) => {
			const createdAt = new Date(note.createdAt);
			if (createdAt < trendStart) return;
			const key = dateKey(startOfDay(createdAt));
			const point = trendMap.get(key);
			if (!point) return;
			point.notesCreated += 1;
			point.notesTimeMin += Math.round(estimateNoteTimeSec(note.content || "") / 60);
		});

		quizTrendRaw
			.filter((quiz) => quiz.isGenerated || quiz.source === "mcq-generator")
			.forEach((quiz) => {
				const createdAt = new Date(quiz.createdAt);
				if (createdAt < trendStart) return;
				const key = dateKey(startOfDay(createdAt));
				const point = trendMap.get(key);
				if (!point) return;
				point.mcqGenerated += 1;
			});

		attemptTrendRaw.forEach((attempt) => {
			const createdAt = new Date(attempt.createdAt);
			if (createdAt < trendStart) return;
			const key = dateKey(startOfDay(createdAt));
			const point = trendMap.get(key);
			if (!point) return;
			point.mcqTimeMin += Math.round(Math.max(0, Number(attempt.totalTimeSec || 0)) / 60);
		});

		progressTrendRaw.forEach((progress) => {
			const createdAt = new Date(progress.updatedAt);
			if (createdAt < trendStart) return;
			const key = dateKey(startOfDay(createdAt));
			const point = trendMap.get(key);
			if (!point) return;
			point.mcqTimeMin += Math.round(Math.max(0, Number(progress.watchedSeconds || 0)) / 60);
		});

		const activityTrend = [...trendMap.values()];
 
		const dailyStudyMinutes = activityTrend.map((point) => ({
			date: point.date,
			minutes: point.notesTimeMin + point.mcqTimeMin,
		}));

		const weeklyActivity = activityTrend.map((point) => ({
			date: point.date,
			activity: point.notesCreated + point.mcqGenerated,
		}));

		const performanceHistory = attempts
			.filter((attempt) => typeof attempt.score === "number")
			.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
			.slice(-7)
			.map((attempt) => {
				const title = quizTitleById.get(attempt.quizId.toString()) || "Quiz";
				return {
					name: title.length > 12 ? `${title.slice(0, 12)}…` : title,
					score: Math.round(Number(attempt.score || 0)),
				};
			});

		const topicMap = new Map<string, { attempts: number; totalScore: number }>();
		attempts.forEach((attempt) => {
			const topic = quizTitleById.get(attempt.quizId.toString()) || "General";
			const current = topicMap.get(topic) || { attempts: 0, totalScore: 0 };
			current.attempts += 1;
			current.totalScore += Number(attempt.score || 0);
			topicMap.set(topic, current);
		});

		const topicPerformance = [...topicMap.entries()]
			.map(([topic, data]) => {
				const avgScore = data.attempts > 0 ? Math.round(data.totalScore / data.attempts) : 0;
				const status = avgScore >= 80 ? "strong" : avgScore >= 60 ? "medium" : "weak";
				return { topic, attempts: data.attempts, avgScore, status };
			})
			.sort((a, b) => a.avgScore - b.avgScore)
			.slice(0, 8);

		const activityDaySet = new Set<string>();
		streakNotes.forEach((note) => activityDaySet.add(dateKey(startOfDay(new Date(note.createdAt)))));
		streakAttempts.forEach((attempt) => activityDaySet.add(dateKey(startOfDay(new Date(attempt.createdAt)))));
		streakProgress.forEach((progress) => activityDaySet.add(dateKey(startOfDay(new Date(progress.updatedAt)))));
		streakQuizzes.forEach((quiz) => activityDaySet.add(dateKey(startOfDay(new Date(quiz.createdAt)))));

		const weeklyStudyStreak = getConsecutiveStreak(activityDaySet);
		const todayKey = getTodayKey();

		const featureUsage = [
			{ feature: "Chat", value: conversationsCount },
			{ feature: "Notes", value: totalNotes },
			{ feature: "MCQ", value: totalMcqGenerated },
			{ feature: "Courses", value: totalCourses },
		];

		const recentActivity = [
			...recentNotesRaw.map((note) => ({
				type: "note",
				title: note.title || "Note created",
				at: note.createdAt,
			})),
			...recentQuizzesRaw.map((quiz) => ({
				type: "mcq",
				title: quiz.title || "MCQ created",
				at: quiz.createdAt,
			})),
			...recentAttemptsRaw.map((attempt) => ({
				type: "quiz",
				title: `Quiz completed (${Math.round(Number(attempt.score || 0))}%)`,
				at: attempt.createdAt,
			})),
			...recentCoursesRaw.map((course) => ({
				type: "course",
				title: `Course: ${course.name}`,
				at: course.createdAt,
			})),
		]
			.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
			.slice(0, 8)
			.map((item) => ({
				...item,
				at: new Date(item.at).toISOString(),
			}));

		const response = {
			totalCourses,
			totalChapters,
			totalLessons,
			totalQuizzes,
			totalMcqGenerated,
			totalNotes,
			averageScore,
			totalStudyTime,
			totalMcqTimeSec,
			totalNotesTimeSec,
			totalCourseWatchedSec,
			totalMcqTimeMinutes: Math.round(totalMcqTimeSec / 60),
			totalNotesTimeMinutes: Math.round(totalNotesTimeSec / 60),
			totalCourseTimeMinutes: Math.round(totalCourseWatchedSec / 60),
			weeklyStudyStreak,
			hasStudiedToday: activityDaySet.has(todayKey),
			strongTopics,
			weakTopics,
			activityTrend,
			weeklyActivity,
			dailyStudyMinutes,
			featureUsage,
			recentActivity,
			topicPerformance,
			performanceHistory,
		};

		dashboardStatsCache.set(cacheKey, {
			expiresAt: Date.now() + CACHE_TTL_MS,
			data: response,
		});

		return NextResponse.json(response);
	} catch (error) {
		console.error("Dashboard stats error:", error);
		return NextResponse.json({ error: "Failed to load dashboard stats" }, { status: 500 });
	}
}

