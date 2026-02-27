import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { MyCoursesClient } from "@/app/workspace/my-courses/my-courses-client";

export default async function MyCoursesPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return <MyCoursesClient />;
}
