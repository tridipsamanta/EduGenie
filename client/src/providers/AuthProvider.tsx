import { axiosInstance } from "@/lib/axios";
import { useAuth } from "@clerk/clerk-react";
import { Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { useChatStore } from "@/context/ChatStore";

const updateApiToken = (token: string | null) => {
  if (token) {
    axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete axiosInstance.defaults.headers.common["Authorization"];
  }
};

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken, userId, isLoaded } = useAuth();
  const { clearChatStore } = useChatStore();
  const [loading, setLoading] = useState(true);
  const [prevUserId, setPrevUserId] = useState<string | null>(null);

  // Handle logout - clear chat store when user becomes undefined
  useEffect(() => {
    if (isLoaded && prevUserId && !userId) {
      // User just logged out
      clearChatStore();
    }
    setPrevUserId(userId || null);
  }, [userId, isLoaded, prevUserId, clearChatStore]);

  useEffect(() => {
    if (!isLoaded) {
      setLoading(true);
      return;
    }

    const requestInterceptor = axiosInstance.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    let isActive = true;

    const initAuth = async () => {
      try {
        const token = await getToken();
        updateApiToken(token);
        
        if (token && userId) {
          // Optionally: Initialize any backend connection here
          console.log("User authenticated:", userId);
        }
      } catch (error: any) {
        updateApiToken(null);
        console.error("Error in auth provider:", error);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isActive = false;
      axiosInstance.interceptors.request.eject(requestInterceptor);
    };
  }, [getToken, userId, isLoaded]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader className="size-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
