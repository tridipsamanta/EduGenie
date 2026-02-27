import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Plus, Trash2, StickyNote, Search, Loader2, Pencil, Download, Clock } from "lucide-react";
import { CreateNoteModal } from "@/components/CreateNoteModal";
import { axiosInstance } from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link, useNavigate } from "react-router-dom";

async function downloadNotePDF(noteTitle: string, content: string) {
  return new Promise((resolve, reject) => {
    try {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.async = true;
      
      script.onload = () => {
        try {
          const html2pdf = (window as any).html2pdf;
          if (!html2pdf) {
            throw new Error("html2pdf library not found on window object");
          }

          const element = document.createElement("div");
          element.style.padding = "40px";
          element.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
          element.style.lineHeight = "1.8";
          element.style.color = "#1f2937";
          element.style.backgroundColor = "#ffffff";
          
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

          const sanitizedFilename = noteTitle.replace(/[<>:"/\\|?*]/g, "_");
          const options = {
            margin: [10, 10, 10, 10],
            filename: `${sanitizedFilename}.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
            pagebreak: { mode: ["avoid-all", "css", "legacy"] },
          };
          
          html2pdf()
            .set(options)
            .from(element)
            .save()
            .then(() => {
              resolve(true);
            })
            .catch((error: any) => {
              reject(new Error("Failed to generate PDF content"));
            });
        } catch (error: any) {
          reject(new Error(error.message || "Failed to generate PDF"));
        }
      };

      script.onerror = () => {
        reject(new Error("Failed to load PDF library from CDN. Please check your internet connection."));
      };

      const existingScript = document.querySelector('script[src*="html2pdf"]');
      if (existingScript && existingScript !== script) {
        existingScript.remove();
      }

      document.head.appendChild(script);
    } catch (error: any) {
      reject(error);
    }
  });
}

export default function Notes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const { data: notes, isLoading } = useQuery({
    queryKey: ["/api/notes"],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/notes");
      return res.data.notes || [];
    },
  });

  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ["/api/notes/search", debouncedSearchQuery],
    queryFn: async () => {
      const res = await axiosInstance.post("/api/notes/search", {
        query: debouncedSearchQuery,
        limit: 100,
      });
      return res.data.results || [];
    },
    enabled: debouncedSearchQuery.length > 0,
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await axiosInstance.delete(`/api/notes/${noteId}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Note deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete note",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (note: any) => {
    deleteNoteMutation.mutate(note._id);
  };

  const getSourceBadge = (sourceType: string) => {
    switch (sourceType) {
      case "ai":
        return "🤖 AI";
      case "handwritten":
        return "✍ Handwritten";
      case "youtube":
        return "🎥 YouTube";
      case "url":
        return "🌐 Web";
      default:
        return "✏️ Manual";
    }
  };

  const handleDownloadPDF = async (e: React.MouseEvent, note: any) => {
    e.preventDefault();
    setDownloadingId(note._id);
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
      setDownloadingId(null);
    }
  };

  const showingSearchResults = debouncedSearchQuery.length > 0;
  const displayedNotes = showingSearchResults ? searchResults || [] : notes || [];
  const isGridLoading = showingSearchResults ? isSearchLoading : isLoading;

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <StickyNote className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">My Notes</h1>
            </div>
            <p className="text-muted-foreground text-lg">Create, organize, and study from your notes</p>
          </div>
          <CreateNoteModal />
        </div>

        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes by title..."
            className="pl-10 h-12 text-base border-2 focus:border-purple-500"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="overflow-hidden border-2 hover:border-purple-300 transition-colors">
            <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <StickyNote className="h-4 w-4" />
                Total Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{notes?.length || 0}</div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-2 hover:border-blue-300 transition-colors">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">By Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500"></span>
                    AI
                  </span>
                  <span className="font-bold text-violet-600">{notes?.filter((n: any) => n.sourceType === "ai").length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"></span>
                    Web
                  </span>
                  <span className="font-bold text-blue-600">{notes?.filter((n: any) => n.sourceType === "url").length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-red-500 to-pink-500"></span>
                    YouTube
                  </span>
                  <span className="font-bold text-red-600">{notes?.filter((n: any) => n.sourceType === "youtube").length || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-2 hover:border-green-300 transition-colors">
            <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Last Updated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {notes && notes.length > 0
                  ? new Date(notes[0].updatedAt).toLocaleDateString()
                  : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notes Grid */}
        {isGridLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : displayedNotes.length > 0 ? (
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {displayedNotes.map((note: any) => {
              const sourceColors = {
                ai: "from-violet-500 to-purple-500",
                url: "from-blue-500 to-cyan-500",
                youtube: "from-red-500 to-pink-500",
                handwritten: "from-amber-500 to-orange-500",
                manual: "from-gray-500 to-slate-500"
              };
              const sourceBorderColors = {
                ai: "hover:border-violet-300",
                url: "hover:border-blue-300",
                youtube: "hover:border-red-300",
                handwritten: "hover:border-orange-300",
                manual: "hover:border-gray-300"
              };
              return (
              <Link key={note._id} to={`/notes/${note._id}`}>
                <Card className={`overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full cursor-pointer border-2 ${sourceBorderColors[note.sourceType as keyof typeof sourceBorderColors] || 'hover:border-gray-300'}`}>
                  <div className={`h-1.5 bg-gradient-to-r ${sourceColors[note.sourceType as keyof typeof sourceColors] || 'from-gray-500 to-slate-500'}`}></div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-lg line-clamp-2 flex-1">{note.title}</h3>
                      <div className="flex items-center gap-2">
                        {note.sourceType === "handwritten" && (
                          <Badge variant="secondary">✍ Handwritten</Badge>
                        )}
                        <span className={`text-xs px-2.5 py-1 bg-gradient-to-r ${sourceColors[note.sourceType as keyof typeof sourceColors] || 'from-gray-500 to-slate-500'} text-white rounded-full whitespace-nowrap font-medium`}>
                          {getSourceBadge(note.sourceType)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pb-3">
                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                      {note.content?.substring(0, 150).replace(/#|_|\*|`/g, "")}...
                    </p>
                  </CardContent>

                  <CardFooter className="pt-3 gap-2 border-t">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        // Prevent navigation
                      }}
                    >
                      {new Date(note.createdAt).toLocaleDateString()}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/notes/${note._id}?edit=true`);
                      }}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={(e) => handleDownloadPDF(e, note)}
                      disabled={downloadingId === note._id}
                    >
                      {downloadingId === note._id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3 mr-1" />
                      )}
                      {downloadingId !== note._id && "PDF"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 ml-auto"
                      onClick={(e) => {
                        e.preventDefault();
                        setDeleteTarget(note);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </CardFooter>
                </Card>
              </Link>
            )})}
          
          </div>
        ) : (
          <Card className="border-dashed py-12">
            <CardContent className="text-center">
              <StickyNote className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              {showingSearchResults ? (
                <>
                  <h3 className="text-lg font-semibold mb-1">No matching notes</h3>
                  <p className="text-muted-foreground mb-4">
                    Try a different search keyword.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-1">No notes yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first note or generate one with AI
                  </p>
                  <CreateNoteModal />
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Note?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{deleteTarget?.title}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => handleDelete(deleteTarget)}
              >
                Delete
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
