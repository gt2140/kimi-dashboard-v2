import type { ReactNode } from "react";
import {
  Calendar,
  FileText,
  FolderOpen,
  Layers3,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  BountyStatusBadge,
  BountyTypeBadge,
  SubmissionStatusBadge,
} from "./BountyBadges";
import type { Bounty } from "../types";

export function BountyDetailDialog({
  bounty,
  open,
  onOpenChange,
}: {
  bounty: Bounty | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[760px] gap-0 overflow-hidden border-border/55 bg-[#111119] p-0 shadow-[0_28px_90px_rgba(0,0,0,0.52)]">
        {!bounty ? null : (
          <ScrollArea className="max-h-[85vh]">
            <div className="p-4 sm:p-5">
              <DialogHeader className="gap-3 text-left">
                <div className="flex flex-wrap items-center gap-1.5">
                  <BountyTypeBadge type={bounty.type} />
                  <BountyStatusBadge status={bounty.status} />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-[21px] leading-tight tracking-tight">
                    {bounty.title}
                  </DialogTitle>
                  <DialogDescription className="max-w-2xl text-[12px] leading-5 text-muted-foreground/62">
                    {bounty.description}
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <DetailMeta
                  icon={<Trophy className="h-4 w-4 text-cyan-300" />}
                  label="Reward"
                  value={`${bounty.reward.toLocaleString()} AURA`}
                />
                <DetailMeta
                  icon={<Calendar className="h-4 w-4 text-amber-300" />}
                  label="Deadline"
                  value={bounty.deadline}
                />
                <DetailMeta
                  icon={<UserRound className="h-4 w-4 text-muted-foreground" />}
                  label="Requester"
                  value={bounty.requester}
                />
                <DetailMeta
                  icon={<FileText className="h-4 w-4 text-sky-300" />}
                  label="Submissions"
                  value={String(bounty.submissions)}
                />
              </div>

              <Separator className="my-4" />

              <Tabs defaultValue="overview" className="gap-4">
                <TabsList className="w-full justify-start rounded-xl bg-background/35 p-1">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="submissions">Submissions</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-3.5">
                  <section className="rounded-2xl border border-border/30 bg-background/22 p-4">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/38">
                      Full brief
                    </h3>
                    <p className="mt-2 text-[13px] leading-6 text-muted-foreground/76">
                      {bounty.fullDescription}
                    </p>
                  </section>

                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                    <section className="rounded-2xl border border-border/30 bg-background/22 p-4">
                      <h3 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/38">
                        <Target className="h-3.5 w-3.5 text-amber-300" />
                        Success criteria
                      </h3>
                      <p className="mt-2 text-[13px] leading-6 text-muted-foreground/76">
                        {bounty.successCriteria}
                      </p>
                    </section>

                    <section className="space-y-3">
                      <div className="rounded-2xl border border-border/30 bg-background/22 p-4">
                        <h3 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/38">
                          <Layers3 className="h-3.5 w-3.5 text-cyan-300" />
                          Tags
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {bounty.tags.map(tag => (
                            <span
                              key={tag}
                              className="rounded-full border border-border/30 bg-background/35 px-2.5 py-1 text-[11px] text-muted-foreground/70"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {bounty.vaultContext ? (
                        <section className="rounded-2xl border border-sky-500/18 bg-sky-500/5 p-4">
                          <h3 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-sky-300/88">
                            <FolderOpen className="h-3.5 w-3.5" />
                            Vault context
                          </h3>
                          <p className="mt-2 text-[12px] leading-5 text-muted-foreground/72">
                            {bounty.vaultContext}
                          </p>
                        </section>
                      ) : null}
                    </section>
                  </div>
                </TabsContent>

                <TabsContent value="submissions" className="space-y-2.5">
                  {bounty.submissionsList.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/30 bg-background/20 px-4 py-8 text-center text-sm text-muted-foreground/56">
                      No submissions yet for this mining opportunity.
                    </div>
                  ) : (
                    bounty.submissionsList.map(submission => (
                      <div
                        key={submission.id}
                        className="flex flex-col gap-3 rounded-2xl border border-border/30 bg-background/20 p-3.5 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 text-[11px] font-medium text-foreground/80">
                              {submission.contributorAvatar}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {submission.contributor}
                              </p>
                              <p className="text-[11px] text-muted-foreground/48">
                                {submission.submittedAt}
                              </p>
                            </div>
                          </div>
                          <p className="text-[12px] leading-5 text-muted-foreground/70">
                            {submission.summary}
                          </p>
                        </div>
                        <SubmissionStatusBadge status={submission.status} />
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailMeta({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/30 bg-background/24 p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/34">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1.5 text-[12px] font-medium text-foreground">{value}</p>
    </div>
  );
}
