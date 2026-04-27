import { motion } from "framer-motion";
import {
  Wallet, TrendingUp, Lock, ArrowDownLeft, ArrowUpRight,
  Activity, MessageSquare, Trophy, Upload, Coins, LogOut
} from "lucide-react";
import { useProfileStore } from "@/hooks/useStore";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const logIcons: Record<string, React.ReactNode> = {
  chat: <MessageSquare className="h-3 w-3" />,
  "vault-upload": <Upload className="h-3 w-3" />,
  "prediction-created": <ArrowUpRight className="h-3 w-3" />,
  "prediction-won": <Trophy className="h-3 w-3" />,
  "prediction-responded": <Activity className="h-3 w-3" />,
  "token-earned": <Coins className="h-3 w-3" />,
  "token-spent": <ArrowDownLeft className="h-3 w-3" />,
};

export default function Profile() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const profile = useProfileStore((s) => s.profile);
  const balance = useProfileStore((s) => s.balance);
  const logs = useProfileStore((s) => s.logs);

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 p-4 sm:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[20px] font-medium tracking-tight text-foreground">Profile</h1>
        <p className="text-[12px] text-muted-foreground/40 mt-1">Your account and token overview</p>
      </motion.div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="lg:col-span-1">
          <div className="rounded-xl border border-border/30 bg-card/20 p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-muted/60 to-muted/30 text-[18px] font-semibold text-foreground/70">
                  {profile.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-[16px] font-medium text-foreground">{profile.name}</h2>
                  <p className="text-[12px] text-muted-foreground/40">{profile.email}</p>
                  <p className="text-[11px] text-muted-foreground/30 mt-0.5">Member since {profile.joinedAt.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground/50 leading-relaxed">{profile.bio}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.healthGoals.map((goal) => (
                <span key={goal} className="px-2.5 py-1 rounded-full border border-border/30 bg-muted/20 text-[11px] text-muted-foreground/50">{goal}</span>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 h-7 text-[11px] text-muted-foreground/40 hover:text-destructive/70 gap-1 w-full justify-start"
              onClick={() => { logout(); navigate("/login"); }}
            >
              <LogOut className="h-3 w-3" /> Sign out
            </Button>
          </div>
        </motion.div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Token Balance */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TokenCard label="Available" value={balance.aura} icon={<Wallet className="h-4 w-4" />} />
            <TokenCard label="Staked" value={balance.staked} icon={<Lock className="h-4 w-4" />} />
            <TokenCard label="Earned" value={balance.earned} icon={<TrendingUp className="h-4 w-4" />} accent />
            <TokenCard label="Spent" value={balance.spent} icon={<ArrowUpRight className="h-4 w-4" />} />
          </motion.div>

          {/* Connected Devices */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <h3 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40 mb-3">Connected devices</h3>
            <div className="flex flex-wrap gap-2">
              {profile.connectedDevices.map((device) => (
                <div key={device} className="flex items-center gap-2 rounded-lg border border-border/30 bg-card/20 px-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400/60" />
                  <span className="text-[11px] text-foreground/70">{device}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Activity Log */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <h3 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40 mb-3">Activity</h3>
            <div className="rounded-xl border border-border/30 bg-card/20 p-3">
              <div className="space-y-0.5">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-card/30">
                    <div className="text-muted-foreground/25">{logIcons[log.type]}</div>
                    <span className="text-[12px] text-foreground/70 flex-1">{log.description}</span>
                    {log.tokens !== undefined && (
                      <span className={cn("text-[11px] font-medium", log.tokens > 0 ? "text-emerald-400/60" : "text-red-400/60")}>
                        {log.tokens > 0 ? "+" : ""}{log.tokens}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/20">{log.timestamp.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function TokenCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border/30 bg-card/20 px-4 py-3", accent && "border-emerald-500/10 bg-emerald-500/[0.03]")}>
      <div className="flex items-center gap-2 text-muted-foreground/30 mb-1">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <p className={cn("text-[18px] font-medium", accent ? "text-emerald-400/80" : "text-foreground")}>{value.toLocaleString()}</p>
    </div>
  );
}
