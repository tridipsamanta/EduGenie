import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2, Pencil, Save, Sparkles, Trash2, X } from "lucide-react";
import { axiosInstance } from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

function toPlainText(value: any): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => toPlainText(item)).join("");
  if (value?.props?.children) return toPlainText(value.props.children);
  return "";
}

function getSectionHeadingClass(rawText: string) {
  const text = rawText.toLowerCase();

  // Create a light, pastel color scheme that's eye-catching but pleasant
  if (text.includes("definition") || text.includes("what is")) {
    return "text-xl sm:text-2xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4 px-3 sm:px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700";
  }

  if (text.includes("topic") || text.includes("concept")) {
    return "text-xl sm:text-2xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4 px-3 sm:px-4 py-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 text-cyan-900 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-700";
  }

  if (text.includes("example") || text.includes("application")) {
    return "text-xl sm:text-2xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4 px-3 sm:px-4 py-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700";
  }

  if (text.includes("diagram") || text.includes("flow") || text.includes("architecture")) {
    return "text-xl sm:text-2xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4 px-3 sm:px-4 py-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700";
  }

  if (text.includes("question") || text.includes("revision") || text.includes("exam")) {
    return "text-xl sm:text-2xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4 px-3 sm:px-4 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700";
  }

  if (text.includes("mistake") || text.includes("common error") || text.includes("wrong")) {
    return "text-xl sm:text-2xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4 px-3 sm:px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 border border-red-300 dark:border-red-700";
  }

  if (text.includes("important") || text.includes("key point") || text.includes("remember")) {
    return "text-xl sm:text-2xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4 px-3 sm:px-4 py-2 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700";
  }

  if (text.includes("formula") || text.includes("equation") || text.includes("rule")) {
    return "text-xl sm:text-2xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4 px-3 sm:px-4 py-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700";
  }

  if (text.includes("quick") || text.includes("summary") || text.includes("overview")) {
    return "text-xl sm:text-2xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4 px-3 sm:px-4 py-2 rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700";
  }

  if (text.includes("trick") || text.includes("mnemonic") || text.includes("memory")) {
    return "text-xl sm:text-2xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4 px-3 sm:px-4 py-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-200 border border-orange-300 dark:border-orange-700";
  }

  // Default fallback with light color
  return "text-xl sm:text-2xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4 px-3 sm:px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700";
}

function getParagraphClass(rawText: string) {
  const text = rawText.toLowerCase().trim();
  if (
    text.startsWith("topic:") ||
    text.startsWith("example:") ||
    text.startsWith("diagram:") ||
    text.startsWith("formula:") ||
    text.startsWith("note:")
  ) {
    return "mb-4 px-3 sm:px-4 py-3 rounded-lg bg-amber-100/50 dark:bg-amber-900/20 border border-amber-400 dark:border-amber-700 text-amber-950 dark:text-amber-100 font-medium";
  }

  return "mb-4 sm:mb-5 leading-relaxed [overflow-wrap:anywhere]";
}

