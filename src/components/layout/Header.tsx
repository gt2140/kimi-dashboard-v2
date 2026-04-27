import { useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MobileSidebar } from "./Sidebar";
import { Button } from "@/components/ui/button";

export function Header() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border/60 px-4 bg-background/90 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <MobileSidebar />
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[12px] text-muted-foreground/60 hover:text-foreground gap-1.5 px-2"
          onClick={() => { logout(); navigate("/login"); }}
        >
          <LogOut className="h-3 w-3" />
          Exit
        </Button>
      </div>
    </header>
  );
}
