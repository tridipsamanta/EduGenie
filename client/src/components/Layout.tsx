import { Sidebar, MobileNav } from "./Sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { isOpen } = useSidebar();
  const isChatPage = pathname === "/chat";

  return (
    <div
      className={`bg-background text-foreground flex flex-col md:flex-row ${
        isChatPage ? "h-screen" : "min-h-screen"
      }`}
    >
      <MobileNav />
      <Sidebar />
      <main
        className={cn(
          "flex-1 pt-16 md:pt-0 transition-all duration-300",
          isOpen ? "md:ml-64" : "md:ml-20",
          isChatPage ? "h-full overflow-hidden" : "pb-8"
        )}
      >
        <div
          className={`max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 ${
            isChatPage ? "h-full py-0" : "py-5 sm:py-8"
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}
