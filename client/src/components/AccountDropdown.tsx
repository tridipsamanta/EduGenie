import { useRef, useState, useEffect } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/components/theme-provider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Moon, Sun, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AccountDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const isDark = theme === "dark";

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: '/' });
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors group cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Account menu"
      >
        <Avatar className="h-10 w-10 border border-border dark:border-slate-600">
          <AvatarImage src={user?.imageUrl || undefined} />
          <AvatarFallback className="bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary/80">
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden text-left">
          <p className="text-sm font-semibold truncate dark:text-slate-100">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-muted-foreground dark:text-slate-400 truncate">
            {user?.primaryEmailAddress?.emailAddress}
          </p>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute bottom-full left-0 right-0 mb-2 bg-card dark:bg-slate-900 border border-border dark:border-slate-700',
            'rounded-lg shadow-lg dark:shadow-2xl shadow-black/10 dark:shadow-black/40',
            'overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200',
            'z-50 w-full'
          )}
        >
          {/* User Info Section */}
          <div className="p-4 border-b border-border dark:border-slate-700 bg-secondary/50 dark:bg-slate-800/50">
            <p className="text-xs text-muted-foreground dark:text-slate-400 mb-1">Signed in as</p>
            <p className="text-sm font-semibold truncate dark:text-slate-100">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>

          {/* Theme Toggle */}
          <div className="p-3 border-b border-border dark:border-slate-700">
            <button
              onClick={() => {
                setTheme(isDark ? "light" : "dark");
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg',
                'text-sm font-medium transition-colors duration-200',
                'hover:bg-muted dark:hover:bg-slate-700',
                'text-foreground dark:text-slate-300'
              )}
            >
              <span className="flex items-center gap-2">
                {isDark ? (
                  <Moon className="h-4 w-4 text-blue-500" />
                ) : (
                  <Sun className="h-4 w-4 text-yellow-500" />
                )}
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </span>
              <div className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full',
                'bg-muted dark:bg-slate-700 transition-colors'
              )}>
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full',
                    'bg-white dark:bg-slate-300 shadow-lg',
                    'transition-transform duration-200',
                    isDark ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </div>
            </button>
          </div>

          {/* Sign Out Button */}
          <div className="p-3">
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className={cn(
                'w-full justify-start gap-2 text-destructive',
                'hover:bg-destructive/10 dark:hover:bg-destructive/20',
                'transition-colors duration-200'
              )}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
