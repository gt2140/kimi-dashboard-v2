import type { ReactNode } from "react";
import {
  Calendar,
  FileText,
  FolderOpen,
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
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        {!bounty ? null : (
          <ScrollArea className="max-h-[85vh]">
            <div className="p-6">
              <DialogHeader className="gap-4 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <BountyTypeBadge type={bounty.type} />
                  <BountyStatusBadge status={bounty.status} />
                </div>
                <div className="space-y-2">
                  <DialogTitle className="text-2xl leading-tight">
                    {bounty.title}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground/70">
                    {bounty.description}
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

              <Separator className="my-6" />

              <Tabs defaultValue="overview" className="gap-4">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="submissions">Submissions</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">
                      Full brief
                    </h3>
                    <p className="text-sm leading-7 text-muted-foreground/80">
                      {bounty.fullDescription}
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Target className="h-4 w-4 text-amber-300" />
                      Success criteria
                    </h3>
                    <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm leading-7 text-muted-foreground/80">
                      {bounty.successCriteria}
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {bounty.tags.map(tag => (
                        <span
                          key={tag}
                          className="rounded-full border border-border/40 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground/75"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </section>

                  {bounty.vaultContext ? (
                    <section className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                      <h3 className="flex items-center gap-2 text-sm font-medium text-sky-300">
                        <FolderOpen className="h-4 w-4" />
                        Vault context
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground/80">
                        {bounty.vaultContext}
                      </p>
                    </section>
                  ) : null}
                </TabsContent>

                <TabsContent value="submissions" className="space-y-3">
                  {bounty.submissionsList.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground/60">
                      No submissions yet for this bounty.
                    </div>
                  ) : (
                    bounty.submissionsList.map(submission => (
                      <div
                        key={submission.id}
                        className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card/20 p-4 sm:flex-row sm:items-start sm:justify-between"
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
                              <p className="text-xs text-muted-foreground/50">
                                {submission.submittedAt}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground/75">
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
    <div className="rounded-xl border border-border/40 bg-card/20 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground/40">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
