// Local type definitions (frontend-only mode)

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertSubject {
  name: string;
  description?: string;
}

export interface InsertTopic {
  name: string;
  subjectId: number;
  description?: string;
}

export interface InsertQuiz {
  userId?: string;
  title: string;
  description?: string;
  totalQuestions?: number;
  timePerQuestionSec?: number;
  topicId?: number;
  score?: number;
  questions: {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
    topic?: string;
  }[];
}

export interface InsertSavedNote {
  title: string;
  contentMarkdown?: string;
  content?: string;
  sourceType?: "manual" | "pdf" | "url" | "youtube" | "ai";
  sourceLink?: string;
  tags?: string[];
}

export interface GenerateMCQRequest {
  topic: string;
  questionType?: "school" | "competitive" | "conceptual" | string;
  numberOfQuestions?: number;
  sourceText?: string;
  count?: number;
  text?: string;
  type?: "school" | "competitive" | "conceptual" | string;
  difficulty?: "easy" | "medium" | "hard";
}

export interface SubmitQuizRequest {
  quizId: number;
  answers: Record<string, any>;
}

export interface AttemptAnswerPayload {
  attemptId: string;
  questionId: string;
  selectedOption: string;
}
