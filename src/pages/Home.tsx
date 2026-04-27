import { useNavigate, Navigate } from "react-router";
import { motion } from "framer-motion";
import { Sparkles, Brain, Shield, ArrowRight, Activity, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">AURA</span>
          </div>
          <Button onClick={() => navigate("/login")}>Sign In</Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Your Personal <span className="text-gradient">Health Intelligence</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              AURA analyzes your bloodwork, genetics, body composition, and wearable data
              to provide personalized, evidence-based health insights.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Button size="lg" onClick={() => navigate("/login")}>
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/login")}>
                View Demo
              </Button>
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section className="border-t border-border bg-card/20 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-8 sm:grid-cols-3">
              <FeatureCard
                icon={<MessageSquare className="h-6 w-6 text-primary" />}
                title="AI-Powered Chat"
                description="Specialized agents for bloodwork, nutrition, supplements, peptides, and psychedelics with scoped vault access."
              />
              <FeatureCard
                icon={<Shield className="h-6 w-6 text-emerald-400" />}
                title="Encrypted Vault"
                description="Client-side AES-256 encryption before upload. Your data never touches our servers unencrypted."
              />
              <FeatureCard
                icon={<Activity className="h-6 w-6 text-amber-400" />}
                title="Biomarker Tracking"
                description="Visualize trends across bloodwork panels, body composition scans, and wearable metrics over time."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>AURA Dashboard — Health Intelligence Platform</p>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
