import type { ReactNode } from "react";
import { Navigate, useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Database,
  FileText,
  GitBranch,
  KeyRound,
  LockKeyhole,
  Network,
  Route,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const thesisCards = [
  {
    label: "Problem",
    title: "Health context is fragmented.",
    text: "Labs, imaging, wearables, genomics, protocols, symptoms, research, and outcomes exist in separate systems. The missing layer is not more data capture. It is private context that can be reasoned over continuously.",
  },
  {
    label: "System",
    title: "AURA turns context into usable intelligence.",
    text: "The Vault preserves user-owned memory, specialized agents reason within scoped domains, and orchestration routes the right context to the right workflow.",
  },
  {
    label: "Network",
    title: "Useful work improves the intelligence layer.",
    text: "Researchers, clinicians, builders, validators, and users can contribute better agents, datasets, evaluations, workflows, and research packs.",
  },
];

const systemLayers = [
  {
    icon: <Database className="h-5 w-5" />,
    title: "The Vault",
    kicker: "Private health memory",
    text: "A user-owned memory layer for labs, biomarkers, notes, protocols, research, wearable signals, symptoms, interventions, and outcomes.",
  },
  {
    icon: <BrainCircuit className="h-5 w-5" />,
    title: "Agent Layer",
    kicker: "Specialized reasoning",
    text: "Domain agents for bloodwork, research synthesis, supplements, protocol review, wearables, safety checks, and cross-domain health questions.",
  },
  {
    icon: <Route className="h-5 w-5" />,
    title: "Orchestration",
    kicker: "Routing and evaluation",
    text: "A coordination layer that classifies requests, retrieves scoped context, selects agents, structures outputs, and decides what should be remembered.",
  },
];

const requirements = [
  "Privacy is architectural, not cosmetic.",
  "Memory lets health intelligence compound.",
  "Specialization creates clearer reasoning boundaries.",
  "Evaluation keeps fluent answers from becoming false trust.",
  "Coordination rewards work that improves the system.",
];

const contributionTypes = [
  "Agent development",
  "Research packs",
  "Dataset curation",
  "Benchmark design",
  "Output validation",
  "Safety review",
  "Workflow design",
  "Vault integrations",
];

const tokenRows = [
  ["Max supply", "100,000,000 AURA"],
  ["Genesis allocation", "50,000,000 AURA"],
  ["Post-launch emissions", "50,000,000 AURA over 8 years"],
  ["Default split", "80% Proof of Useful Work / 20% staking"],
  ["Team allocation", "10%, vested over 3 years"],
  ["Initial chain", "Base"],
];

const roadmap = [
  {
    phase: "Phase 1",
    title: "Product Foundation",
    text: "Vault MVP, authentication, file upload, structured extraction, core agents, orchestration v1, and early access feedback loops.",
  },
  {
    phase: "Phase 2",
    title: "Network Formation",
    text: "Contributor onboarding, Genesis Proof of Useful Work, research packs, benchmarks, validator workflows, and a public task board.",
  },
  {
    phase: "Phase 3",
    title: "Token Utility",
    text: "AURA token launch, staking, utility credits, transparent reward epochs, burns for unearned allocation, and early governance committees.",
  },
  {
    phase: "Phase 4",
    title: "Institutional Workflows",
    text: "Lab integrations, wearable imports, clinic pilots, advanced Vault features, compliance infrastructure, and research partnerships.",
  },
  {
    phase: "Phase 5",
    title: "Long-Term Network",
    text: "Agent marketplace, contributor marketplace, dataset marketplace, protocol evaluation, bounties, deployments, and progressive governance.",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-[#f6f1e7] text-[#171a16]">
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(90deg,rgba(25,29,23,0.05)_1px,transparent_1px),linear-gradient(180deg,rgba(25,29,23,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_8%,rgba(110,130,104,0.24),transparent_30%),radial-gradient(circle_at_84%_20%,rgba(58,90,113,0.2),transparent_28%),linear-gradient(180deg,#fbf7ee_0%,#efe7d7_62%,#e4dccb_100%)]" />

      <header className="sticky top-0 z-20 border-b border-[#171a16]/10 bg-[#fbf7ee]/86 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center border border-[#171a16]/20 bg-[#171a16] text-[13px] font-semibold text-[#fbf7ee]">
              A
            </span>
            <span className="font-serif text-xl tracking-normal">AURA</span>
          </a>
          <nav className="hidden items-center gap-6 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#171a16]/58 md:flex">
            <a className="transition hover:text-[#171a16]" href="#system">
              System
            </a>
            <a className="transition hover:text-[#171a16]" href="#network">
              Network
            </a>
            <a className="transition hover:text-[#171a16]" href="#token">
              Token
            </a>
            <a className="transition hover:text-[#171a16]" href="#roadmap">
              Roadmap
            </a>
          </nav>
          <Button
            onClick={() => navigate("/login")}
            className="h-10 rounded-none bg-[#171a16] px-5 text-[#fbf7ee] hover:bg-[#2a3027]"
          >
            Enter App
          </Button>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.04fr_0.96fr] lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-3xl"
          >
            <div className="mb-8 inline-flex items-center gap-3 border-y border-[#171a16]/20 py-2 pr-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4e5d48]">
              <FileText className="h-4 w-4" />
              Whitepaper brief / 2026
            </div>
            <h1 className="font-serif text-5xl leading-[0.95] tracking-normal text-[#11140f] sm:text-6xl lg:text-7xl">
              Private health intelligence, built as infrastructure.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#34392f]/82">
              AURA proposes a private intelligence network for advanced health:
              a Vault for user-owned context, specialized agents for domain
              reasoning, orchestration for memory and evaluation, and a tokenized
              mechanism for rewarding useful work.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => navigate("/login")}
                className="h-12 rounded-none bg-[#171a16] px-6 text-[#fbf7ee] hover:bg-[#2a3027]"
              >
                Open Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 rounded-none border-[#171a16]/25 bg-transparent px-6 text-[#171a16] hover:bg-[#171a16]/5"
              >
                <a href="#abstract">Read the brief</a>
              </Button>
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.55 }}
            className="border border-[#171a16]/16 bg-[#fbf7ee]/72 p-5 shadow-[18px_18px_0_rgba(23,26,22,0.08)] backdrop-blur"
          >
            <div className="border border-[#171a16]/14 bg-[#f7f0e3] p-6">
              <div className="flex items-start justify-between gap-6 border-b border-[#171a16]/16 pb-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c2f26]">
                    Core Thesis
                  </p>
                  <h2 className="mt-3 font-serif text-3xl leading-tight">
                    Advanced health requires a private intelligence layer.
                  </h2>
                </div>
                <Stethoscope className="h-8 w-8 text-[#4d6249]" />
              </div>
              <div className="grid gap-4 py-6">
                {[
                  ["Memory", "Context persists across labs, protocols, symptoms, and outcomes."],
                  ["Scope", "Agents receive only the context required for the task."],
                  ["Trust", "Outputs are judged by evidence, safety, structure, and usefulness."],
                ].map(([title, text]) => (
                  <div key={title} className="grid grid-cols-[6.5rem_1fr] gap-4">
                    <p className="font-serif text-lg text-[#171a16]">{title}</p>
                    <p className="text-sm leading-6 text-[#34392f]/78">{text}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#171a16]/16 pt-5">
                <p className="text-sm leading-6 text-[#34392f]/80">
                  AURA does not replace doctors, laboratories, or clinical
                  judgment. It creates infrastructure around them: organized
                  memory, specialized reasoning, and evaluated contribution.
                </p>
              </div>
            </div>
          </motion.aside>
        </section>

        <section id="abstract" className="border-y border-[#171a16]/12 bg-[#171a16] py-14 text-[#f9f4e8]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b8c5a8]">
                Executive Abstract
              </p>
              <h2 className="mt-4 font-serif text-4xl leading-tight">
                From fragmented health data to reusable intelligence.
              </h2>
            </div>
            <div className="grid gap-5 text-base leading-8 text-[#f9f4e8]/78">
              <p>
                Modern health is becoming data-rich, but the systems used to
                interpret it remain fragmented, episodic, and institutionally
                constrained. A lab result is data. A sequence of lab results
                over time is context. A pattern interpreted against symptoms,
                interventions, research, and outcomes is intelligence.
              </p>
              <p>
                AURA is designed for that gap. It combines private memory,
                specialized agents, orchestration, evaluation, and contribution
                incentives so health context can become structured, private,
                continuous, and useful across repeated decisions.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {thesisCards.map((card, index) => (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: index * 0.06, duration: 0.45 }}
                className="border border-[#171a16]/14 bg-[#fbf7ee]/70 p-6"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c2f26]">
                  {card.label}
                </p>
                <h3 className="mt-5 font-serif text-2xl leading-tight">{card.title}</h3>
                <p className="mt-4 text-sm leading-7 text-[#34392f]/78">{card.text}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <PaperSection
          id="system"
          eyebrow="The AURA System"
          title="Vault, agents, orchestration: one private reasoning loop."
          intro="The product architecture is intentionally simple at the surface and disciplined underneath. Users should not need to understand the machinery; the system should preserve context, route work, evaluate outputs, and remember what matters."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {systemLayers.map((layer) => (
              <article key={layer.title} className="border border-[#171a16]/14 bg-[#f8f1e5] p-6">
                <div className="flex h-10 w-10 items-center justify-center border border-[#171a16]/18 bg-[#171a16] text-[#f9f4e8]">
                  {layer.icon}
                </div>
                <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#4d6249]">
                  {layer.kicker}
                </p>
                <h3 className="mt-2 font-serif text-2xl">{layer.title}</h3>
                <p className="mt-4 text-sm leading-7 text-[#34392f]/78">{layer.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 grid gap-4 border border-[#171a16]/14 bg-[#fbf7ee]/70 p-6 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c2f26]">
                Scoped Reasoning
              </p>
              <h3 className="mt-3 font-serif text-3xl leading-tight">
                The right agent sees the right context.
              </h3>
            </div>
            <p className="text-sm leading-7 text-[#34392f]/80">
              A bloodwork agent does not need every personal note. A research
              agent does not need unrelated private history. A protocol review
              may need medication context, allergies, biomarkers, goals, and
              prior responses. Scoped reasoning protects privacy, reduces noise,
              and creates clearer evaluation boundaries.
            </p>
          </div>
        </PaperSection>

        <PaperSection
          id="trust"
          eyebrow="Quality Standard"
          title="The hard part is not generating answers. It is earning trust."
          intro="Health intelligence cannot be judged by fluency alone. AURA needs evidence comparison, uncertainty, safety boundaries, human review, and feedback loops that make the system better over time."
        >
          <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="border border-[#171a16]/14 bg-[#171a16] p-6 text-[#f9f4e8]">
              <ShieldCheck className="h-8 w-8 text-[#b8c5a8]" />
              <h3 className="mt-6 font-serif text-3xl leading-tight">
                Five requirements for serious health intelligence.
              </h3>
              <div className="mt-6 space-y-4">
                {requirements.map((item) => (
                  <div key={item} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#b8c5a8]" />
                    <p className="text-sm leading-6 text-[#f9f4e8]/78">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SignalCard icon={<LockKeyhole />} title="Privacy" text="Sensitive context remains permissioned and minimized by task." />
              <SignalCard icon={<ClipboardCheck />} title="Evaluation" text="Agents, datasets, workflows, and research outputs are scored for quality and safety." />
              <SignalCard icon={<BookOpenCheck />} title="Evidence" text="Research is compared, graded, contextualized, and updated instead of treated as static reference." />
              <SignalCard icon={<GitBranch />} title="Continuity" text="Insights, hypotheses, outcomes, and caveats can persist across future sessions." />
            </div>
          </div>
        </PaperSection>

        <PaperSection
          id="network"
          eyebrow="Product To Network"
          title="AURA starts as a product. It becomes a network as useful work compounds."
          intro="The early product creates utility for high-intent users working with labs, biomarkers, protocols, research, and advanced health decisions. The network emerges when contributors improve the intelligence layer itself."
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="border border-[#171a16]/14 bg-[#fbf7ee]/70 p-6">
              <div className="flex items-center gap-3">
                <Network className="h-6 w-6 text-[#4d6249]" />
                <h3 className="font-serif text-3xl">Proof of Useful Work</h3>
              </div>
              <p className="mt-5 text-sm leading-7 text-[#34392f]/80">
                AURA should reward contributions that are useful, reviewable,
                and connected to the intelligence layer. The goal is not to
                reward empty activity, content volume, or speculative noise. The
                goal is to make the system more accurate, safer, more reusable,
                and more operationally valuable.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {contributionTypes.map((item) => (
                  <div
                    key={item}
                    className="border border-[#171a16]/12 bg-[#f7f0e3] px-4 py-3 text-sm font-medium text-[#293025]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-[#171a16]/14 bg-[#f8f1e5] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c2f26]">
                Contribution Lifecycle
              </p>
              <div className="mt-6 space-y-5">
                {["Proposal", "Sandbox testing", "Limited deployment", "Evaluation", "Broader release", "Continuous monitoring"].map((step, index) => (
                  <div key={step} className="flex items-center gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#171a16]/18 bg-[#fbf7ee] font-serif text-sm">
                      {index + 1}
                    </span>
                    <p className="text-sm font-medium text-[#34392f]">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PaperSection>

        <PaperSection
          id="token"
          eyebrow="AURA Tokenomics"
          title="The token coordinates improvement. It is not the product."
          intro="The strongest version of AURA keeps the product thesis first. Token design should support contribution rewards, utility alignment, staking access, validator eligibility, and progressive governance without crowding out trust."
        >
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="border border-[#171a16]/14 bg-[#171a16] p-6 text-[#f9f4e8]">
              <Coins className="h-8 w-8 text-[#d7b46a]" />
              <h3 className="mt-6 font-serif text-4xl leading-none">100M</h3>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d7b46a]">
                Fixed maximum supply
              </p>
              <p className="mt-6 text-sm leading-7 text-[#f9f4e8]/76">
                No unlimited minting, discretionary inflation, or hidden supply
                expansion. Tokens are earned, allocated with discipline, or
                removed through burn mechanisms when not used productively.
              </p>
            </div>
            <div className="border border-[#171a16]/14 bg-[#fbf7ee]/70">
              {tokenRows.map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-2 border-b border-[#171a16]/12 px-5 py-4 last:border-b-0 sm:grid-cols-[12rem_1fr]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4d6249]">
                    {label}
                  </p>
                  <p className="font-serif text-xl leading-snug text-[#171a16]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </PaperSection>

        <PaperSection
          id="roadmap"
          eyebrow="Roadmap"
          title="Build the product first. Open the network with discipline."
          intro="The sequence matters: prove real product utility, curate the first contributors carefully, then expand token rewards, integrations, marketplaces, and governance as quality standards mature."
        >
          <div className="grid gap-4">
            {roadmap.map((item) => (
              <article
                key={item.phase}
                className="grid gap-4 border border-[#171a16]/14 bg-[#fbf7ee]/70 p-5 md:grid-cols-[9rem_14rem_1fr]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c2f26]">
                  {item.phase}
                </p>
                <h3 className="font-serif text-2xl leading-tight">{item.title}</h3>
                <p className="text-sm leading-7 text-[#34392f]/78">{item.text}</p>
              </article>
            ))}
          </div>
        </PaperSection>

        <section className="border-t border-[#171a16]/12 bg-[#171a16] px-4 py-16 text-[#f9f4e8] sm:px-6">
          <div className="mx-auto max-w-5xl text-center">
            <KeyRound className="mx-auto h-8 w-8 text-[#b8c5a8]" />
            <h2 className="mt-6 font-serif text-4xl leading-tight sm:text-5xl">
              Structure the signal. Preserve context. Reward useful work.
            </h2>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-[#f9f4e8]/72">
              AURA is strongest when it presents itself as serious health
              infrastructure: privacy first, product first, evidence-aware, and
              careful about the economic layer it introduces.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#171a16]/12 bg-[#fbf7ee] px-4 py-7 text-center text-[12px] font-semibold uppercase tracking-[0.18em] text-[#171a16]/48 sm:px-6">
        AURA / Private Health Intelligence Network
      </footer>
    </div>
  );
}

function PaperSection({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      <div className="mb-9 grid gap-6 border-t border-[#171a16]/18 pt-7 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7c2f26]">
            {eyebrow}
          </p>
          <h2 className="mt-4 max-w-3xl font-serif text-4xl leading-tight text-[#11140f] sm:text-5xl">
            {title}
          </h2>
        </div>
        <p className="max-w-3xl text-base leading-8 text-[#34392f]/78">{intro}</p>
      </div>
      {children}
    </section>
  );
}

function SignalCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="border border-[#171a16]/14 bg-[#fbf7ee]/70 p-5">
      <div className="flex h-10 w-10 items-center justify-center border border-[#171a16]/14 bg-[#f7f0e3] text-[#4d6249]">
        {icon}
      </div>
      <h3 className="mt-5 font-serif text-2xl">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[#34392f]/78">{text}</p>
    </article>
  );
}
