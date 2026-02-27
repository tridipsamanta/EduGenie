import { Layout } from "@/components/Layout";
import { useQuizzes, useStartAttempt, useDeleteQuiz } from "@/hooks/use-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, Clock, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Practice() {
  const { data: quizzes, isLoading } = useQuizzes();
  const { mutateAsync: startAttempt } = useStartAttempt();
  const { mutateAsync: deleteQuiz, isPending: isDeleting } = useDeleteQuiz();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [startingQuizId, setStartingQuizId] = useState<string | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleStartQuiz = async (quizId: string) => {
    try {
      setStartingQuizId(quizId);
      const data = await startAttempt({ quizId, userId: user?.id });
      navigate(`/practice/${data.attemptId}`);
    } finally {
      setStartingQuizId(null);
    }
  };

  const handleDeleteClick = (quizId: string) => {
    setDeletingQuizId(quizId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingQuizId) return;
    try {
      await deleteQuiz(deletingQuizId);
      setIsDeleteDialogOpen(false);
      setDeletingQuizId(null);
    } catch (error) {
      // Error toast is handled by the mutation
    }
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold mb-2">Practice Mode</h1>
        <p className="text-muted-foreground">Review your past quizzes or start a new practice session.</p>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div>Loading...</div>
        ) : quizzes?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No quizzes available.</p>
            <Link to="/generator">
              <Button>Generate a Quiz</Button>
            </Link>
          </div>
        ) : (
          quizzes?.map((quiz) => (
            <Card key={quiz.id} className="overflow-hidden border-border/50 hover:border-border transition-colors">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <div className="p-6 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg">{quiz.title}</h3>
                      <Badge variant="outline">Ready</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{quiz.description}</p>
                    
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{new Date(quiz.createdAt || "").toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{quiz.totalQuestions} Questions</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 bg-secondary/30 sm:w-48 flex flex-col items-center justify-center gap-2 border-t sm:border-t-0 sm:border-l border-border/50">
                    <Button
                      className="w-full rounded-full"
                      onClick={() => handleStartQuiz(String(quiz.id))}
                      disabled={startingQuizId === String(quiz.id)}
                    >
                      {startingQuizId === String(quiz.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Start Quiz
                          <PlayCircle className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteClick(String(quiz.id))}
                      disabled={isDeleting && deletingQuizId === String(quiz.id)}
                    >
                      {isDeleting && deletingQuizId === String(quiz.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Delete
                          <Trash2 className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quiz? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
