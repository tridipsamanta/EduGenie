import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import AuthProvider from "@/providers/AuthProvider";
import { ChatStoreProvider } from "@/context/ChatStore";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Chat from "@/pages/Chat";
import MCQGenerator from "@/pages/MCQGenerator";
import Notes from "@/pages/Notes";
import NoteView from "@/pages/NoteView";
import Practice from "@/pages/Practice";
import QuizPlayer from "@/pages/QuizPlayer";
import PracticeResult from "@/pages/PracticeResult";
import PracticeReview from "@/pages/PracticeReview";
import VoiceAssistant from "@/pages/VoiceAssistant";
import MyCourses from "@/pages/MyCourses";
import CourseView from "@/pages/CourseView";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";
import SSOCallback from "@/pages/SSOCallback";
import AuthCallback from "@/pages/AuthCallback";
import Docs from "@/pages/Docs";
import FloatingVoiceAssistant from "@/components/FloatingVoiceAssistant";
import HandwrittenNotes from "@/pages/HandwrittenNotes";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

function Router() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/landing" replace />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/sign-up" element={<SignUp />} />
      <Route path="/sso-callback" element={<SSOCallback />} />
      <Route path="/auth-callback" element={<AuthCallback />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-courses"
        element={
          <ProtectedRoute>
            <MyCourses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-courses/:courseId"
        element={
          <ProtectedRoute>
            <CourseView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/my-courses"
        element={
          <ProtectedRoute>
            <MyCourses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/my-courses/:courseId"
        element={
          <ProtectedRoute>
            <CourseView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/voice-assistant"
        element={
          <ProtectedRoute>
            <VoiceAssistant />
          </ProtectedRoute>
        }
      />
      <Route
        path="/generator"
        element={
          <ProtectedRoute>
            <MCQGenerator />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notes"
        element={
          <ProtectedRoute>
            <Notes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/handwritten-notes"
        element={
          <ProtectedRoute>
            <HandwrittenNotes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notes/:id"
        element={
          <ProtectedRoute>
            <NoteView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/practice"
        element={
          <ProtectedRoute>
            <Practice />
          </ProtectedRoute>
        }
      />
      <Route
        path="/practice/:attemptId"
        element={
          <ProtectedRoute>
            <QuizPlayer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/practice/result/:attemptId"
        element={
          <ProtectedRoute>
            <PracticeResult />
          </ProtectedRoute>
        }
      />
      <Route
        path="/practice/review/:attemptId"
        element={
          <ProtectedRoute>
            <PracticeReview />
          </ProtectedRoute>
        }
      />
      <Route path="/docs" element={<Docs />} />
      <Route path="/docs/:slug" element={<Docs />} />
      <Route path="/not-found" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/landing" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ChatStoreProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Router />
            <FloatingVoiceAssistant />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ChatStoreProvider>
  );
}

export default App;
