import { useRef, useState } from "react";
import {
  Download,
  FileImage,
  FileText,
  Files,
  Pencil,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DocumentRecord } from "@/lib/assessment/use-assessment";

export const documentCategories = [
  "Ultrasound Images",
  "Hysteroscopy Images",
  "Embryoscopy Images",
  "Embryo Photos",
  "Blastocyst Images",
  "Semen Reports",
  "Laboratory Reports",
  "Hormonal Profiles",
  "Operative Reports",
  "Previous IVF Reports",
  "PDF Documents",
] as const;

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function DocumentsStep({
  documents,
  onAdd,
  onRemove,
  onRename,
}: {
  documents: DocumentRecord[];
  onAdd: (files: File[], category: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [category, setCategory] = useState<string>(documentCategories[0]);
  const [filter, setFilter] = useState<string>("All");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible =
    filter === "All" ? documents : documents.filter((d) => d.category === filter);

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onAdd(Array.from(list), category);
  };

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "animate-rise rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center shadow-soft transition-colors",
          dragging && "border-primary bg-primary-soft/60",
        )}
      >
        <UploadCloud className="mx-auto size-7 text-primary" />
        <p className="mt-3 text-sm font-semibold">Drop files here or browse</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Images and PDF documents. Files stay on this device in the current session.
        </p>

        <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
          {documentCategories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                category === c
                  ? "border-primary/40 bg-primary-soft text-primary shadow-soft"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button className="mt-5 rounded-xl" onClick={() => inputRef.current?.click()}>
          <UploadCloud className="size-4" /> Upload to “{category}”
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-lg">
          <Files className="mr-1 size-3" /> {documents.length} file
          {documents.length === 1 ? "" : "s"}
        </Badge>
        {["All", ...documentCategories].map((c) => {
          const count = c === "All" ? documents.length : documents.filter((d) => d.category === c).length;
          if (c !== "All" && count === 0) return null;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                filter === c ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {c} ({count})
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center">
          <div>
            <p className="text-sm font-medium">No documents in this view</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload imaging, laboratory or operative documentation above.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((doc) => {
            const isImage = doc.mime.startsWith("image/") && doc.url;
            return (
              <article
                key={doc.id}
                className="animate-rise overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft"
              >
                <div className="grid h-36 place-items-center overflow-hidden bg-muted/50">
                  {isImage ? (
                    <img
                      src={doc.url}
                      alt={doc.name}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : doc.mime.startsWith("image/") ? (
                    <FileImage className="size-8 text-muted-foreground" />
                  ) : (
                    <FileText className="size-8 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-3 p-4">
                  {editing === doc.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (draftName.trim()) onRename(doc.id, draftName.trim());
                        setEditing(null);
                      }}
                      className="flex gap-2"
                    >
                      <Input
                        autoFocus
                        value={draftName}
                        aria-label="Document name"
                        onChange={(e) => setDraftName(e.target.value)}
                        className="h-9 rounded-lg"
                      />
                      <Button type="submit" size="sm" className="rounded-lg">
                        Save
                      </Button>
                    </form>
                  ) : (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{doc.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {doc.category} · {formatSize(doc.size)}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => {
                        setEditing(doc.id);
                        setDraftName(doc.name);
                      }}
                    >
                      <Pencil className="size-3.5" /> Rename
                    </Button>
                    <Button
                      asChild={Boolean(doc.url)}
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={!doc.url}
                    >
                      {doc.url ? (
                        <a href={doc.url} download={doc.name}>
                          <Download className="size-3.5" /> Download
                        </a>
                      ) : (
                        <span>
                          <Download className="size-3.5" /> Download
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(doc.id)}
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
