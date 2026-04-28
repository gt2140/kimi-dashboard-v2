import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  Droplets,
  Dna,
  Eye,
  File,
  FileCode,
  FileText,
  Image,
  Loader2,
  Search,
  ShieldCheck,
  StickyNote,
  Table,
  Trash2,
  Upload,
  Watch,
  Weight,
  X,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatRuntimeError } from "@/lib/app-errors";
import type { VaultFile } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const categoryConfig: Record<
  string,
  { icon: React.ReactNode; label: string; color: string }
> = {
  bloodwork: {
    icon: <Droplets className="h-4 w-4" />,
    label: "Bloodwork",
    color: "text-red-400/50",
  },
  genetics: {
    icon: <Dna className="h-4 w-4" />,
    label: "Genetics",
    color: "text-purple-400/50",
  },
  wearables: {
    icon: <Watch className="h-4 w-4" />,
    label: "Wearables",
    color: "text-blue-400/50",
  },
  "body-composition": {
    icon: <Weight className="h-4 w-4" />,
    label: "Body Comp",
    color: "text-emerald-400/50",
  },
  notes: {
    icon: <StickyNote className="h-4 w-4" />,
    label: "Notes",
    color: "text-amber-400/50",
  },
  other: {
    icon: <File className="h-4 w-4" />,
    label: "Other",
    color: "text-muted-foreground/30",
  },
};

function inferCategory(file: File): VaultFile["category"] {
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

function inferFileType(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext ? ext.toUpperCase() : "FILE";
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || ext === "md" || ext === "txt") {
    return <FileText className="h-4 w-4" />;
  }
  if (ext === "csv") {
    return <Table className="h-4 w-4" />;
  }
  if (ext === "json") {
    return <FileCode className="h-4 w-4" />;
  }
  if (["png", "jpg", "jpeg", "webp"].includes(ext || "")) {
    return <Image className="h-4 w-4" />;
  }
  return <File className="h-4 w-4" />;
}

