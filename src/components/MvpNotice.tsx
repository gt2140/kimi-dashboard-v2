import { Button } from "@/components/ui/button";

export function MvpNotice({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 rounded-2xl border border-border/40 bg-card/20 p-6">
      <div>
        <h1 className="text-[20px] font-medium tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground/55">
          {description}
        </p>
      </div>
      {actionLabel && onAction ? (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
