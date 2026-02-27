import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Sparkles, FileText, Globe, Youtube, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { axiosInstance } from "@/lib/axios";
import { useQueryClient } from "@tanstack/react-query";

export function CreateNoteModal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("manual");

  // Manual note state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI generation state
  const [topic, setTopic] = useState("");
  const [pageCount, setPageCount] = useState(5);
  const [language, setLanguage] = useState("english");
  const [isGenerating, setIsGenerating] = useState(false);

  // YouTube state
  const [transcript, setTranscript] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [isProcessingYoutube, setIsProcessingYoutube] = useState(false);

  // URL state
  const [url, setUrl] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setTopic("");
    setTranscript("");
    setVideoUrl("");
    setYoutubeTitle("");
    setUrl("");
    setUrlTitle("");
    setPageCount(5);
    setLanguage("english");
    setOpen(false);
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Error",
        description: "Title and content are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await axiosInstance.post("/api/notes", {
        title,
        content,
        sourceType: "manual",
      });
      toast({ title: "Success", description: "Note created" });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create note",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateWithAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast({
        title: "Error",
        description: "Please enter a topic",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      await axiosInstance.post("/api/notes/ai-generate", {
        topic,
        title: topic,
        pageCount,
        language,
      });
      toast({
        title: "Success",
        description: "Note generated with AI",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.response?.data?.error || "Failed to generate note",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleYouTubeConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcript.trim()) {
      toast({
        title: "Error",
        description: "Please paste the transcript",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingYoutube(true);
    try {
      await axiosInstance.post("/api/notes/youtube-convert", {
        transcript,
        videoUrl,
        title: youtubeTitle || "YouTube Lecture Notes",
        pageCount,
      });
      toast({
        title: "Success",
        description: "YouTube transcript converted to notes",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.response?.data?.error || "Failed to process transcript",
        variant: "destructive",
      });
    } finally {
      setIsProcessingYoutube(false);
    }
  };

  const handleUrlConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingUrl(true);
    try {
      await axiosInstance.post("/api/notes/url-convert", {
        url,
        title: urlTitle,
        pageCount,
      });
      toast({
        title: "Success",
        description: "Article converted to notes",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to process URL",
        variant: "destructive",
      });
    } finally {
      setIsProcessingUrl(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-300">
          <Plus className="h-4 w-4 mr-2" />
          New Note
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Wand2 className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Create or Generate Notes
            </DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">Choose your preferred method to create study notes</p>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full mt-4"
        >
          <TabsList className="grid w-full grid-cols-4 h-12 bg-muted/50">
            <TabsTrigger value="manual" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-500 data-[state=active]:to-slate-500 data-[state=active]:text-white transition-all">
              <FileText className="h-4 w-4 mr-2" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white transition-all">
              <Sparkles className="h-4 w-4 mr-2" />
              AI
            </TabsTrigger>
            <TabsTrigger value="youtube" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-pink-500 data-[state=active]:text-white transition-all">
              <Youtube className="h-4 w-4 mr-2" />
              YouTube
            </TabsTrigger>
            <TabsTrigger value="url" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white transition-all">
              <Globe className="h-4 w-4 mr-2" />
              Website
            </TabsTrigger>
          </TabsList>

          {/* Manual Tab */}
          <TabsContent value="manual" className="space-y-4 mt-6">
            <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900 dark:to-slate-900 rounded-lg border-l-4 border-gray-500">
              <p className="text-sm text-muted-foreground">✍️ Create your own custom study notes with markdown support</p>
            </div>
            <form onSubmit={handleCreateManual} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Note Title</label>
                <Input
                  placeholder="e.g., Biology Chapter 5 Summary"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11 border-2 focus:border-gray-400"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Content (Markdown Supported)</label>
                <Textarea
                  placeholder="Write your note in markdown...\n\n# Heading\n## Subheading\n- Bullet point\n**Bold text**"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[300px] border-2 focus:border-gray-400"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-gray-600 to-slate-600 hover:from-gray-700 hover:to-slate-700 text-white shadow-md transition-all"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Note
              </Button>
            </form>
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai" className="space-y-4 mt-6">
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-lg border-l-4 border-purple-500">
              <p className="text-sm text-muted-foreground">✨ Enter a topic and we'll generate structured exam notes using AI</p>
            </div>
            <form onSubmit={handleGenerateWithAI} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  Topic
                </label>
                <Input
                  placeholder="e.g., Photosynthesis in Plants, Newton's Laws of Motion"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="h-11 border-2 focus:border-purple-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pages (1-10)</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={pageCount}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isNaN(value)) return;
                      setPageCount(Math.max(1, Math.min(10, value)));
                    }}
                    className="h-11 border-2 focus:border-purple-400"
                  />
                  <p className="text-xs text-muted-foreground">More pages = detailed content</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="h-11 border-2 focus:border-purple-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">🇬🇧 English</SelectItem>
                      <SelectItem value="hindi">🇮🇳 हिंदी</SelectItem>
                      <SelectItem value="bengali">🇧🇩 বাংলা</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Select preferred language</p>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md transition-all"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate with AI
              </Button>
            </form>
          </TabsContent>

          {/* YouTube Tab */}
          <TabsContent value="youtube" className="space-y-4 mt-6">
            <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950 dark:to-pink-950 rounded-lg border-l-4 border-red-500">
              <p className="text-sm text-muted-foreground">🎥 Paste the YouTube transcript to convert it into study notes</p>
            </div>
            <form onSubmit={handleYouTubeConvert} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Youtube className="h-4 w-4 text-red-500" />
                  Video URL (optional)
                </label>
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  type="url"
                  className="h-11 border-2 focus:border-red-400"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Note Title (optional)</label>
                <Input
                  placeholder="e.g., Physics Lecture - Chapter 3"
                  value={youtubeTitle}
                  onChange={(e) => setYoutubeTitle(e.target.value)}
                  className="h-11 border-2 focus:border-red-400"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pages (1-10)</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={pageCount}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isNaN(value)) return;
                    setPageCount(Math.max(1, Math.min(10, value)));
                  }}
                  className="h-11 border-2 focus:border-red-400"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Transcript</label>
                <Textarea
                  placeholder="Paste the full transcript here...\n\nYou can get transcripts from YouTube by:\n1. Click '...' below video\n2. Select 'Show transcript'\n3. Copy and paste here"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="min-h-[250px] border-2 focus:border-red-400"
                />
                <div className={`text-xs ${transcript.length > 15000 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                  Characters: {transcript.length.toLocaleString()} / 15,000 {transcript.length > 15000 ? '(Exceeds limit!)' : ''}
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-md transition-all"
                disabled={isProcessingYoutube || transcript.length > 15000}
              >
                {isProcessingYoutube ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Youtube className="h-4 w-4 mr-2" />
                )}
                Convert Transcript
              </Button>
            </form>
          </TabsContent>

          {/* URL Tab */}
          <TabsContent value="url" className="space-y-4 mt-6">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm text-muted-foreground">🌐 Paste a website URL to fetch and convert it to study notes</p>
            </div>
            <form onSubmit={handleUrlConvert} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  Website URL
                </label>
                <Input
                  placeholder="https://example.com/article"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  type="url"
                  className="h-11 border-2 focus:border-blue-400"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Title (optional)</label>
                <Input
                  placeholder="e.g., World War 2 Overview"
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  className="h-11 border-2 focus:border-blue-400"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pages (1-10)</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={pageCount}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isNaN(value)) return;
                    setPageCount(Math.max(1, Math.min(10, value)));
                  }}
                  className="h-11 border-2 focus:border-blue-400"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md transition-all"
                disabled={isProcessingUrl}
              >
                {isProcessingUrl ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Globe className="h-4 w-4 mr-2" />
                )}
                Convert Article
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
