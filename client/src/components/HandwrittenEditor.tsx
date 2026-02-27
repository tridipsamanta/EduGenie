import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Type, Bold, Underline } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import "./handwritten-editor.css";

declare global {
  interface Window {
    html2canvas?: any;
    jspdf?: { jsPDF: any };
  }
}

type HandwritingStyle = "Neat Student" | "Fast Notes" | "Exam Revision Style";
type InkColor = "Blue" | "Black" | "Dark Green";

type Props = {
  markdown: string;
  stylePreset: HandwritingStyle;
};

const styleToFontClass: Record<HandwritingStyle, string> = {
  "Neat Student": "font-patrick",
  "Fast Notes": "font-caveat",
  "Exam Revision Style": "font-indie",
};

const styleToRotation: Record<HandwritingStyle, string> = {
  "Neat Student": "rotate-[0.5deg]",
  "Fast Notes": "-rotate-[0.3deg]",
  "Exam Revision Style": "rotate-[0.2deg]",
};

const inkColorClass: Record<InkColor, string> = {
  Blue: "text-blue-800",
  Black: "text-zinc-900",
  "Dark Green": "text-emerald-900",
};

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inlineMarkdown(text: string) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function markdownToHtml(markdown: string) {
  const lines = String(markdown || "").split(/\r?\n/);
  const html: string[] = [];
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push('<div class="h-3"></div>');
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      const level = Math.min(6, Math.max(1, match?.[1]?.length || 1));
      const title = inlineMarkdown(match?.[2] || "");
      if (level === 1) {
        html.push(`<h1>${title}</h1>`);
      } else if (level === 2) {
        html.push(`<h2>${title}</h2>`);
      } else {
        html.push(`<h3>${title}</h3>`);
      }
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      const listText = line.replace(/^[-*+]\s+/, "");
      html.push(`<li>${inlineMarkdown(listText)}</li>`);
      continue;
    }

    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  if (inList) {
    html.push("</ul>");
  }

  return html.join("\n");
}

async function loadScript(src: string) {
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureExportLibs() {
  if (!window.html2canvas) {
    await loadScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
  }

  if (!window.jspdf?.jsPDF) {
    await loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
  }
}

function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function HandwrittenEditor({ markdown, stylePreset }: Props) {
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const [inkColor, setInkColor] = useState<InkColor>("Blue");
  const [html, setHtml] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setHtml(markdownToHtml(markdown));
  }, [markdown]);

  const pageCount = useMemo(() => {
    if (!editorRef.current) return 1;
    const pageHeight = 1000;
    return Math.max(1, Math.ceil(editorRef.current.scrollHeight / pageHeight));
  }, [html]);

  const applyFormat = (command: "bold" | "underline") => {
    editorRef.current?.focus();
    document.execCommand(command);
  };

  const onDownloadPNG = async () => {
    if (!editorRef.current) return;

    try {
      setIsExporting(true);
      await ensureExportLibs();

      const html2canvas = window.html2canvas;
      const pageHeight = 1000;
      const totalHeight = editorRef.current.scrollHeight;
      const totalPages = Math.max(1, Math.ceil(totalHeight / pageHeight));

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
        const cropHeight = Math.min(pageHeight, totalHeight - pageIndex * pageHeight);
        const canvas = await html2canvas(editorRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#fffef8",
          y: pageIndex * pageHeight,
          height: cropHeight,
          width: editorRef.current.clientWidth,
          windowWidth: editorRef.current.scrollWidth,
          windowHeight: editorRef.current.scrollHeight,
        });

        const data = canvas.toDataURL("image/png");
        const suffix = totalPages > 1 ? `-page-${pageIndex + 1}` : "";
        downloadUrl(data, `handwritten-note${suffix}.png`);
      }
    } catch {
      toast({ title: "PNG export failed", description: "Could not export the handwritten note as PNG.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const onDownloadPDF = async () => {
    if (!editorRef.current) return;

    try {
      setIsExporting(true);
      await ensureExportLibs();

      const html2canvas = window.html2canvas;
      const jsPDF = window.jspdf?.jsPDF;
      if (!jsPDF) throw new Error("jsPDF not loaded");

      const pageHeight = 1000;
      const totalHeight = editorRef.current.scrollHeight;
      const totalPages = Math.max(1, Math.ceil(totalHeight / pageHeight));

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = 210;
      const pdfHeight = 297;

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
        const cropHeight = Math.min(pageHeight, totalHeight - pageIndex * pageHeight);
        const canvas = await html2canvas(editorRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#fffef8",
          y: pageIndex * pageHeight,
          height: cropHeight,
          width: editorRef.current.clientWidth,
          windowWidth: editorRef.current.scrollWidth,
          windowHeight: editorRef.current.scrollHeight,
        });

        const data = canvas.toDataURL("image/png");

        if (pageIndex > 0) {
          pdf.addPage();
        }

        pdf.addImage(data, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
      }

      pdf.save("handwritten-note.pdf");
    } catch {
      toast({ title: "PDF export failed", description: "Could not export the handwritten note as PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => applyFormat("bold")}>
          <Bold className="h-4 w-4 mr-1" />
          Bold
        </Button>
        <Button size="sm" variant="outline" onClick={() => applyFormat("underline")}>
          <Underline className="h-4 w-4 mr-1" />
          Underline
        </Button>

        <div className="flex items-center gap-2 ml-2">
          <Type className="h-4 w-4 text-muted-foreground" />
          <Select value={inkColor} onValueChange={(value) => setInkColor(value as InkColor)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Ink color" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Blue">Blue Ink</SelectItem>
              <SelectItem value="Black">Black Ink</SelectItem>
              <SelectItem value="Dark Green">Dark Green Ink</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onDownloadPNG} disabled={isExporting}>
            <Download className="h-4 w-4 mr-1" />
            Download PNG
          </Button>
          <Button size="sm" variant="outline" onClick={onDownloadPDF} disabled={isExporting}>
            <FileText className="h-4 w-4 mr-1" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 overflow-auto">
        <div className="text-xs text-muted-foreground mb-3">Notebook pages: {pageCount}</div>
        <div
          ref={editorRef}
          className={`notebook-editor ${styleToFontClass[stylePreset]} ${styleToRotation[stylePreset]} ${inkColorClass[inkColor]}`}
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => setHtml((event.target as HTMLDivElement).innerHTML)}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
