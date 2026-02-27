import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  PenTool,
  Library,
  GraduationCap,
  Sparkles,
  Mic,
  PenLine,
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";
import { AccountDropdown } from "@/components/AccountDropdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@clerk/clerk-react";
import { useState, useEffect } from "react";
import { useSidebar } from "@/contexts/SidebarContext";

export function Sidebar() {
  const { pathname } = useLocation();
  const { isOpen, toggle, close } = useSidebar();
  const { user } = useUser();

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { label: "My Courses", icon: GraduationCap, href: "/my-courses" },
    { label: "Study Chat", icon: MessageSquare, href: "/chat" },
    { label: "Voice Assistant", icon: Mic, href: "/voice-assistant" },
    { label: "MCQ Generator", icon: Sparkles, href: "/generator" },
    { label: "Practice Mode", icon: PenTool, href: "/practice" },
    { label: "My Notes", icon: Library, href: "/notes" },
    { label: "Handwritten Notes", icon: PenLine, href: "/handwritten-notes" },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={cn(
          "h-screen bg-card border-r border-border flex flex-col fixed left-0 top-0 z-20 transition-all duration-300 ease-in-out",
          "hidden md:flex",
          isOpen ? "w-64" : "w-20"
        )}
      >
        {/* Brand with Toggle Button */}
        <div className={cn(
          "flex items-center justify-between px-3 py-6 transition-all duration-300",
          !isOpen && "flex-col gap-4"
        )}>
          <div className={cn(
            "flex items-center gap-3",
            !isOpen && "justify-center w-full"
          )}>
            <div className="h-10 w-10 bg-gradient-to-br from-purple-700 to-violet-800 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-700/25 overflow-hidden">
              <img 
                src="/app_logo.png" 
                alt="EduGenie Logo" 
                className="h-10 w-10 object-cover brightness-0 invert"
              />
            </div>
            {isOpen && (
              <span className="font-display font-bold text-xl tracking-tight">EduGenie</span>
            )}
          </div>

          {/* Toggle Button */}
          <button
            onClick={toggle}
            className="p-2 rounded-lg hover:bg-muted transition-colors flex items-center justify-center flex-shrink-0"
            title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <ChevronLeft className={cn(
              "h-5 w-5 transition-transform duration-300",
              !isOpen && "rotate-180"
            )} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                title={!isOpen ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  !isOpen && "justify-center px-0"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 transition-colors flex-shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {isOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className={cn(
          "p-4 border-t border-border transition-all duration-300",
          !isOpen && "p-2 flex justify-center items-center"
        )}>
          {isOpen ? (
            <AccountDropdown />
          ) : (
            <Avatar className="h-10 w-10 border border-border cursor-pointer hover:ring-2 hover:ring-primary transition-all" title="Account">
              <AvatarImage src={user?.imageUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={close}
        />
      )}
    </>
  );
}

export function MobileNav() {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { label: "My Courses", icon: GraduationCap, href: "/my-courses" },
    { label: "Study Chat", icon: MessageSquare, href: "/chat" },
    { label: "Voice Assistant", icon: Mic, href: "/voice-assistant" },
    { label: "MCQ Generator", icon: Sparkles, href: "/generator" },
    { label: "Practice Mode", icon: PenTool, href: "/practice" },
    { label: "My Notes", icon: Library, href: "/notes" },
    { label: "Handwritten Notes", icon: PenLine, href: "/handwritten-notes" },
  ];

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  return (
    <div className="md:hidden">
      {/* Top Header */}
      <div className="fixed top-0 left-0 right-0 bg-card border-b border-border z-40 px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-gradient-to-br from-purple-700 to-violet-800 rounded-lg flex items-center justify-center shadow-lg shadow-purple-700/20 overflow-hidden">
            <img 
              src="/app_logo.png" 
              alt="EduGenie Logo" 
              className="h-8 w-8 object-cover brightness-0 invert"
            />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">EduGenie</span>
        </div>

        {/* Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-expanded={isOpen}
          aria-haspopup="true"
          title="Menu"
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Full-Screen Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 h-screen w-64 bg-card border-r border-border z-40 flex flex-col",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="p-6 flex items-center gap-3 pt-20">
          <div className="h-10 w-10 bg-gradient-to-br from-purple-700 to-violet-800 rounded-xl flex items-center justify-center shadow-lg shadow-purple-700/25 overflow-hidden">
            <img 
              src="/app_logo.png" 
              alt="EduGenie Logo" 
              className="h-10 w-10 object-cover brightness-0 invert"
            />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">EduGenie</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-border">
          <AccountDropdown />
        </div>
      </div>
    </div>
  );
}
