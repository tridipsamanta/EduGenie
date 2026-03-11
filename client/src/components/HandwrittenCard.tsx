import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Download, Loader2, Pencil, Trash2 } from "lucide-react";

type HandwrittenCardItem = {
  _id: string;
  topic: string;
  content: string;
  summary?: string;
  handwritingStyle: "Neat Student" | "Fast Notes" | "Exam Revision Style";
  createdAt: string;
};

type Props = {
  item: HandwrittenCardItem;
  onOpen: (item: HandwrittenCardItem) => void;
  onEdit: (item: HandwrittenCardItem) => void;
  onDelete: (id: string) => void;
  onDownloadPDF: (item: HandwrittenCardItem) => void;
  downloadingId?: string | null;
  deleting?: boolean;
};

export function HandwrittenCard({ item, onOpen, onEdit, onDelete, onDownloadPDF, downloadingId, deleting }: Props) {
  const summary = (item.summary || item.content || "").replace(/#|_\*|\*|`/g, "").slice(0, 150);

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full cursor-pointer border-2 hover:border-violet-300 rounded-2xl"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item);
        }
      }}
    >
      <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-500"></div>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-lg line-clamp-2 flex-1">{item.topic}</h3>
          <Badge className="bg-purple-100 text-purple-700">✍ Handwritten</Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{summary}...</p>
      </CardContent>

      <CardFooter className="pt-3 gap-2 border-t">
        <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={(event) => event.preventDefault()}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onEdit(item);
          }}
        >
          <Pencil className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDownloadPDF(item);
          }}
          disabled={downloadingId === item._id}
        >
          {downloadingId === item._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
          {downloadingId !== item._id && "PDF"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:text-red-700 ml-auto"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(item._id);
          }}
          disabled={deleting}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </CardFooter>
    </Card>
  );
}