async function downloadNotePDF(noteTitle: string, content: string) {
  return new Promise((resolve, reject) => {
    try {
      console.log("Starting PDF download for:", noteTitle);
      
      // Load html2pdf from CDN
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.async = true;
      
      script.onload = () => {
        try {
          console.log("html2pdf script loaded successfully");
          const html2pdf = (window as any).html2pdf;
          if (!html2pdf) {
            throw new Error("html2pdf library not found on window object");
          }

          // Create a container with the note content styled
          const element = document.createElement("div");
          element.style.padding = "40px";
          element.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
          element.style.lineHeight = "1.8";
          element.style.color = "#1f2937";
          element.style.backgroundColor = "#ffffff";
          
          // Sanitize and create content
          const cleanTitle = noteTitle.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          element.innerHTML = `
            <div style="max-width: 800px; margin: 0 auto;">
              <h1 style="
                font-size: 32px;
                font-weight: bold;
                margin: 0 0 20px 0;
                padding: 15px;
                background-color: #e0e7ff;
                color: #1e1b4b;
                border: 2px solid #a5b4fc;
                border-radius: 8px;
              ">${cleanTitle}</h1>
              <div style="margin-top: 20px; line-height: 1.8; font-size: 14px;">
                ${content}
              </div>
            </div>
          `;

          // Configure PDF options
          const sanitizedFilename = noteTitle.replace(/[<>:"/\\|?*]/g, "_");
          const options = {
            margin: [10, 10, 10, 10],
            filename: `${sanitizedFilename}.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
            pagebreak: { mode: ["avoid-all", "css", "legacy"] },
          };

          console.log("Starting PDF generation with options:", options);
          
          // Generate and download PDF
          html2pdf()
            .set(options)
            .from(element)
            .save()
            .then(() => {
              console.log("PDF downloaded successfully");
              resolve(true);
            })
            .catch((error: any) => {
              console.error("Error during PDF generation:", error);
              reject(new Error("Failed to generate PDF content"));
            });
        } catch (error: any) {
          console.error("Error in html2pdf onload:", error);
          reject(new Error(error.message || "Failed to generate PDF"));
        }
      };

      script.onerror = () => {
        console.error("Failed to load html2pdf from CDN");
        reject(new Error("Failed to load PDF library from CDN. Please check your internet connection."));
      };

      // Remove any existing script to avoid conflicts
      const existingScript = document.querySelector('script[src*="html2pdf"]');
      if (existingScript && existingScript !== script) {
        console.log("Removing existing html2pdf script");
        existingScript.remove();
      }

      console.log("Appending html2pdf script to head");
      document.head.appendChild(script);
    } catch (error: any) {
      console.error("Error in downloadNotePDF:", error);
      reject(error);
    }
  });
}


export default function NoteView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(searchParams.get("edit") === "true");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [appendContent, setAppendContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [extendPageCount, setExtendPageCount] = useState("2");
  const [isGeneratingAppend, setIsGeneratingAppend] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: note, isLoading } = useQuery({
    queryKey: ["/api/notes", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/api/notes/${id}`);
      return res.data.note;
    },
    enabled: !!id,
  });

  const handleStartEdit = () => {
    if (!note) return;
    setDraftTitle(note.title || "");
    setDraftContent(note.content || "");
    setAppendContent("");
    setAiPrompt("");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setDraftTitle(note?.title || "");
    setDraftContent(note?.content || "");
    setAppendContent("");
    setAiPrompt("");
    setExtendPageCount("2");
  };

  const handleGenerateAppend = async () => {
    if (!id || !note) return;

    const prompt = aiPrompt.trim();
    if (!prompt) {
      toast({
        title: "Error",
        description: "Enter what you want to add",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAppend(true);
    try {
      const res = await axiosInstance.post(`/api/notes/${id}/extend`, { 
        prompt,
        pageCount: parseInt(extendPageCount) || 2
      });
      const generatedText = String(res.data?.generatedText || "").trim();

      if (!generatedText) {
        throw new Error("No generated content returned");
      }

      setAppendContent((prev) => `${prev.trim()}${prev.trim() ? "\n\n" : ""}${generatedText}`.trim());
      setAiPrompt("");
      toast({ title: "Success", description: "AI content appended" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || error.message || "Failed to generate content",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAppend(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!id) return;

    const title = draftTitle.trim();
    const content = `${draftContent.trim()}${appendContent.trim() ? `\n\n${appendContent.trim()}` : ""}`.trim();

    if (!title || !content) {
      toast({
        title: "Error",
        description: "Title and content are required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await axiosInstance.put(`/api/notes/${id}`, {
        title,
        content,
        tags: note?.tags || [],
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setIsEditing(false);
      setAppendContent("");
      toast({ title: "Success", description: "Note updated" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update note",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axiosInstance.delete(`/api/notes/${id}`);
      toast({ title: "Success", description: "Note deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      navigate("/notes");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete note",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPDF = async () => {
    if (!note) return;
    
    setIsDownloading(true);
    try {
      // Convert markdown to HTML for PDF with styling
      const htmlContent = note.content
        .replace(/# (.*?)(\n|$)/g, '<h1 style="font-size: 28px; font-weight: bold; margin: 20px 0 10px; padding: 12px; background-color: #e0e7ff; color: #1e1b4b; border: 2px solid #a5b4fc; border-radius: 8px;">$1</h1>')
        .replace(/## (.*?)(\n|$)/g, '<h2 style="font-size: 22px; font-weight: bold; margin: 16px 0 8px; padding: 10px; background-color: #dbeafe; color: #1e3a8a; border: 2px solid #93c5fd; border-radius: 6px;">$1</h2>')
        .replace(/### (.*?)(\n|$)/g, '<h3 style="font-size: 18px; font-weight: bold; margin: 14px 0 6px; padding: 8px; background-color: #f3e8ff; color: #6b21a8; border: 2px solid #d8a5f7; border-radius: 6px;">$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: bold; background-color: #fef3c7; color: #92400e; padding: 2px 4px; border-radius: 3px;">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em style="font-style: italic; color: #6d28d9;">$1</em>')
        .replace(/- (.*?)(\n|$)/g, '<div style="margin: 8px 0 8px 20px;">• $1</div>')
        .replace(/\`(.*?)\`/g, '<code style="background-color: #f3f4f6; color: #374151; padding: 2px 6px; border-radius: 3px; font-family: monospace;">$1</code>')
        .replace(/\n\n/g, '<br/><br/>')
        .replace(/\n/g, '<br/>');

      await downloadNotePDF(note.title, htmlContent);
      
      toast({ 
        title: "Success", 
        description: `Downloaded ${note.title}.pdf` 
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to download PDF",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!note) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Note Not Found</h1>
          <Button onClick={() => navigate("/notes")}>Back to Notes</Button>
        </div>
      </Layout>
    );
  }

  const isGeneratedNote = note.sourceType !== "manual";

  return (
    <Layout>
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="mb-5 sm:mb-8 space-y-3 sm:space-y-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/notes")}
            className="mb-1 sm:mb-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 sm:mb-3"
                  placeholder="Note title"
                />
              ) : (
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 leading-tight [overflow-wrap:anywhere]">{note.title}</h1>
              )}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                <span>📅 {new Date(note.createdAt).toLocaleDateString()}</span>
                <span className="px-3 py-1 bg-secondary rounded-full text-xs font-medium">
                  {note.sourceType === "ai"
                    ? "🤖 AI Generated"
                    : note.sourceType === "youtube"
                    ? "🎥 YouTube"
                    : note.sourceType === "url"
                    ? "🌐 Article"
                    : "✏️ Manual"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="flex-1 sm:flex-none"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={isSaving} className="flex-1 sm:flex-none">
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={handleStartEdit} className="flex-1 sm:flex-none">
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="flex-1 sm:flex-none"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                {!isDownloading && "Download PDF"}
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="sm:flex-none"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <Card className="p-0 overflow-hidden bg-white dark:bg-slate-950">
          <div className="mx-auto p-4 sm:p-6 md:p-10 lg:p-12">
            <div
              className="mx-auto max-w-[800px] text-[15px] sm:text-base md:text-lg leading-7 sm:leading-8 [overflow-wrap:anywhere]"
            >
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Main Content</label>
                    <Textarea
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                      className="min-h-[400px] text-base font-mono"
                      placeholder="Edit your note content here... (supports markdown)"
                    />
                  </div>
                  
                  <div className="rounded-lg border p-4 space-y-3 bg-blue-50 dark:bg-blue-950">
                    <p className="text-sm text-muted-foreground">
                      Add more content below. Use AI to generate or manually type.
                    </p>
                    <Input
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Example: Add more details about normalization"
                    />
                    <div className="flex items-center gap-3">
                      <label htmlFor="pages" className="text-sm font-medium">Pages:</label>
                      <select
                        id="pages"
                        value={extendPageCount}
                        onChange={(e) => setExtendPageCount(e.target.value)}
                        className="text-sm border rounded px-2 py-1 w-16 bg-background text-foreground"
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </select>
                      <span className="text-xs text-muted-foreground">~450-650 words per page</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGenerateAppend}
                      disabled={isGeneratingAppend}
                      className="w-full"
                    >
                      {isGeneratingAppend ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Generate & Append
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Additional Content to Append</label>
                    <Textarea
                      value={appendContent}
                      onChange={(e) => setAppendContent(e.target.value)}
                      className="min-h-[200px] text-base"
                      placeholder="Generated or manually typed content to append..."
                    />
                  </div>
                </div>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    h1: ({ children, ...props }) => (
                      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-3 sm:mt-4 mb-3 sm:mb-4 px-3 sm:px-6 py-2 sm:py-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700 [overflow-wrap:anywhere]" {...props}>{children}</h1>
                    ),
                    h2: ({ children, ...props }) => {
                      const text = toPlainText(children);
                      return (
                        <h2
                          className={isGeneratedNote ? getSectionHeadingClass(text) : "text-2xl font-semibold mt-8 mb-4"}
                          {...props}
                        >
                          {children}
                        </h2>
                      );
                    },
                    h3: ({ children, ...props }) => {
                      const text = toPlainText(children);
                      return (
                        <h3
                          className={isGeneratedNote ? getSectionHeadingClass(text).replace("text-2xl", "text-xl") : "text-xl font-semibold mt-6 mb-3"}
                          {...props}
                        >
                          {children}
                        </h3>
                      );
                    },
                    p: ({ children, ...props }) => {
                      const text = toPlainText(children);
                      return (
                        <p className={isGeneratedNote ? getParagraphClass(text) : "mb-4 sm:mb-5 [overflow-wrap:anywhere]"} {...props}>
                          {children}
                        </p>
                      );
                    },
                    ul: ({ children, ...props }) => <ul className="list-disc pl-5 sm:pl-8 mb-4 sm:mb-5 space-y-2" {...props}>{children}</ul>,
                    ol: ({ children, ...props }) => <ol className="list-decimal pl-5 sm:pl-8 mb-4 sm:mb-5 space-y-2" {...props}>{children}</ol>,
                    li: ({ children, ...props }) => <li className="leading-relaxed" {...props}>{children}</li>,
                    strong: ({ children, ...props }) => (
                      <strong className="font-bold text-amber-700 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md" {...props}>{children}</strong>
                    ),
                    em: ({ children, ...props }) => (
                      <em className="italic text-purple-700 dark:text-purple-300 font-semibold" {...props}>{children}</em>
                    ),
                    table: ({ children, ...props }) => (
                      <div className="overflow-x-auto my-5">
                        <table className="min-w-full border-collapse border border-border" {...props}>{children}</table>
                      </div>
                    ),
                    th: ({ children, ...props }) => <th className="border border-border px-3 py-2 bg-muted text-left font-bold" {...props}>{children}</th>,
                    td: ({ children, ...props }) => <td className="border border-border px-3 py-2" {...props}>{children}</td>,
                    blockquote: ({ children, ...props }) => (
                      <blockquote className="border-l-4 border-amber-400 pl-3 sm:pl-4 italic text-amber-900 dark:text-amber-100 my-4 bg-amber-50 dark:bg-amber-900/20 py-3 rounded-r-lg" {...props}>
                        {children}
                      </blockquote>
                    ),
                    code: ({ inline, className, children, ...props }: any) =>
                      inline ? (
                        <code className="bg-slate-200 text-slate-900 px-2 py-1 rounded text-sm font-mono border border-slate-300" {...props}>{children}</code>
                      ) : (
                        <pre className="bg-[#0f172a] text-white rounded-xl px-5 py-4 text-sm overflow-x-auto border-2 border-cyan-500 shadow-lg my-4">
                          <code className={className} {...props}>{children}</code>
                        </pre>
                      ),
                  }}
                >
                  {note.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        </Card>

        {/* Source Link */}
        {note.sourceLink && (
          <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-secondary rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Source:</p>
            <a
              href={note.sourceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all"
            >
              {note.sourceLink}
            </a>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{note.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
