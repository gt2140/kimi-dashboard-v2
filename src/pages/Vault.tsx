import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileText, Image, Table, FileCode, Upload, Search,
  Download, Trash2, Eye, Droplets, Dna, Watch,
  Weight, StickyNote, File, Lock, Unlock, ChevronRight,
  ArrowLeft, X
} from "lucide-react";
import { useVaultStore } from "@/hooks/useStore";
import type { VaultFile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const categoryConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  bloodwork: { icon: <Droplets className="h-4 w-4" />, label: "Bloodwork", color: "text-red-400/50" },
  genetics: { icon: <Dna className="h-4 w-4" />, label: "Genetics", color: "text-purple-400/50" },
  wearables: { icon: <Watch className="h-4 w-4" />, label: "Wearables", color: "text-blue-400/50" },
  "body-composition": { icon: <Weight className="h-4 w-4" />, label: "Body Comp", color: "text-emerald-400/50" },
  notes: { icon: <StickyNote className="h-4 w-4" />, label: "Notes", color: "text-amber-400/50" },
  other: { icon: <File className="h-4 w-4" />, label: "Other", color: "text-muted-foreground/30" },
};

function getFileIcon(filename: string) {
  if (filename.endsWith(".pdf")) return <FileText className="h-4 w-4" />;
  if (filename.endsWith(".csv")) return <Table className="h-4 w-4" />;
  if (filename.endsWith(".json")) return <FileCode className="h-4 w-4" />;
  if (filename.match(/\.(png|jpg|jpeg|webp)$/)) return <Image className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function Vault() {
  const files = useVaultStore((state) => state.files);
  const removeFile = useVaultStore((state) => state.removeFile);
  const addFile = useVaultStore((state) => state.addFile);
  const activeCategory = useVaultStore((state) => state.activeCategory);
  const setActiveCategory = useVaultStore((state) => state.setActiveCategory);

  const [search, setSearch] = useState("");
  const [previewFile, setPreviewFile] = useState<VaultFile | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const categories = Array.from(new Set(files.map((f) => f.category)));
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.filename.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory || f.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  }, [addFile]);

  const handleFiles = (fileList: File[]) => {
    setUploading(true);
    setTimeout(() => {
      fileList.forEach((file) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        let category: VaultFile["category"] = "other";
        if (ext === "pdf") category = "bloodwork";
        else if (ext === "csv") category = "wearables";
        else if (ext === "json") category = "genetics";
        else if (["png", "jpg", "jpeg"].includes(ext || "")) category = "body-composition";
        addFile({ id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, filename: file.name, category, size: file.size, uploadedAt: new Date(), encrypted: true });
      });
      setUploading(false);
    }, 1500);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 p-4 sm:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-[20px] font-medium tracking-tight text-foreground">Vault</h1>
            <p className="text-[12px] text-muted-foreground/40 mt-1">{files.length} files &middot; {formatSize(totalSize)} &middot; AES-256 encrypted</p>
          </div>
        </div>
      </motion.div>

      {/* Upload */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn("mt-6 flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors cursor-pointer relative",
          isDragOver ? "border-foreground/30 bg-card/50" : "border-border/40 bg-card/20 hover:border-border/60")}
      >
        <Upload className="h-4 w-4 text-muted-foreground/30" />
        <p className="text-[12px] text-muted-foreground/50">{isDragOver ? "Drop files here" : "Drag files or click to upload"}</p>
        <span className="ml-auto text-[11px] text-muted-foreground/25">PDF, CSV, PNG, JSON</span>
        <input type="file" multiple accept=".pdf,.csv,.png,.jpg,.jpeg,.json" onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))} className="absolute inset-0 cursor-pointer opacity-0" />
        {uploading && <div className="ml-2 h-3 w-3 animate-spin rounded-full border border-muted-foreground/30 border-t-transparent" />}
      </div>

      {/* Search */}
      <div className="mt-4 relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/25" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files..." className="h-8 pl-8 text-[12px] bg-card/30 border-border/30" />
      </div>

      {/* Category Cards */}
      {!activeCategory && !search && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {categories.map((cat) => {
            const config = categoryConfig[cat] || categoryConfig.other;
            const catFiles = files.filter((f) => f.category === cat);
            const catSize = catFiles.reduce((a, f) => a + f.size, 0);
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="group flex items-center gap-3 rounded-xl border border-border/30 bg-card/20 px-4 py-3 text-left transition-all hover:bg-card/40 hover:border-border/50"
              >
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/30", config.color)}>
                  {config.icon}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-foreground">{config.label}</p>
                  <p className="text-[11px] text-muted-foreground/30">{catFiles.length} files &middot; {formatSize(catSize)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/15 group-hover:text-muted-foreground/30 transition-colors" />
              </button>
            );
          })}
        </div>
      )}

      {/* File List */}
      {(activeCategory || search) && (
        <div className="mt-4">
          {activeCategory && (
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setActiveCategory(null)} className="text-[11px] text-muted-foreground/40 hover:text-foreground flex items-center gap-1 transition-colors">
                <ArrowLeft className="h-3 w-3" /> All categories
              </button>
              <ChevronRight className="h-3 w-3 text-muted-foreground/15" />
              <span className="text-[11px] text-foreground font-medium">{categoryConfig[activeCategory]?.label || activeCategory}</span>
              <span className="text-[10px] text-muted-foreground/30 ml-1">({filteredFiles.length} files)</span>
              {search && (
                <>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/15" />
                  <span className="text-[11px] text-muted-foreground/40 flex items-center gap-1">
                    Search: "{search}" <button onClick={() => setSearch("")}><X className="h-3 w-3" /></button>
                  </span>
                </>
              )}
            </div>
          )}
          <div className="rounded-xl border border-border/30 bg-card/20 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/30 border-b border-border/20">
              <span>File</span>
              <span className="hidden sm:block">Category</span>
              <span>Size</span>
              <span className="hidden sm:block">Date</span>
              <span></span>
            </div>
            <div className="divide-y divide-border/10">
              {filteredFiles.map((file) => {
                const config = categoryConfig[file.category] || categoryConfig.other;
                return (
                  <div key={file.id} className="group grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-4 py-2.5 transition-colors hover:bg-card/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-muted-foreground/25 shrink-0">{getFileIcon(file.filename)}</div>
                      <span className="text-[12px] text-foreground truncate">{file.filename}</span>
                    </div>
                    <span className={cn("hidden sm:block text-[11px] shrink-0", config.color)}>{config.label}</span>
                    <span className="text-[11px] text-muted-foreground/25 shrink-0">{formatSize(file.size)}</span>
                    <span className="hidden sm:block text-[11px] text-muted-foreground/20 shrink-0">{file.uploadedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {file.encrypted ? <Lock className="h-3 w-3 text-muted-foreground/15" /> : <Unlock className="h-3 w-3 text-muted-foreground/15" />}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/30 hover:text-foreground" onClick={() => setPreviewFile(file)}><Eye className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/30 hover:text-destructive/60" onClick={() => removeFile(file.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredFiles.length === 0 && (
              <p className="text-center text-[12px] text-muted-foreground/30 py-8">No files found</p>
            )}
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto border-border/60 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[13px] font-medium">
              {previewFile && getFileIcon(previewFile.filename)}
              {previewFile?.filename}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {previewFile?.filename.endsWith(".csv") && (
              <div className="rounded border border-border/40 bg-background p-3 overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead><tr className="border-b border-border/40">
                    <th className="text-left py-1 pr-3 font-medium text-muted-foreground/60">Date</th>
                    <th className="text-left py-1 pr-3 font-medium text-muted-foreground/60">Sleep</th>
                    <th className="text-left py-1 pr-3 font-medium text-muted-foreground/60">HRV</th>
                    <th className="text-left py-1 pr-3 font-medium text-muted-foreground/60">RHR</th>
                    <th className="text-left py-1 pr-3 font-medium text-muted-foreground/60">Steps</th>
                  </tr></thead>
                  <tbody>
                    {[["2026-01-20", 85, 62, 52, 10240], ["2026-01-21", 88, 65, 51, 11500], ["2026-01-22", 82, 58, 54, 9800], ["2026-01-23", 90, 70, 49, 12500], ["2026-01-24", 87, 64, 51, 11000]].map((row, i) => (
                      <tr key={i} className="border-b border-border/20">{row.map((cell, j) => <td key={j} className="py-1 pr-3 text-muted-foreground/60">{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {previewFile?.filename.endsWith(".pdf") && (
              <div className="rounded border border-border/40 bg-background p-8 text-center">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                <p className="text-[13px] text-muted-foreground/40">PDF preview requires decryption</p>
                <Button variant="outline" size="sm" className="mt-3 h-7 text-[12px] border-border/60"><Download className="mr-1 h-3 w-3" /> Download</Button>
              </div>
            )}
            {previewFile?.filename.endsWith(".json") && (
              <div className="rounded border border-border/40 bg-background p-3 overflow-x-auto">
                <pre className="text-[11px] text-muted-foreground/50">{JSON.stringify({ genome_version: "GRCh38", analyzed_variants: 1250000, pharmacogenomics: { CYP2D6: "*1/*2", CYP3A4: "*1/*1" }, polygenic_scores: { cardiovascular_risk: 0.42, type2_diabetes: 0.31, longevity: 0.58 } }, null, 2)}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
