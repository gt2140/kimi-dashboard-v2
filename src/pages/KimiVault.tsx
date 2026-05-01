import { useCallback, useMemo, useState } from "react";
import {
  CheckCircle2,
  Database,
  File,
  FileImage,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Loader2,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { KimiHeader } from "@/components/kimi/KimiHeader";
import { KimiLaunchpad } from "@/components/kimi/KimiLaunchpad";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatRuntimeError } from "@/lib/app-errors";
import { cn } from "@/lib/utils";
import { ensureBackendSession, trpc } from "@/providers/trpc";
import { buildAuthenticatedHeaders } from "@/lib/request-auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

type KimiVaultFile = {
  id: number;
  filename: string;
  fileType: string;
  category: string;
  size: number;
  status: "ready" | "processing" | "failed";
  uploadedAt: string | Date;
  updatedAt: string | Date;
  extractionStatus?: "pending" | "ready" | "failed" | null;
  remoteFileId?: string | null;
  extractedText?: string | null;
  extractedAt?: string | Date | null;
  extractionError?: string | null;
  contentHash?: string | null;
};

const categoryOptions = [
  "bloodwork",
  "genetics",
  "wearables",
  "body-composition",
  "notes",
  "other",
] as const;

function inferCategory(file: File): (typeof categoryOptions)[number] {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "bloodwork";
  if (ext === "csv") return "wearables";
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
  if (ext === "csv") {
    return <FileSpreadsheet className="h-4 w-4" />;
  }
  if (["png", "jpg", "jpeg", "webp"].includes(ext || "")) {
    return <FileImage className="h-4 w-4" />;
  }
  if (ext === "pdf" || ext === "txt" || ext === "md") {
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

function normalizePreview(text: string | null | undefined) {
  if (!text) {
    return "Kimi todavía no devolvió texto extraído para este archivo.";
  }

  return text.trim().slice(0, 2200) || "Kimi devolvió un payload vacío.";
}

export default function KimiVault() {
  const utils = trpc.useUtils();
  const filesQuery = trpc.vault.list.useQuery();
  const deleteMutation = trpc.vault.delete.useMutation();
  const [search, setSearch] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<KimiVaultFile | null>(null);

  const files = (filesQuery.data ?? []) as KimiVaultFile[];
  const filteredFiles = useMemo(
    () =>
      files.filter(file =>
        file.filename.toLowerCase().includes(search.toLowerCase()),
      ),
    [files, search],
  );
  const readyFiles = files.filter(file => file.extractionStatus === "ready").length;
  const error = uploadError || filesQuery.error || deleteMutation.error || null;

  const refreshVault = useCallback(async () => {
    await utils.vault.list.invalidate();
  }, [utils.vault.list]);

  async function readAccessToken() {
    if (!isSupabaseConfigured) {
      return null;
    }

    const { data } = await getSupabaseBrowserClient().auth.getSession();
    return data.session?.access_token ?? null;
  }

  const handleUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) {
        return;
      }

      setUploadError(null);
      setIsUploading(true);

      try {
        const synced = await ensureBackendSession();
        if (!synced) {
          throw new Error(
            "Your browser session exists, but the backend session is not ready yet.",
          );
        }

        for (const file of Array.from(fileList)) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("category", inferCategory(file));

          const headers = await buildAuthenticatedHeaders(readAccessToken);
          const response = await fetch("/api/kimi/vault/upload", {
            method: "POST",
            credentials: "include",
            headers,
            body: formData,
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(
              payload?.error || `Kimi vault upload failed with HTTP ${response.status}.`,
            );
          }
        }

        await refreshVault();
      } catch (uploadIssue) {
        setUploadError(
          uploadIssue instanceof Error
            ? uploadIssue.message
            : "Kimi vault upload failed unexpectedly.",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [refreshVault],
  );

  async function handleDelete(fileId: number) {
    await deleteMutation.mutateAsync({ id: fileId });
    if (previewFile?.id === fileId) {
      setPreviewFile(null);
    }
    await refreshVault();
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 p-4 sm:p-6 lg:p-8">
      <KimiHeader
        title="Vault con extracción real de Kimi"
        description="Cada archivo se sube a Files API de Kimi para extracción, se persiste el snapshot textual en Aura y queda listo para retrieval contextual en chat."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-3xl border border-border/35 bg-card/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-medium text-foreground">
                File ingestion
              </h2>
              <p className="mt-1 text-[12px] text-muted-foreground/40">
                {files.length} files registrados, {readyFiles} listos para retrieval.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100/85">
              <Upload className="h-3.5 w-3.5" />
              {isUploading ? "Uploading..." : "Upload to Kimi"}
              <input
                type="file"
                multiple
                accept=".pdf,.csv,.png,.jpg,.jpeg,.webp,.txt,.md"
                className="hidden"
                onChange={event => {
                  void handleUpload(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          <div className="relative mt-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/25" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search extracted files..."
              className="h-9 border-border/30 bg-card/30 pl-9 text-[12px]"
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border/25">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_80px] gap-3 border-b border-border/20 bg-background/40 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/35">
              <span>File</span>
              <span>Extraction</span>
              <span>Remote</span>
              <span />
            </div>
            <div className="divide-y divide-border/15">
              {filteredFiles.map(file => (
                <div
                  key={file.id}
                  className="grid grid-cols-[minmax(0,1fr)_120px_120px_80px] gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/30">
                        {getFileIcon(file.filename)}
                      </span>
                      <p className="truncate text-[12px] text-foreground">
                        {file.filename}
                      </p>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground/30">
                      {file.category} | {formatBytes(file.size)}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <StatusPill status={file.extractionStatus ?? "pending"} />
                  </div>
                  <div className="flex items-center text-[10px] text-muted-foreground/35">
                    {file.remoteFileId ? "linked" : "local only"}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/35 hover:text-foreground"
                      onClick={() => setPreviewFile(file)}
                    >
                      <FileSearch className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/35 hover:text-destructive/70"
                      onClick={() => {
                        void handleDelete(file.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredFiles.length === 0 && (
                <div className="px-4 py-10 text-center text-[12px] text-muted-foreground/35">
                  No files found.
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-3 text-[12px] text-destructive/80">
              {typeof error === "string"
                ? error
                : formatRuntimeError(error, "Kimi vault")}
            </p>
          )}
        </section>

        <aside className="space-y-4">
          <KimiLaunchpad variant="vault" />
          <SideStat
            title="Kimi extraction flow"
            lines={[
              "1. Upload file to Files API",
              "2. Pull extracted text snapshot",
              "3. Chunk locally for retrieval",
              "4. Inject selected chunks into chat",
            ]}
          />
          <SideStat
            title="Current limits"
            lines={[
              "Up to 1000 files per org",
              "100 MB per file",
              "10 GB aggregate storage",
              "Aura persists extraction locally",
            ]}
          />
        </aside>
      </div>

      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[14px]">
              <Database className="h-4 w-4" />
              {previewFile?.filename}
            </DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewMetric
                  label="Extraction status"
                  value={previewFile.extractionStatus ?? "pending"}
                />
                <PreviewMetric
                  label="Remote file id"
                  value={previewFile.remoteFileId ?? "Not linked"}
                />
                <PreviewMetric
                  label="Content hash"
                  value={previewFile.contentHash ?? "Pending"}
                />
                <PreviewMetric
                  label="Extracted at"
                  value={
                    previewFile.extractedAt
                      ? new Date(previewFile.extractedAt).toLocaleString()
                      : "Pending"
                  }
                />
              </div>

              {previewFile.extractionError && (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-[12px] text-destructive/90">
                  {previewFile.extractionError}
                </div>
              )}

              <div className="rounded-2xl border border-border/25 bg-background/40 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground/35">
                  Extracted text snapshot
                </p>
                <pre className="mt-3 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-foreground/85">
                  {normalizePreview(previewFile.extractedText)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: "pending" | "ready" | "failed";
}) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200/80">
        <CheckCircle2 className="h-3 w-3" />
        ready
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/25 bg-destructive/10 px-2 py-1 text-[10px] text-destructive/85">
        <XCircle className="h-3 w-3" />
        failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200/80">
      <Loader2 className="h-3 w-3 animate-spin" />
      pending
    </span>
  );
}

function SideStat({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-3xl border border-border/35 bg-card/20 p-4">
      <h3 className="text-[13px] font-medium text-foreground">{title}</h3>
      <div className="mt-3 space-y-2">
        {lines.map(line => (
          <div
            key={line}
            className="rounded-2xl border border-border/20 bg-background/30 px-3 py-2 text-[11px] text-muted-foreground/50"
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/25 bg-background/40 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/35">
        {label}
      </p>
      <p className={cn("mt-2 text-[12px] text-foreground/85", value.length > 40 && "break-all")}>
        {value}
      </p>
    </div>
  );
}
