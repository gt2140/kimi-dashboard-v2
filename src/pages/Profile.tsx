import { motion } from "framer-motion";
import { Clock3, LogOut, Mail, ShieldCheck, User2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

function formatDate(value?: Date | null) {
  if (!value) {
    return "Not available";
  }

  return value.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto w-full max-w-[1100px] min-w-0 p-4 sm:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[20px] font-medium tracking-tight text-foreground">
          Profile
        </h1>
        <p className="mt-1 text-[12px] text-muted-foreground/40">
          Identity loaded from the authenticated Supabase account.
        </p>
      </motion.div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border/30 bg-card/20 p-5"
        >
          <div className="flex items-start gap-4">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name ?? "Profile avatar"}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/60 text-lg font-semibold text-foreground/70">
                {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[18px] font-medium text-foreground">
                {user?.name || "Authenticated user"}
              </h2>
              <p className="truncate text-[12px] text-muted-foreground/45">
                {user?.email || "No email returned by provider"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-border/30 bg-muted/20 px-2.5 py-1 text-[11px] text-muted-foreground/55">
                  {user?.role || "user"}
                </span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] px-2.5 py-1 text-[11px] text-emerald-400/75">
                  Supabase synced
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ProfileDetail
              icon={<User2 className="h-4 w-4" />}
              label="Union ID"
              value={user?.unionId || "Not available"}
            />
            <ProfileDetail
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={user?.email || "Not available"}
            />
            <ProfileDetail
              icon={<Clock3 className="h-4 w-4" />}
              label="Created"
              value={formatDate(user?.createdAt)}
            />
            <ProfileDetail
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Last sign-in"
              value={formatDate(user?.lastSignInAt)}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="mt-5 h-8 w-full justify-start gap-1.5 text-[12px] text-muted-foreground/50 hover:text-destructive/70"
            onClick={() => {
              void logout();
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border/30 bg-card/20 p-5"
        >
          <h3 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">
            Phase 3 Status
          </h3>
          <div className="mt-4 space-y-3">
            <StatusRow
              label="Authentication"
              value="Google OAuth session active"
            />
            <StatusRow label="Identity source" value="auth.me via backend" />
            <StatusRow
              label="Avatar"
              value={user?.avatar ? "Available" : "Provider did not return one"}
            />
            <StatusRow
              label="Persistence"
              value="User row synchronized in Postgres"
            />
          </div>
          <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground/45">
            This page now reflects the real authenticated user instead of the
            previous local mock profile, which keeps the rest of the app aligned
            with the same identity source.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function ProfileDetail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/20 bg-background/40 p-3">
      <div className="mb-1 flex items-center gap-2 text-muted-foreground/35">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="break-words text-[12px] text-foreground/80">{value}</p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/20 bg-background/35 px-3 py-2.5">
      <span className="text-[12px] text-muted-foreground/45">{label}</span>
      <span className="text-right text-[12px] text-foreground/80">{value}</span>
    </div>
  );
}
