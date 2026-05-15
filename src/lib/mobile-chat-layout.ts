export function getChatShellClassName() {
  return [
    "mx-auto flex h-[100dvh] w-full max-w-[1380px] min-w-0 flex-col overflow-hidden px-0 pb-0 pt-0",
    "sm:h-[calc(100dvh-3.5rem)] sm:px-4 sm:pb-4 sm:pt-2",
  ].join(" ");
}

export function getChatScrollAreaClassName() {
  return "min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-3 sm:px-5 sm:py-4";
}

export function getChatComposerShellClassName() {
  return [
    "border-t border-border/20 bg-background/92 px-2 py-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur",
    "sm:px-4 sm:py-3 sm:pb-3",
  ].join(" ");
}
