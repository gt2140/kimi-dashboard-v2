import { useMemo, useState } from "react";
import {
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLocalVaultStore, type LocalVaultFile } from "@/hooks/useLocalVaultStore";

function createId() {
  return String(Date.now() + Math.floor(Math.random() * 1000));
}

function inferCategory(file: File): LocalVaultFile["category"] {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "bloodwork";
  if (ext === "csv") return "wearables";
  if (ext === "json") return "genetics";
  if (["png", "jpg", "jpeg", "webp"].includes(ext || "")) {
    return "body-composition";
  }
  if (["md", "txt"].includes(ext || "")) {
    return "notes";
  }
  return "other";
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv") return <FileSpreadsheet className="h-4 w-4" />;
  if (["png", "jpg", "jpeg", "webp"].includes(ext || "")) {
    return <FileImage className="h-4 w-4" />;
  }
  if (["txt", "md", "json", "pdf"].includes(ext || "")) {
    return <FileText className="h-4 w-4" />;
  }
  return <File className="h-4 w-4" />;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function readPreviewText(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["txt", "md", "json", "csv"].includes(ext || "")) {
    return null;
  }

  const text = await file.text();
  return text.trim().slice(0, 2200) || null;
}

export default function KimiVault() {
  const files = useLocalVaultStore(state => state.files);
  const addFiles = useLocalVaultStore(state => state.addFiles);
  const removeFile = useLocalVaultStore(state => state.removeFile);

  const [search, setSearch] = useState("");
  const [previewFile, setPreviewFile] = useState<LocalVaultFile | null>(null);

  const filteredFiles = useMemo(
    () =>
      files.filter(file =>
        file.filename.toLowerCase().includes(search.toLowerCase()),
      ),
    [files, search],
  );

  async function handleUpload(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    const nextFiles = await Promise.all(
      Array.from(fileList).map(async file => ({
        id: createId(),
        filename: file.name,
        fileType: file.type || file.name.split(".").pop()?.toUpperCase() || "FILE",
        category: inferCategory(file),
        size: file.size,
        uploadedAt: new Date(),
        updatedAt: new Date(),
        status: "ready" as const,
        previewText: await readPreviewText(file),
      })),
    );

    addFiles(nextFiles);
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/35">
            Kimi vault
          </p>
          <h1 className="mt-1 text-[20px] font-medium tracking-tight text-foreground">
            Frontend-only file library
          </h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground/45">
            Esta vista queda lista para UI y navegacion. Los archivos se guardan
            solo en el navegador mientras reconstruimos el backend desde cero.
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/30 bg-card/30 px-4 py-2 text-[12px] text-foreground transition-colors hover:bg-card/45">
          <Upload className="h-4 w-4" />
          Upload files
          <input
            type="file"
            multiple
            className="hidden"
            onChange={event => {
              void handleUpload(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Stat label="Local files" value={files.length} />
        <Stat
          label="Text previews"
          value={files.filter(file => Boolean(file.previewText)).length}
        />
        <Stat label="Storage mode" value="Browser only" />
      </div>

      <div className="relative mt-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/25" />
        <Input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search files..."
          className="h-9 border-border/30 bg-card/30 pl-9 text-[12px]"
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl border border-border/35 bg-card/20">
        {filteredFiles.length === 0 ? (
          <div className="px-5 py-12 text-center text-[12px] text-muted-foreground/45">
            No hay archivos locales todavia.
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {filteredFiles.map(file => (
              <div
                key={file.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted/25 text-muted-foreground/50">
                    {getFileIcon(file.filename)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {file.filename}
                    </p>
                    <p className="text-[11px] text-muted-foreground/40">
                      {file.category} · {formatBytes(file.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full border-border/30 bg-background/30 text-[11px]"
                    onClick={() => setPreviewFile(file)}
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground/45 hover:text-destructive"
                    onClick={() => removeFile(file.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={Boolean(previewFile)} onOpenChange={open => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-3xl border-border/40 bg-background">
          <DialogHeader>
            <DialogTitle>{previewFile?.filename ?? "Preview"}</DialogTitle>
          </DialogHeader>
          <div className="rounded-2xl border border-border/25 bg-card/20 p-4 text-[12px] leading-relaxed text-muted-foreground/65">
            {previewFile?.previewText ??
              "Todavia no hay preview textual para este archivo en modo frontend-only. Cuando reconstruyamos el backend, esta vista se puede conectar a extraccion real."}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/20 px-4 py-3">
      <p className="text-[16px] font-medium text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground/40">{label}</p>
    </div>
  );
}
