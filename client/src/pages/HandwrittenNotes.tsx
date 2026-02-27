import { useState } from "react";
import { Layout } from "@/components/Layout";
import { HandwrittenEditor } from "@/components/HandwrittenEditor";
import { HandwrittenCard } from "@/components/HandwrittenCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Loader2, Sparkles, PencilLine, Save, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

type HandwritingStyle = "Neat Student" | "Fast Notes" | "Exam Revision Style";

type GeneratorForm = {
  topic: string;
  style: HandwritingStyle;
};

type HandwrittenItem = {
  _id: string;
  topic: string;
  content: string;
  summary?: string;
  handwritingStyle: HandwritingStyle;
  createdAt: string;
};

const defaultForm: GeneratorForm = {
  topic: "",
  style: "Neat Student",
};

async function downloadNotePDF(noteTitle: string, content: string) {
  return new Promise<void>((resolve, reject) => {
    try {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.async = true;

      script.onload = () => {
        try {
          const html2pdf = (window as any).html2pdf;
          if (!html2pdf) throw new Error("html2pdf unavailable");

          const element = document.createElement("div");
          element.style.padding = "36px";
          element.style.fontFamily = "'Patrick Hand', cursive";
          element.style.whiteSpace = "pre-wrap";
          element.style.lineHeight = "1.9";
          element.innerText = content;

          html2pdf()
            .set({
              margin: [8, 8, 8, 8],
              filename: `${noteTitle.replace(/[^a-z0-9]/gi, "_")}.pdf`,
              image: { type: "jpeg", quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
            })
            .from(element)
            .save()
            .then(() => resolve())
            .catch((error: unknown) => reject(error));
        } catch (error) {
          reject(error);
        }
      };

      script.onerror = () => reject(new Error("Could not load PDF library"));
      document.head.appendChild(script);
    } catch (error) {
      reject(error);
    }
  });
}

export default function HandwrittenNotes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<GeneratorForm>(defaultForm);
  const [generatedMarkdown, setGeneratedMarkdown] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<HandwritingStyle>("Neat Student");
  const [currentTopic, setCurrentTopic] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: handwrittenItems = [], isLoading: handwrittenLoading } = useQuery({
    queryKey: ["/api/ai/handwritten-notes"],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/ai/handwritten-notes");
      return (res.data.items || []) as HandwrittenItem[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!generatedMarkdown.trim()) {
        throw new Error("No generated markdown to save");
      }

      const topicToSave = currentTopic || form.topic;
      if (!topicToSave.trim()) {
        throw new Error("Topic is required");
      }

      const res = await axiosInstance.post("/api/ai/handwritten-notes", {
        topic: topicToSave,
        handwritingStyle: selectedStyle,
        markdownContent: generatedMarkdown,
      });
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/ai/handwritten-notes"] });
      toast({ title: "Saved", description: "Saved to Handwritten Notes." });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error?.response?.data?.error || error?.message || "Could not save handwritten note.",
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.post("/api/ai/generate-handwritten-text", form);
      return res.data as { markdown: string; style: HandwritingStyle; topic: string };
    },
    onSuccess: async (data) => {
      setGeneratedMarkdown(data.markdown || "");
      setSelectedStyle(data.style || form.style);
      setCurrentTopic(data.topic || form.topic);
      setOpen(false);
      toast({
        title: "Handwritten notes generated",
        description: "Rendered in notebook style. Click Save to Notes to store in Handwritten Notes.",
      });
    },
    onError: (error: any) => {
      const apiError = error?.response?.data?.error;
      const apiAction = error?.response?.data?.action;
      toast({
        title: "Generation failed",
        description: apiAction ? `${apiError} ${apiAction}` : apiError || "Could not generate handwritten text.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosInstance.delete("/api/ai/handwritten-notes", { params: { id } });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/ai/handwritten-notes"] });
      toast({ title: "Deleted", description: "Handwritten note removed." });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error?.response?.data?.error || "Could not delete handwritten note.",
        variant: "destructive",
      });
    },
  });

  const onDownloadPDF = async (item: HandwrittenItem) => {
    try {
      setDownloadingId(item._id);
      await downloadNotePDF(item.topic, item.content || "");
      toast({ title: "PDF downloaded", description: `Downloaded ${item.topic}.pdf` });
    } catch {
      toast({ title: "PDF failed", description: "Could not export note PDF.", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const canGenerate = form.topic.trim().length > 0;

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 px-2"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to My Notes
            </Button>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <PencilLine className="h-7 w-7 text-primary" />
               Handwritten Notes
            </h1>
            <p className="text-muted-foreground mt-1">Generate AI markdown, render as notebook handwriting, edit, then export PNG/PDF.</p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full gap-2">
                <Sparkles className="h-4 w-4" />
                Generate Handwritten Note
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl rounded-2xl">
              <DialogHeader>
                <DialogTitle>Generate Handwritten Note</DialogTitle>
                <DialogDescription>Gemini returns markdown, then editor renders it with notebook handwriting styles.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <p className="text-sm mb-2 text-muted-foreground">Topic</p>
                  <Input
                    value={form.topic}
                    onChange={(event) => setForm((prev) => ({ ...prev, topic: event.target.value }))}
                    placeholder="SQL joins and normalization"
                  />
                </div>

                <div>
                  <p className="text-sm mb-2 text-muted-foreground">Handwriting Style</p>
                  <Select value={form.style} onValueChange={(value) => setForm((prev) => ({ ...prev, style: value as HandwritingStyle }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Neat Student">Neat Student</SelectItem>
                      <SelectItem value="Fast Notes">Fast Notes</SelectItem>
                      <SelectItem value="Exam Revision Style">Exam Revision Style</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {generateMutation.isPending && (
                <div className="rounded-xl border bg-secondary/30 p-4 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-sm text-muted-foreground">Generating markdown with Gemini...</p>
                </div>
              )}

              <DialogFooter>
                <Button onClick={() => generateMutation.mutate()} disabled={!canGenerate || generateMutation.isPending}>
                  {generateMutation.isPending ? "Generating..." : "Generate"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">Notebook Editor</CardTitle>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!generatedMarkdown.trim() || saveMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? "Saving..." : "Save to Notes"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!generatedMarkdown ? (
              <div className="h-[360px] rounded-xl border border-dashed flex items-center justify-center text-muted-foreground">
                Generate handwritten text to start editing and exporting.
              </div>
            ) : (
              <HandwrittenEditor markdown={generatedMarkdown} stylePreset={selectedStyle} />
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Saved Handwritten Notes</h2>
          {handwrittenLoading ? (
            <div className="rounded-2xl border border-border/60 p-8 text-sm text-muted-foreground">Loading handwritten notes...</div>
          ) : handwrittenItems.length === 0 ? (
            <div className="rounded-2xl border border-border/60 p-8 text-sm text-muted-foreground">No handwritten notes saved yet.</div>
          ) : (
            <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {handwrittenItems.map((item) => (
                <HandwrittenCard
                  key={item._id}
                  item={item}
                  downloadingId={downloadingId}
                  deleting={deleteMutation.isPending}
                  onOpen={(selected) => {
                    setGeneratedMarkdown(selected.content || "");
                    setSelectedStyle(selected.handwritingStyle || "Neat Student");
                    setCurrentTopic(selected.topic || "");
                    toast({ title: "Opened", description: "Saved handwritten note opened in notebook editor." });
                  }}
                  onEdit={(selected) => {
                    setGeneratedMarkdown(selected.content || "");
                    setSelectedStyle(selected.handwritingStyle || "Neat Student");
                    setCurrentTopic(selected.topic || "");
                    toast({ title: "Loaded", description: "Loaded into notebook editor." });
                  }}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onDownloadPDF={onDownloadPDF}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
