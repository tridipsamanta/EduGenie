import { useClerk, useUser } from "@clerk/clerk-react";
import { useMemo, useState } from "react";
import type { User } from "@/lib/types";

export function useAuth() {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const user = useMemo<User | null>(() => {
    if (!clerkUser) {
      return null;
    }

    return {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || "",
      firstName: clerkUser.firstName || "",
      lastName: clerkUser.lastName || "",
      profileImageUrl: clerkUser.imageUrl || null,
      createdAt: clerkUser.createdAt ? new Date(clerkUser.createdAt) : new Date(),
      updatedAt: clerkUser.updatedAt ? new Date(clerkUser.updatedAt) : new Date(),
    };
  }, [clerkUser]);

  const logout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut({ redirectUrl: "/landing" });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return {
    user,
    isLoading: !isLoaded,
    isAuthenticated: !!user,
    logout,
    isLoggingOut,
  };
}
