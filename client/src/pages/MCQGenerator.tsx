import { Layout } from "@/components/Layout";
import { useGenerateMCQ, useStartAttempt } from "@/hooks/use-data";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, CheckCircle2, Save, Trash2, Clock, Trophy, PlayCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateQuiz } from "@/hooks/use-data";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "@/lib/axios";

const formSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  text: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.number().min(1).max(20),
  type: z.enum(["school", "competitive", "conceptual"]),
});

type FormData = z.infer<typeof formSchema>;

interface MCQHistoryItem {
  id: string;
  topic: string;
  difficulty: string;
  type: string;
  questionCount: number;
  questions: any[];
  generatedAt: Date;
}

export default function MCQGenerator() {
  const { mutate: generate, isPending, data: generatedData } = useGenerateMCQ();
  const { mutate: saveQuiz, isPending: isSaving } = useCreateQuiz();
  const { mutateAsync: startAttempt } = useStartAttempt();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [history, setHistory] = useState<MCQHistoryItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentGenerated, setCurrentGenerated] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlayingGenerated, setIsPlayingGenerated] = useState(false);
  const processedGenerationsRef = useRef<Set<string>>(new Set());
  const lastFormDataRef = useRef<FormData | null>(null);
  const generatedSectionRef = useRef<HTMLDivElement>(null);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
      text: "",
      difficulty: "medium",
      count: 5,
      type: "school",
    },
  });

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("mcq_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history:", e);
      }
    }

    // Load current generated MCQs from localStorage
    const savedCurrent = localStorage.getItem("mcq_current_generated");
    if (savedCurrent) {
      try {
        setCurrentGenerated(JSON.parse(savedCurrent));
      } catch (e) {
        console.error("Failed to load current generated MCQs:", e);
      }
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("mcq_history", JSON.stringify(history));
  }, [history]);

  // Save current generated MCQs to localStorage whenever they change
  useEffect(() => {
    if (currentGenerated) {
      localStorage.setItem("mcq_current_generated", JSON.stringify(currentGenerated));
    } else {
      localStorage.removeItem("mcq_current_generated");
    }
  }, [currentGenerated]);

  // Track generated data and add to history when new MCQs are generated
  useEffect(() => {
    if (generatedData?.questions && generatedData.questions.length > 0 && !isPending && lastFormDataRef.current) {
      // Create unique ID based on first question content and timestamp
      const generationId = `${generatedData.questions[0].question}_${generatedData.questions.length}`;
      
      // Only add if this generation hasn't been processed yet
      if (!processedGenerationsRef.current.has(generationId)) {
        processedGenerationsRef.current.add(generationId);
        const currentTimestamp = Date.now();
        
        // Store in local state to persist the MCQs with form data
        const generatedWithFormData = {
          questions: generatedData.questions,
          formData: lastFormDataRef.current,
        };
        setCurrentGenerated(generatedWithFormData);
        setIsExpanded(false); // Start collapsed
        
        const historyItem: MCQHistoryItem = {
          id: `mcq_${currentTimestamp}`,
          topic: lastFormDataRef.current.topic,
          difficulty: lastFormDataRef.current.difficulty,
          type: lastFormDataRef.current.type,
          questionCount: lastFormDataRef.current.count,
          questions: generatedData.questions,
          generatedAt: new Date(),
        };
        
        setHistory(prev => {
          console.log('Adding to history. Previous count:', prev.length);
          const newHistory = [historyItem, ...prev];
          console.log('New history count:', newHistory.length);
          return newHistory;
        });
        
        toast({ 
          title: "Success", 
          description: `${generatedData.questions.length} questions generated` 
        });
      }
    }
  }, [generatedData, isPending, toast]);

  // Auto-scroll to generated section
  useEffect(() => {
    if (currentGenerated && generatedSectionRef.current) {
      setTimeout(() => {
        generatedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [currentGenerated]);

  const onSubmit = (data: FormData) => {
    lastFormDataRef.current = data;
    generate(data);
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(history.filter(item => item.id !== id));
    toast({ title: "Deleted", description: "MCQ history item removed" });
  };

  const handleClearGenerated = () => {
    setCurrentGenerated(null);
    localStorage.removeItem("mcq_current_generated");
    toast({ title: "Cleared", description: "Generated MCQs cleared" });
  };

  const handleSaveQuiz = () => {
    let questionsToSave, formDataToUse;
    
    if (currentGenerated?.questions && currentGenerated?.formData) {
      questionsToSave = currentGenerated.questions;
      formDataToUse = currentGenerated.formData;
    } else if (generatedData?.questions) {
      questionsToSave = generatedData.questions;
      formDataToUse = form.getValues();
    } else {
      return;
    }

    if (!questionsToSave || !user) return;
    
    saveQuiz({
      userId: user.id,
      title: `Generated Quiz: ${formDataToUse.topic}`,
      description: `Generated from AI. Difficulty: ${formDataToUse.difficulty}`,
      totalQuestions: questionsToSave.length,
      questions: questionsToSave.map((question: any) => ({
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        topic: formDataToUse.topic,
      })),
      isGenerated: true,
      source: "mcq-generator",
    });
  };

  const handlePlayGenerated = async () => {
    let questionsToPlay, formDataToUse;
    
    if (currentGenerated?.questions && currentGenerated?.formData) {
      questionsToPlay = currentGenerated.questions;
      formDataToUse = currentGenerated.formData;
    } else if (generatedData?.questions) {
      questionsToPlay = generatedData.questions;
      formDataToUse = form.getValues();
    } else {
      return;
    }

    if (!questionsToPlay || !user) return;

    setIsPlayingGenerated(true);
    try {
      // Create the quiz with inline data
      const quizData = {
        userId: user.id,
        title: `Generated Quiz: ${formDataToUse.topic}`,
        description: `Generated from AI. Difficulty: ${formDataToUse.difficulty}`,
        totalQuestions: questionsToPlay.length,
        questions: questionsToPlay.map((question: any) => ({
          question: question.question,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          topic: formDataToUse.topic,
        })),
        isGenerated: true,
        source: "mcq-generator",
      };

      // Create quiz
      const quizRes = await axiosInstance.post("/api/quizzes", quizData);
      const createdQuiz = quizRes.data;
      
      // Start attempt
      const attemptRes = await axiosInstance.post(`/api/attempt/start`, {
        quizId: createdQuiz.id,
      });
      const attemptData = attemptRes.data;

      toast({ title: "Success", description: "Quiz loaded. Let's play!" });
      navigate(`/practice/${attemptData.attemptId}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start quiz",
        variant: "destructive",
      });
    } finally {
      setIsPlayingGenerated(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 text-primary rounded-full mb-4">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-4">AI MCQ Generator</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Instantly create high-quality multiple choice questions from any topic or text passage.
          </p>
        </div>

        <div className="grid gap-8">
          <Card className="rounded-2xl border-border/50 shadow-lg">
            <CardContent className="p-8">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Input 
                    {...form.register("topic")} 
                    placeholder="e.g. Photosynthesis, World War II, Calculus..." 
                    className="h-12 text-lg"
                  />
                  {form.formState.errors.topic && (
                    <p className="text-sm text-destructive">{form.formState.errors.topic.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Source Text (Optional)</Label>
                  <Textarea 
                    {...form.register("text")} 
                    placeholder="Paste context here to generate questions from specific content..." 
                    className="min-h-[100px] resize-none"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select 
                      defaultValue="medium" 
                      onValueChange={(val) => form.setValue("difficulty", val as any)}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Question Type</Label>
                    <Select 
                      defaultValue="school"
                      onValueChange={(val) => form.setValue("type", val as any)}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="school">School / Academic</SelectItem>
                        <SelectItem value="competitive">Competitive Exam</SelectItem>
                        <SelectItem value="conceptual">Conceptual Understanding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex justify-between">
                    <Label>Number of Questions: {form.watch("count")}</Label>
                  </div>
                  <Slider 
                    defaultValue={[5]} 
                    max={20} 
                    min={1} 
                    step={1} 
                    onValueChange={(vals) => form.setValue("count", vals[0])}
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isPending}
                  className="w-full h-12 text-lg rounded-xl font-semibold bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/20 transition-all"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating Magic...
                    </>
                  ) : (
                    "Generate Questions"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Results Area */}
          {currentGenerated && currentGenerated.questions && currentGenerated.questions.length > 0 && (
            <div ref={generatedSectionRef} className="animate-in fade-in slide-in-from-bottom-8 duration-500">
              <Card className="overflow-hidden border-border/50 hover:border-border/80 transition-colors">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Sparkles className="h-5 w-5 text-primary" />
                          <h3 className="text-2xl font-bold text-foreground">{currentGenerated.formData?.topic}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium",
                            currentGenerated.formData?.difficulty === "easy" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                            currentGenerated.formData?.difficulty === "medium" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                            currentGenerated.formData?.difficulty === "hard" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          )}>
                            {currentGenerated.formData?.difficulty?.charAt(0).toUpperCase() + currentGenerated.formData?.difficulty?.slice(1)}
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            {currentGenerated.formData?.type}
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            {currentGenerated.questions.length} Questions
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">Just generated</p>
                      </div>
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex-shrink-0 p-2 hover:bg-secondary rounded-lg transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-border/50">
                      <Button
                        onClick={handlePlayGenerated}
                        disabled={isPlayingGenerated}
                        className="gap-2 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
                      >
                        {isPlayingGenerated ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlayCircle className="h-4 w-4" />
                        )}
                        Play
                      </Button>
                      <Button
                        onClick={handleSaveQuiz}
                        disabled={isSaving}
                        variant="outline"
                        className="gap-2"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save as Quiz
                      </Button>
                      <Button
                        onClick={handleClearGenerated}
                        variant="ghost"
                        className="gap-2 text-muted-foreground hover:text-foreground ml-auto"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>

                    {/* Expanded Questions */}
                    {isExpanded && (
                      <div className="border-t border-border/50 pt-6 mt-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <h4 className="font-semibold text-lg">Question Details</h4>
                        <div className="grid gap-3">
                          {currentGenerated.questions.map((q: any, idx: number) => (
                            <div key={idx} className="p-4 bg-secondary/30 rounded-lg border border-border/50">
                              <div className="flex gap-3">
                                <span className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                                  {idx + 1}
                                </span>
                                <div className="flex-1">
                                  <p className="font-medium text-sm mb-2">{q.question}</p>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {(q.options as string[]).map((opt: string, optIdx: number) => (
                                      <div
                                        key={optIdx}
                                        className={cn(
                                          "p-2 rounded text-xs border transition-colors",
                                          opt === q.correctAnswer
                                            ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
                                            : "bg-background border-border/50 text-foreground"
                                        )}
                                      >
                                        {opt}
                                        {opt === q.correctAnswer && <CheckCircle2 className="h-3 w-3 inline-block ml-1 align-middle" />}
                                      </div>
                                    ))}
                                  </div>
                                  {q.explanation && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 rounded text-xs">
                                      <strong>💡 </strong>{q.explanation}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* History Section */}
        {history.length > 0 && (
          <div className="mt-16 pt-12 border-t border-border/50">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full mb-4">
                <Clock className="h-6 w-6" />
              </div>
              <h2 className="text-3xl font-display font-bold mb-2">Generation History</h2>
              <p className="text-muted-foreground">
                Previously generated MCQ sets ({history.length} total)
              </p>
            </div>

            <div className="grid gap-4">
              {history.map((item) => (
                <Card 
                  key={item.id} 
                  className="overflow-hidden border-border/50 hover:border-border/80 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Trophy className="h-5 w-5 text-amber-500" />
                            <h3 className="text-xl font-bold text-foreground">{item.topic}</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium",
                              item.difficulty === "easy" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                              item.difficulty === "medium" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                              item.difficulty === "hard" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            )}>
                              {item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              {item.type}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                              {item.questionCount} Questions
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(item.generatedAt).toLocaleDateString()} {new Date(item.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteHistory(item.id);
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {expandedId === item.id && (
                        <div className="border-t border-border/50 pt-6 mt-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="grid gap-3">
                            {item.questions.map((q, idx) => (
                              <div key={idx} className="p-4 bg-secondary/30 rounded-lg border border-border/50">
                                <div className="flex gap-3">
                                  <span className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                                    {idx + 1}
                                  </span>
                                  <div className="flex-1">
                                    <p className="font-medium text-sm mb-2">{q.question}</p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {(q.options as string[]).map((opt, optIdx) => (
                                        <div 
                                          key={optIdx} 
                                          className={cn(
                                            "p-2 rounded text-xs border transition-colors",
                                            opt === q.correctAnswer 
                                              ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
                                              : "bg-background border-border/50 text-foreground"
                                          )}
                                        >
                                          {opt}
                                          {opt === q.correctAnswer && <CheckCircle2 className="h-3 w-3 inline-block ml-1 align-middle" />}
                                        </div>
                                      ))}
                                    </div>
                                    {q.explanation && (
                                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 rounded text-xs">
                                        <strong>💡 </strong>{q.explanation}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
