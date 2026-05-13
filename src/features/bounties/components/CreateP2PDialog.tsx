import { useState } from "react";
import { CalendarDays, Coins, FileText, Layers3, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DraftMiningForm = {
  title: string;
  description: string;
  fullBrief: string;
  reward: string;
  deadline: string;
  tags: string;
  vaultContext: string;
};

const DEFAULT_DRAFT_FORM: DraftMiningForm = {
  title: "",
  description: "",
  fullBrief: "",
  reward: "",
  deadline: "",
  tags: "",
  vaultContext: "",
};

export function CreateP2PDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<DraftMiningForm>(DEFAULT_DRAFT_FORM);

  function updateField<Key extends keyof DraftMiningForm>(
    key: Key,
    value: DraftMiningForm[Key],
  ) {
    setDraft(current => ({
      ...current,
      [key]: value,
    }));
  }

  function closeDialog(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setDraft(DEFAULT_DRAFT_FORM);
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[640px] gap-0 overflow-hidden border-border/60 bg-[#111119] p-0 shadow-[0_28px_90px_rgba(0,0,0,0.52)]">
        <div className="border-b border-border/35 bg-[#14141d] px-5 py-4">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground/45">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              <span>Draft flow</span>
            </div>
            <DialogTitle className="mt-2 text-[20px] font-medium tracking-tight">
              Create P2P mining
            </DialogTitle>
            <DialogDescription className="max-w-xl text-[12px] leading-5 text-muted-foreground/62">
              Shape a peer-to-peer opportunity with a compact local draft. It
              does not publish or persist yet.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_156px]">
            <Field label="Title" icon={<Layers3 className="h-3.5 w-3.5" />}>
              <Input
                value={draft.title}
                onChange={event => updateField("title", event.target.value)}
                placeholder="Review a new clinical AI benchmark"
                className="h-10 border-border/35 bg-background/35 text-[13px]"
              />
            </Field>
            <Field label="Reward" icon={<Coins className="h-3.5 w-3.5" />}>
              <Input
                value={draft.reward}
                onChange={event => updateField("reward", event.target.value)}
                placeholder="600 AURA"
                className="h-10 border-border/35 bg-background/35 text-[13px]"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_156px]">
            <Field
              label="Short description"
              icon={<FileText className="h-3.5 w-3.5" />}
            >
              <Textarea
                value={draft.description}
                onChange={event => updateField("description", event.target.value)}
                placeholder="Describe the opportunity in one tight summary."
                className="min-h-[74px] resize-none border-border/35 bg-background/35 text-[13px]"
              />
            </Field>
            <Field
              label="Deadline"
              icon={<CalendarDays className="h-3.5 w-3.5" />}
            >
              <Input
                type="date"
                value={draft.deadline}
                onChange={event => updateField("deadline", event.target.value)}
                className="h-10 border-border/35 bg-background/35 text-[13px]"
              />
            </Field>
          </div>

          <Field label="Full brief" icon={<FileText className="h-3.5 w-3.5" />}>
            <Textarea
              value={draft.fullBrief}
              onChange={event => updateField("fullBrief", event.target.value)}
              placeholder="Explain the brief, deliverable, and expected scope."
              className="min-h-[94px] resize-none border-border/35 bg-background/35 text-[13px]"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tags" icon={<Layers3 className="h-3.5 w-3.5" />}>
              <Input
                value={draft.tags}
                onChange={event => updateField("tags", event.target.value)}
                placeholder="Cardiology, peer review, trial"
                className="h-10 border-border/35 bg-background/35 text-[13px]"
              />
            </Field>
            <Field
              label="Vault context note"
              icon={<Sparkles className="h-3.5 w-3.5" />}
            >
              <Input
                value={draft.vaultContext}
                onChange={event => updateField("vaultContext", event.target.value)}
                placeholder="Protocol docs, datasets, or attached context."
                className="h-10 border-border/35 bg-background/35 text-[13px]"
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-border/30 bg-background/20 px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/36">
                  Draft snapshot
                </p>
                <p className="mt-1 truncate text-[13px] font-medium text-foreground">
                  {draft.title.trim() || "Untitled P2P mining"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/58">
                <PreviewStat label={draft.reward.trim() || "Reward TBD"} />
                <PreviewStat label={draft.deadline.trim() || "Deadline TBD"} />
              </div>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-muted-foreground/55">
              {draft.description.trim() ||
                "Local draft only. This flow is for shaping the creation UX before wiring persistence."}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="h-10 border-border/35 bg-transparent px-3 text-[13px]"
              onClick={() => closeDialog(false)}
            >
              Cancel
            </Button>
            <Button className="h-10 text-[13px]" onClick={() => closeDialog(false)}>
              Save draft
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/52">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}

function PreviewStat({
  label,
}: {
  label: string;
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/30 bg-background/35 px-2.5 py-1 text-[11px] text-foreground/82">
      {label}
    </span>
  );
}
