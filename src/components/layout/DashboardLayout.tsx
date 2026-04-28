import { Outlet } from "react-router";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { isLoading, error, refresh, logout, user } = useAuth({
    redirectOnUnauthenticated: true,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-sm text-muted-foreground">
        Loading your workspace...
      </div>
    );
  }

  if (!user && error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">
            We could not finish loading your workspace.
          </p>
          <p className="mt-2 max-w-md text-xs text-muted-foreground">{error}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void refresh();
            }}
          >
            Retry
          </Button>
          <Button
            size="sm"
            onClick={() => {
              void logout();
            }}
          >
            Back to login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div
        className={cn(
          "hidden lg:block transition-all duration-300",
          collapsed ? "w-[60px]" : "w-[240px]"
        )}
      >
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
