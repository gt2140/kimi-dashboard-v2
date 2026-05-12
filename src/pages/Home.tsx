import { useNavigate, Navigate } from "react-router";
import { motion } from "framer-motion";
import { Sparkles, Brain, Shield, ArrowRight, Activity, FileText, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const manifestoParagraphs = [
  "Money became programmable. Information became infinite. Intelligence is becoming abundant. Health must be next.",
  "For too long, access to high-quality medical intelligence has depended on geography, institutions, capital, bureaucracy, and closed systems.",
  "But the body is producing more signal than ever.",
  "Blood panels, medical imaging, biomarkers, wearables, genomics, protocols, symptoms, interventions, recovery patterns, cognitive signals, research, and outcomes are all becoming part of the same living map of human health.",
  "The problem is no longer the absence of data. The problem is the absence of intelligence that can hold it together.",
  "AURA is built for this next frontier.",
  "A private intelligence network for the future of health.",
  "Not only for personal tracking. Not only for diagnostics. Not only for research.",
  "But for the full intelligence layer medicine is missing.",
  "A system where fragmented health signals become structured memory. Where medical reasoning becomes more continuous. Where research is organized, compared, challenged, and made usable. Where agents help detect patterns across complex biological context. Where information is not blindly trusted, but evaluated, scored, and improved. Where clinicians, researchers, builders, validators, and users can contribute to better health intelligence without surrendering privacy.",
  "We believe medical intelligence should not be biased by closed incentives, institutional bottlenecks, outdated systems, or whoever controls access to the data.",
  "It should be private when it must be private. Open when it can be open. Verifiable when it matters. Accessible wherever people need it.",
  "AURA is not another wellness app. It is not a chatbot. It is not a closed medical record.",
  "It is an intelligence layer for advanced health.",
  "A network where useful work improves agents, datasets, models, evaluations, and workflows. Where contributors are rewarded for building better health intelligence. Where private context becomes the foundation for better decisions, earlier detection, deeper research, and more personalized care.",
  "The future of medicine will not be built only inside hospitals, labs, or pharmaceutical companies.",
  "It will be built by networks.",
  "Private. Intelligent. Open to contribution. Aligned around better health outcomes.",
  "AURA exists to make the best medical intelligence more accessible.",
  "Not only for those with the best doctors. Not only for the richest cities. Not only for the institutions with the most resources.",
  "With internet, AI, private memory, specialized agents, and aligned contributors, advanced health intelligence can reach more people, more places, and more contexts than ever before.",
  "AURA is built to help make that possible.",
  "To structure the signal. To remove the noise. To expand access. To reward useful work. To push medicine forward.",
  "Build the intelligence layer for the future of health.",
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
              Private <span className="text-gradient">Health Intelligence</span>
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-lg text-muted-foreground">
              AURA organizes biomarker data, research, protocols, and personal context into
              a structured intelligence layer for advanced health work.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" onClick={() => navigate("/login")}>
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#manifesto">
                  Manifesto <FileText className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </motion.div>
        </section>

        <section className="border-t border-border bg-card/20 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-8 sm:grid-cols-3">
              <FeatureCard
                icon={<Database className="h-6 w-6 text-primary" />}
                title="Structured Memory"
                description="Labs, protocols, notes, and research stay connected so important context compounds instead of disappearing."
              />
              <FeatureCard
                icon={<Shield className="h-6 w-6 text-emerald-400" />}
                title="Private By Default"
                description="Sensitive health context stays protected with an architecture designed around privacy, control, and trust."
              />
              <FeatureCard
                icon={<Activity className="h-6 w-6 text-amber-400" />}
                title="Continuous Signal"
                description="Track biomarkers, interventions, and outcomes over time so health decisions reflect the full picture."
              />
            </div>
          </div>
        </section>

        <section id="manifesto" className="border-t border-border py-20">
          <div className="mx-auto max-w-4xl px-4">
            <div className="mb-12 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                AURA Manifesto
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Build the intelligence layer for the future of health.
              </h2>
            </div>

            <div className="rounded-3xl border border-border bg-card/60 p-6 text-left shadow-sm sm:p-10">
              <div className="space-y-6">
                {manifestoParagraphs.map((paragraph) => (
                  <p key={paragraph} className="text-base leading-8 text-foreground/88 sm:text-lg">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>AURA Dashboard - Health Intelligence Platform</p>
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
    <div className="rounded-xl border border-border bg-card/50 p-6 text-left">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
