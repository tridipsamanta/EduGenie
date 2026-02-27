import { auth } from "@clerk/nextjs/server";

export const NOTES_GUEST_USER_ID = "notes-guest-user";
export const COURSES_GUEST_USER_ID = "courses-guest-user";

export async function getNotesUserId() {
	const session = await auth();
	return session?.userId ?? NOTES_GUEST_USER_ID;
}

export async function getCoursesUserId() {
	const session = await auth();
	return session?.userId ?? COURSES_GUEST_USER_ID;
}

