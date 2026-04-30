import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MobileSidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";

function getInitial(name?: string | null, email?: string | null) {
  return (name?.trim() || email?.trim() || "U").charAt(0).toUpperCase();
}

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border/60 bg-background/90 px-3 sm:px-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <MobileSidebar />
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <div className="hidden items-center gap-2 sm:flex">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-[11px] font-medium text-foreground/70">
            {getInitial(user?.name, user?.email)}
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium text-foreground">
              {user?.name || "Workspace"}
            </p>
            <p className="text-[10px] text-muted-foreground/50">
              {user?.email || "Authenticated session"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-1.5 text-[11px] text-muted-foreground/60 hover:text-foreground sm:px-2 sm:text-[12px]"
          onClick={() => {
            void logout();
          }}
        >
          <LogOut className="h-3 w-3" />
          <span className="hidden sm:inline">Exit</span>
        </Button>
      </div>
    </header>
  );
}
