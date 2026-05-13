import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  File,
  FileImage,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { inferVaultCategoryFromUpload } from "@/lib/vault-classification";
import {
  deleteVaultDocument,
  fetchVaultDocumentOriginal,
  getVaultDocumentEvents,
  listVaultDocuments,
  reclassifyVaultDocument,
  reprocessVaultDocument,
  type VaultDocument,
  type VaultDocumentEvent,
  uploadVaultDocument,
} from "@/lib/vault-client";

const categoryOptions = [
  "bloodwork",
  "genetics",
  "wearables",
  "body-composition",
  "notes",
  "other",
] as const;

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

function isTerminalStatus(status: VaultDocument["status"]) {
  return status === "ready" || status === "failed";
}

export default function KimiVault() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [previewDocument, setPreviewDocument] = useState<VaultDocument | null>(null);
  const [previewCategoryDraft, setPreviewCategoryDraft] = useState<string>("other");
  const [pendingUploads, setPendingUploads] = useState<
    Array<{
      id: string;
      file: File;
      category: (typeof categoryOptions)[number];
      suggestedReason: string;
    }>
  >([]);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["vault-documents"],
    queryFn: listVaultDocuments,
    refetchInterval: query => {
      const documents = query.state.data ?? [];
      return documents.some(document => !isTerminalStatus(document.status))
        ? 3_000
        : false;
    },
  });

  const previewEventsQuery = useQuery({
    queryKey: ["vault-document-events", previewDocument?.id],
    queryFn: () => getVaultDocumentEvents(previewDocument!.id),
    enabled: Boolean(previewDocument?.id),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadVaultDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVaultDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: reprocessVaultDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      if (previewDocument?.id) {
        await queryClient.invalidateQueries({
          queryKey: ["vault-document-events", previewDocument.id],
        });
      }
    },
  });

  const reclassifyMutation = useMutation({
    mutationFn: reclassifyVaultDocument,
    onSuccess: async result => {
      setPreviewDocument(current =>
        current && current.id === result.document.id ? result.document : current,
      );
      await queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      if (previewDocument?.id) {
        await queryClient.invalidateQueries({
          queryKey: ["vault-document-events", previewDocument.id],
        });
      }
    },
  });

  const documents = documentsQuery.data ?? [];
  const filteredDocuments = useMemo(
    () =>
      documents.filter(document =>
        document.filename.toLowerCase().includes(search.toLowerCase()),
      ),
    [documents, search],
  );
  const readyCount = documents.filter(document => document.status === "ready").length;
  const processingCount = documents.filter(
    document => !isTerminalStatus(document.status),
  ).length;
  const failedCount = documents.filter(document => document.status === "failed").length;
  const error =
    uploadMutation.error?.message ||
    deleteMutation.error?.message ||
    reprocessMutation.error?.message ||
    reclassifyMutation.error?.message ||
    documentsQuery.error?.message ||
    previewEventsQuery.error?.message ||
    null;

  useEffect(() => {
    setPreviewCategoryDraft(previewDocument?.category ?? "other");
  }, [previewDocument?.id, previewDocument?.category]);

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      if (!previewDocument) {
        setPreviewText(null);
        setPreviewMimeType(null);
        if (previewBlobUrl) {
          URL.revokeObjectURL(previewBlobUrl);
          setPreviewBlobUrl(null);
        }
        return;
      }

      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }

      try {
        const blob = await fetchVaultDocumentOriginal(previewDocument.id);
        if (!active) {
          return;
        }

        const mimeType = blob.type || previewDocument.mimeType || "application/octet-stream";
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

        setPreviewText(null);
        setPreviewBlobUrl(objectUrl);
      } catch {
        if (!active) {
          return;
        }

        setPreviewText(null);
        setPreviewMimeType(null);
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [previewDocument]);

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  function handleUpload(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    setPendingUploads(
      Array.from(fileList).map(file => {
        const suggestion = inferVaultCategoryFromUpload({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
        });
        return {
          id: `${file.name}-${file.size}-${file.lastModified}`,
          file,
          category: suggestion.category,
          suggestedReason: suggestion.reason,
        };
      }),
    );
  }

  async function confirmUploads() {
    for (const upload of pendingUploads) {
      await uploadMutation.mutateAsync({
        file: upload.file,
        category: upload.category,
      });
    }
    setPendingUploads([]);
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] min-w-0 p-3 sm:p-4 lg:p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/35">
            Vault
          </p>
          <h1 className="mt-1 text-[22px] font-medium tracking-tight text-foreground">
            Persistent and traceable file context
          </h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground/45">
            Uploads stay visible through ingestion, processing, and retrieval.
            Files only become reusable chat context once they reach `ready`.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-full border-border/30 bg-card/30 px-3 text-[11px]"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
            }}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Refresh
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[11px] text-emerald-100/85">
            <Upload className="h-3.5 w-3.5" />
            {uploadMutation.isPending ? "Uploading..." : "Upload to Vault"}
            <input
              type="file"
              multiple
              accept=".pdf,.csv,.png,.jpg,.jpeg,.webp,.txt,.md"
              className="hidden"
              disabled={uploadMutation.isPending}
              onChange={event => {
                handleUpload(event.target.files);
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
                Document pipeline
              </h2>
              <p className="mt-1 text-[12px] text-muted-foreground/40">
                {documents.length} documentos, {readyCount} listos, {processingCount} en curso, {failedCount} con error.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground/45">
              <StatusChip label={`${readyCount} ready`} tone="ready" />
              {processingCount > 0 && (
                <StatusChip label={`${processingCount} processing`} tone="processing" />
              )}
              {failedCount > 0 && (
                <StatusChip label={`${failedCount} failed`} tone="failed" />
              )}
            </div>
          </div>

          <div className="relative mt-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/25" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search vault documents..."
              className="h-9 border-border/30 bg-card/30 pl-9 text-[12px]"
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border/25">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_140px_100px] gap-3 border-b border-border/20 bg-background/40 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/35">
              <span>Document</span>
              <span>Status</span>
              <span>Pipeline</span>
              <span />
            </div>
            <div className="divide-y divide-border/15">
              {filteredDocuments.map(document => (
                <div
                  key={document.id}
                  className="grid grid-cols-[minmax(0,1fr)_120px_140px_100px] gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/30">
                        {getFileIcon(document.filename)}
                      </span>
                      <p className="truncate text-[12px] text-foreground">
                        {document.filename}
                      </p>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground/30">
                      {document.category} | {formatBytes(document.sizeBytes)}
                    </p>
                    {document.categoryMismatch && document.categorySuggested && (
                      <p className="mt-1 text-[10px] text-amber-200/75">
                        Suggested category: {document.categorySuggested}
                      </p>
                    )}
                    {document.errorMessage && (
                      <p className="mt-1 line-clamp-2 text-[10px] text-destructive/75">
                        {document.errorMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center">
                    <StatusPill status={document.status} />
                  </div>
                  <div className="flex items-center text-[10px] text-muted-foreground/35">
                    {document.latestRun?.currentStage ?? "uploaded"}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/35 hover:text-foreground"
                      onClick={() => setPreviewDocument(document)}
                    >
                      <FileSearch className="h-3.5 w-3.5" />
                    </Button>
                    {document.status === "failed" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground/35 hover:text-foreground"
                        onClick={() => {
                          void reprocessMutation.mutateAsync(document.id);
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/35 hover:text-destructive/70"
                      onClick={() => {
                        void deleteMutation.mutateAsync(document.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredDocuments.length === 0 && (
                <div className="px-4 py-10 text-center text-[12px] text-muted-foreground/35">
                  {documentsQuery.isLoading ? "Loading vault..." : "No documents found."}
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-3 text-[12px] text-destructive/80">{error}</p>
          )}
        </section>
      </div>

      <Dialog open={!!previewDocument} onOpenChange={() => setPreviewDocument(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[14px]">
              <Database className="h-4 w-4" />
              {previewDocument?.filename}
            </DialogTitle>
          </DialogHeader>
          {previewDocument && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <PreviewMetric label="Status" value={previewDocument.status} />
                <PreviewMetric label="Category" value={previewDocument.category} />
                <PreviewMetric
                  label="Current stage"
                  value={previewDocument.latestRun?.currentStage ?? "uploaded"}
                />
                <PreviewMetric
                  label="Attempt"
                  value={String(previewDocument.latestRun?.attempt ?? 1)}
                />
                <PreviewMetric
                  label="Ready at"
                  value={
                    previewDocument.readyAt
                      ? new Date(previewDocument.readyAt).toLocaleString()
                      : "Pending"
                  }
                />
              </div>

              <div className="rounded-2xl border border-border/25 bg-background/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground/35">
                      Category
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/45">
                      Auto + editar: podes corregir la categoria y reprocesar el documento sin volver a subirlo.
                    </p>
                    {previewDocument.categoryMismatch && previewDocument.categorySuggested && (
                      <p className="mt-2 text-[11px] text-amber-200/75">
                        Suggested category from content: {previewDocument.categorySuggested}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={previewCategoryDraft}
                      onValueChange={setPreviewCategoryDraft}
                    >
                      <SelectTrigger className="h-9 min-w-[180px] border-border/30 bg-card/30 text-[12px]">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map(option => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-full border-border/30 bg-card/30 px-3 text-[11px]"
                      disabled={
                        reclassifyMutation.isPending ||
                        previewCategoryDraft === previewDocument.category
                      }
                      onClick={() => {
                        void reclassifyMutation.mutateAsync({
                          documentId: previewDocument.id,
                          category: previewCategoryDraft,
                          reprocess: true,
                        });
                      }}
                    >
                      <RotateCcw className="mr-2 h-3.5 w-3.5" />
                      Save + reprocess
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/25 bg-background/40 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground/35">
                  Original preview
                </p>
                <div className="mt-3 overflow-hidden rounded-2xl border border-border/20 bg-card/20">
                  {!previewMimeType && !previewBlobUrl && !previewText ? (
                    <div className="flex h-[180px] items-center justify-center text-[12px] text-muted-foreground/45">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading preview...
                    </div>
                  ) : previewMimeType === "application/pdf" && previewBlobUrl ? (
                    <iframe
                      title={previewDocument.filename}
                      src={previewBlobUrl}
                      className="h-[420px] w-full"
                    />
                  ) : previewMimeType?.startsWith("image/") && previewBlobUrl ? (
                    <div className="flex max-h-[420px] items-center justify-center bg-black/20 p-4">
                      <img
                        src={previewBlobUrl}
                        alt={previewDocument.filename}
                        className="max-h-[388px] w-auto rounded-xl object-contain"
                      />
                    </div>
                  ) : previewText ? (
                    <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-4 text-[12px] leading-relaxed text-foreground/85">
                      {previewText}
                    </pre>
                  ) : (
                    <div className="flex h-[180px] items-center justify-center px-6 text-center text-[12px] text-muted-foreground/45">
                      No pudimos renderizar un preview nativo para este archivo.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border/25 bg-background/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground/35">
                    Ingestion events
                  </p>
                  {previewDocument.status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full border-border/30 bg-card/30 px-3 text-[11px]"
                      onClick={() => {
                        void reprocessMutation.mutateAsync(previewDocument.id);
                      }}
                    >
                      <RotateCcw className="mr-2 h-3.5 w-3.5" />
                      Reprocess
                    </Button>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {(previewEventsQuery.data ?? []).map(event => (
                    <EventRow key={event.id} event={event} />
                  ))}
                  {!previewEventsQuery.isLoading &&
                    (previewEventsQuery.data?.length ?? 0) === 0 && (
                      <p className="text-[12px] text-muted-foreground/40">
                        Todavia no hay eventos para este documento.
                      </p>
                    )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pendingUploads.length > 0} onOpenChange={open => !open && setPendingUploads([])}>
        <DialogContent className="max-w-3xl border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              Review categories before upload
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {pendingUploads.map(upload => (
              <div
                key={upload.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/25 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-foreground">{upload.file.name}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground/40">
                    {formatBytes(upload.file.size)} | {upload.suggestedReason}
                  </p>
                </div>
                <Select
                  value={upload.category}
                  onValueChange={value => {
                    setPendingUploads(current =>
                      current.map(item =>
                        item.id === upload.id
                          ? {
                              ...item,
                              category: value as (typeof categoryOptions)[number],
                            }
                          : item,
                      ),
                    );
                  }}
                >
                  <SelectTrigger className="h-9 min-w-[180px] border-border/30 bg-card/30 text-[12px]">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map(option => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setPendingUploads([])}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full px-4 text-[12px]"
              disabled={uploadMutation.isPending}
              onClick={() => {
                void confirmUploads();
              }}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload files"}
            </Button>
          </div>
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
  tone: "ready" | "processing" | "failed";
}) {
  const classes =
    tone === "ready"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200/80"
      : tone === "processing"
        ? "border-sky-500/25 bg-sky-500/10 text-sky-200/80"
        : "border-destructive/25 bg-destructive/10 text-destructive/85";

  return <span className={cn("rounded-full border px-2 py-1", classes)}>{label}</span>;
}

function StatusPill({ status }: { status: VaultDocument["status"] }) {
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

  if (status === "profiling") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200/80">
        <AlertTriangle className="h-3 w-3" />
        profiling
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-[10px] text-sky-200/80">
      <Loader2 className="h-3 w-3 animate-spin" />
      {status}
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

function EventRow({ event }: { event: VaultDocumentEvent }) {
  return (
    <div className="rounded-2xl border border-border/20 bg-card/20 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-foreground/85">
            {event.stage} · {event.status}
          </p>
          {event.message && (
            <p className="mt-1 text-[11px] text-muted-foreground/45">{event.message}</p>
          )}
        </div>
        <p className="shrink-0 text-[10px] text-muted-foreground/35">
          {new Date(event.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