function formatSize(bytes: number) {
  if (bytes <= 0) {
    return "0 KB";
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function mapVaultFile(item: {
  id: number;
  filename: string;
  fileType: string;
  category: VaultFile["category"];
  size: number;
  status: "ready" | "processing" | "failed";
  uploadedAt: Date | string;
  updatedAt: Date | string;
}): VaultFile {
  return {
    id: String(item.id),
    filename: item.filename,
    fileType: item.fileType,
    category: item.category,
    size: item.size,
    status: item.status,
    uploadedAt: new Date(item.uploadedAt),
    updatedAt: new Date(item.updatedAt),
  };
}

export default function Vault() {
  const utils = trpc.useUtils();
  const filesQuery = trpc.vault.list.useQuery();
  const uploadMutation = trpc.vault.upload.useMutation();
  const deleteMutation = trpc.vault.delete.useMutation();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<
    VaultFile["category"] | null
  >(null);
  const [previewFile, setPreviewFile] = useState<VaultFile | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const files = useMemo(
    () => (filesQuery.data ?? []).map(mapVaultFile),
    [filesQuery.data]
  );

  const categories = useMemo(
    () => Array.from(new Set(files.map(file => file.category))),
    [files]
  );
  const totalSize = useMemo(
    () => files.reduce((acc, file) => acc + file.size, 0),
    [files]
  );

  const filteredFiles = useMemo(
    () =>
      files.filter(file => {
        const matchesSearch = file.filename
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesCategory =
          !activeCategory || file.category === activeCategory;
        return matchesSearch && matchesCategory;
      }),
    [activeCategory, files, search]
  );

  const error =
    filesQuery.error ?? uploadMutation.error ?? deleteMutation.error ?? null;

  const refreshVault = useCallback(async () => {
    await utils.vault.list.invalidate();
  }, [utils.vault.list]);

  const handleFiles = useCallback(
    async (fileList: File[]) => {
      for (const file of fileList) {
        await uploadMutation.mutateAsync({
          filename: file.name,
          fileType: inferFileType(file.name),
          category: inferCategory(file),
          size: file.size,
          status: "ready",
        });
      }

      await refreshVault();
    },
    [refreshVault, uploadMutation]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      void handleFiles(Array.from(event.dataTransfer.files));
    },
    [handleFiles]
  );

  async function handleDelete(fileId: string) {
    await deleteMutation.mutateAsync({ id: Number(fileId) });
    if (previewFile?.id === fileId) {
      setPreviewFile(null);
    }
    await refreshVault();
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 p-4 sm:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-medium tracking-tight text-foreground">
              Vault
            </h1>
            <p className="mt-1 text-[12px] text-muted-foreground/40">
              {files.length} files · {formatSize(totalSize)} · Metadata
              inventory persisted per user
            </p>
          </div>
          {filesQuery.isFetching && !filesQuery.isLoading && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/40">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Syncing
            </div>
          )}
        </div>
      </motion.div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative mt-6 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors",
          isDragOver
            ? "border-foreground/30 bg-card/50"
            : "border-border/40 bg-card/20 hover:border-border/60"
        )}
      >
        <Upload className="h-4 w-4 text-muted-foreground/30" />
        <p className="text-[12px] text-muted-foreground/50">
          {isDragOver
            ? "Drop files here"
            : "Drag files or click to register metadata"}
        </p>
        <span className="ml-auto text-[11px] text-muted-foreground/25">
          PDF, CSV, PNG, JSON, TXT
        </span>
        <input
          type="file"
          multiple
          accept=".pdf,.csv,.png,.jpg,.jpeg,.webp,.json,.txt,.md"
          onChange={event => {
            if (event.target.files) {
              void handleFiles(Array.from(event.target.files));
              event.target.value = "";
            }
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        {uploadMutation.isPending && (
          <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin text-muted-foreground/35" />
        )}
      </div>

      <div className="relative mt-4 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/25" />
        <Input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search files..."
          className="h-8 border-border/30 bg-card/30 pl-8 text-[12px]"
        />
      </div>

      {filesQuery.isLoading ? (
        <div className="mt-8 flex items-center justify-center text-[12px] text-muted-foreground/40">
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          Loading vault metadata...
        </div>
      ) : !activeCategory && !search ? (
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map(category => {
            const config = categoryConfig[category] || categoryConfig.other;
            const categoryFiles = files.filter(
              file => file.category === category
            );
            const categorySize = categoryFiles.reduce(
              (acc, file) => acc + file.size,
              0
            );

            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className="group flex items-center gap-3 rounded-xl border border-border/30 bg-card/20 px-4 py-3 text-left transition-all hover:border-border/50 hover:bg-card/40"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/30",
                    config.color
                  )}
                >
                  {config.icon}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-foreground">
                    {config.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground/30">
                    {categoryFiles.length} files · {formatSize(categorySize)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/15 transition-colors group-hover:text-muted-foreground/30" />
              </button>
            );
          })}
          {categories.length === 0 && (
            <div className="rounded-xl border border-border/30 bg-card/20 px-4 py-6 text-center text-[12px] text-muted-foreground/35">
              No metadata registered yet.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          {activeCategory && (
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => setActiveCategory(null)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground/40 transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                All categories
              </button>
              <ChevronRight className="h-3 w-3 text-muted-foreground/15" />
              <span className="text-[11px] font-medium text-foreground">
                {categoryConfig[activeCategory]?.label || activeCategory}
              </span>
              <span className="ml-1 text-[10px] text-muted-foreground/30">
                ({filteredFiles.length} files)
              </span>
              {search && (
                <>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/15" />
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground/40">
                    Search: "{search}"
                    <button onClick={() => setSearch("")}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </>
              )}
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-border/30 bg-card/20">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 border-b border-border/20 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/30">
              <span>File</span>
              <span className="hidden sm:block">Type</span>
              <span className="hidden sm:block">Category</span>
              <span>Status</span>
              <span className="hidden sm:block">Date</span>
              <span />
            </div>
            <div className="divide-y divide-border/10">
              {filteredFiles.map(file => {
                const config =
                  categoryConfig[file.category] || categoryConfig.other;
                const status = file.status || "ready";

                return (
                  <div
                    key={file.id}
                    className="group grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-card/30"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="shrink-0 text-muted-foreground/25">
                        {getFileIcon(file.filename)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] text-foreground">
                          {file.filename}
                        </p>
                        <p className="text-[10px] text-muted-foreground/25">
                          {formatSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <span className="hidden text-[11px] text-muted-foreground/35 sm:block">
                      {file.fileType || inferFileType(file.filename)}
                    </span>
                    <span
                      className={cn(
                        "hidden text-[11px] sm:block",
                        config.color
                      )}
                    >
                      {config.label}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] uppercase",
                        status === "ready" && "text-emerald-400/70",
                        status === "processing" && "text-amber-400/70",
                        status === "failed" && "text-red-400/70"
                      )}
                    >
                      {status}
                    </span>
                    <span className="hidden text-[11px] text-muted-foreground/20 sm:block">
                      {formatDate(file.uploadedAt)}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground/30 hover:text-foreground"
                        onClick={() => setPreviewFile(file)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground/30 hover:text-destructive/60"
                        onClick={() => {
                          void handleDelete(file.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredFiles.length === 0 && (
              <p className="py-8 text-center text-[12px] text-muted-foreground/30">
                No files found
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 text-[12px] text-destructive/80">
          {formatRuntimeError(error, "Vault")}
        </p>
      )}

      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-h-[80vh] max-w-xl overflow-y-auto border-border/60 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[13px] font-medium">
              {previewFile && getFileIcon(previewFile.filename)}
              {previewFile?.filename}
            </DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="mt-2 space-y-3">
              <VaultMetaRow
                icon={<FileText className="h-4 w-4" />}
                label="Type"
                value={
                  previewFile.fileType || inferFileType(previewFile.filename)
                }
              />
              <VaultMetaRow
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Status"
                value={(previewFile.status || "ready").toUpperCase()}
              />
              <VaultMetaRow
                icon={
                  categoryConfig[previewFile.category]?.icon || (
                    <File className="h-4 w-4" />
                  )
                }
                label="Category"
                value={
                  categoryConfig[previewFile.category]?.label ||
                  previewFile.category
                }
              />
              <VaultMetaRow
                icon={<Clock3 className="h-4 w-4" />}
                label="Uploaded"
                value={previewFile.uploadedAt.toLocaleString()}
              />
              <VaultMetaRow
                icon={<Clock3 className="h-4 w-4" />}
                label="Updated"
                value={
                  previewFile.updatedAt?.toLocaleString() || "Not available"
                }
              />
              <VaultMetaRow
                icon={<File className="h-4 w-4" />}
                label="Size"
                value={formatSize(previewFile.size)}
              />
              <div className="rounded-xl border border-border/20 bg-background/40 p-3 text-[12px] leading-relaxed text-muted-foreground/45">
                Phase 3 keeps the vault at metadata level only. File content
                preview, chunking, extraction, and retrieval stay intentionally
                out of scope until the next phase.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VaultMetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/20 bg-background/40 px-3 py-2.5">
      <div className="flex items-center gap-2 text-muted-foreground/40">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-right text-[12px] text-foreground/80">{value}</span>
    </div>
  );
}
