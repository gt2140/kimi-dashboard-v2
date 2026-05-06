import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  File,
  FileImage,
  FileSearch,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
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
  encryptedUrl?: string | null;
};

type DerivedVaultState = "ready" | "processing" | "failed" | "needs-reupload";

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
    return "Kimi todavia no devolvio texto extraido para este archivo.";
  }

  return text.trim().slice(0, 2200) || "Kimi devolvio un payload vacio.";
}

function deriveVaultState(file: KimiVaultFile): DerivedVaultState {
  if (file.status === "failed") {
    return "failed";
  }

  if (file.status === "processing") {
    return "processing";
  }

  if (file.extractionStatus === "failed") {
    return "failed";
  }

  if (file.extractionStatus === "ready" || Boolean(file.extractedText?.trim())) {
    return "ready";
  }

  if (file.remoteFileId) {
    return "processing";
  }

  return "needs-reupload";
}

function describeVaultLinkState(file: KimiVaultFile) {
  if (file.remoteFileId) {
    return "linked";
  }

  if (file.extractionStatus === "ready" && file.encryptedUrl) {
    return "saved local";
  }

  if (file.encryptedUrl) {
    return "saved local";
  }

  return "local only";
}

export default function KimiVault() {
  const utils = trpc.useUtils();
  const filesQuery = trpc.vault.list.useQuery();
  const deleteMutation = trpc.vault.delete.useMutation();
  const [search, setSearch] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<KimiVaultFile | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const files = (filesQuery.data ?? []) as KimiVaultFile[];
  const filteredFiles = useMemo(
    () =>
      files.filter(file =>
        file.filename.toLowerCase().includes(search.toLowerCase()),
      ),
    [files, search],
  );
  const readyFiles = files.filter(file => deriveVaultState(file) === "ready").length;
  const pendingFiles = files.filter(file => deriveVaultState(file) === "processing")
    .length;
  const legacyFiles = files.filter(file => deriveVaultState(file) === "needs-reupload")
    .length;
  const error = uploadError || filesQuery.error || deleteMutation.error || null;

  const refreshVault = useCallback(async () => {
    await utils.vault.list.invalidate();
  }, [utils.vault.list]);

  useEffect(() => {
    if (pendingFiles === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshVault();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [pendingFiles, refreshVault]);

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

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

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      if (!previewFile) {
        setPreviewText(null);
        setPreviewMimeType(null);
        setPreviewError(null);
        setIsPreviewLoading(false);
        if (previewObjectUrl) {
          URL.revokeObjectURL(previewObjectUrl);
          setPreviewObjectUrl(null);
        }
        return;
      }

      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        setPreviewObjectUrl(null);
      }

      setPreviewError(null);
      setPreviewText(null);
      setPreviewMimeType(null);

      if (!previewFile.encryptedUrl) {
        return;
      }

      setIsPreviewLoading(true);

      try {
        const headers = await buildAuthenticatedHeaders(readAccessToken);
        const response = await fetch(`/api/kimi/vault/file/${previewFile.id}`, {
          credentials: "include",
          headers,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            payload?.error || `Vault preview failed with HTTP ${response.status}.`,
          );
        }

        const blob = await response.blob();
        if (!active) {
          return;
        }

        const mimeType = blob.type || "application/octet-stream";
        setPreviewMimeType(mimeType);

        if (
          mimeType.startsWith("text/") ||
          mimeType === "application/json" ||
          mimeType === "text/csv"
        ) {
          setPreviewText(await blob.text());
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setPreviewObjectUrl(objectUrl);
      } catch (error) {
        if (!active) {
          return;
        }

        setPreviewError(
          error instanceof Error
            ? error.message
            : "Vault preview failed unexpectedly.",
        );
      } finally {
        if (active) {
          setIsPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [previewFile]);

  return (
    <div className="mx-auto w-full max-w-[1500px] min-w-0 p-3 sm:p-4 lg:p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/35">
            Kimi vault
          </p>
          <h1 className="mt-1 text-[22px] font-medium tracking-tight text-foreground">
            Archivos listos para retrieval
          </h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground/45">
            Cada archivo se guarda primero y despues intentamos extraer texto
            para que el chat lo pueda usar. Si la extraccion falla, el archivo
            igual queda persistido.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-full border-border/30 bg-card/30 px-3 text-[11px]"
            onClick={() => {
              void refreshVault();
            }}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Refresh
          </Button>
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
      </div>

      <div className="mt-5">
        <section className="rounded-3xl border border-border/35 bg-card/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-medium text-foreground">
                File ingestion
              </h2>
              <p className="mt-1 text-[12px] text-muted-foreground/40">
                {files.length} archivos, {readyFiles} listos, {pendingFiles} en proceso.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground/45">
              <StatusChip label={`${readyFiles} ready`} tone="ready" />
              {pendingFiles > 0 && (
                <StatusChip label={`${pendingFiles} processing`} tone="processing" />
              )}
              {legacyFiles > 0 && (
                <StatusChip label={`${legacyFiles} reupload`} tone="warning" />
              )}
            </div>
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
            <div className="grid grid-cols-[minmax(0,1fr)_140px_120px_80px] gap-3 border-b border-border/20 bg-background/40 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/35">
              <span>File</span>
              <span>Extraction</span>
              <span>Remote</span>
              <span />
            </div>
            <div className="divide-y divide-border/15">
              {filteredFiles.map(file => {
                const derivedState = deriveVaultState(file);

                return (
                  <div
                    key={file.id}
                    className="grid grid-cols-[minmax(0,1fr)_140px_120px_80px] gap-3 px-4 py-3"
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
                      <StatusPill status={derivedState} />
                    </div>
                    <div className="flex items-center text-[10px] text-muted-foreground/35">
                      {describeVaultLinkState(file)}
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
                );
              })}
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
                  value={deriveVaultState(previewFile)}
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

              {previewError && (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-[12px] text-destructive/90">
                  {previewError}
                </div>
              )}

              <div className="rounded-2xl border border-border/25 bg-background/40 p-4">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground/35">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Original file preview
                </div>

                <div className="mt-3 overflow-hidden rounded-2xl border border-border/20 bg-card/20">
                  {isPreviewLoading ? (
                    <div className="flex h-[420px] items-center justify-center text-[12px] text-muted-foreground/45">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading preview...
                    </div>
                  ) : previewMimeType === "application/pdf" && previewObjectUrl ? (
                    <iframe
                      title={previewFile.filename}
                      src={previewObjectUrl}
                      className="h-[420px] w-full"
                    />
                  ) : previewMimeType?.startsWith("image/") && previewObjectUrl ? (
                    <div className="flex max-h-[420px] items-center justify-center bg-black/20 p-4">
                      <img
                        src={previewObjectUrl}
                        alt={previewFile.filename}
                        className="max-h-[388px] w-auto rounded-xl object-contain"
                      />
                    </div>
                  ) : previewText ? (
                    <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-4 text-[12px] leading-relaxed text-foreground/85">
                      {previewText}
                    </pre>
                  ) : (
                    <div className="flex h-[180px] items-center justify-center px-6 text-center text-[12px] text-muted-foreground/45">
                      {previewFile.encryptedUrl
                        ? "No pudimos renderizar un preview nativo, pero el archivo sigue guardado."
                        : "Este archivo todavia no tiene original persistido para preview."}
                    </div>
                  )}
                </div>
              </div>

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

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "ready" | "processing" | "warning";
}) {
  const classes =
    tone === "ready"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200/80"
      : tone === "processing"
        ? "border-sky-500/25 bg-sky-500/10 text-sky-200/80"
        : "border-amber-500/25 bg-amber-500/10 text-amber-200/80";

  return (
    <span className={cn("rounded-full border px-2 py-1", classes)}>
      {label}
    </span>
  );
}

function StatusPill({
  status,
}: {
  status: DerivedVaultState;
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

  if (status === "needs-reupload") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200/80">
        <AlertTriangle className="h-3 w-3" />
        needs reupload
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-[10px] text-sky-200/80">
      <Loader2 className="h-3 w-3 animate-spin" />
      processing
    </span>
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
