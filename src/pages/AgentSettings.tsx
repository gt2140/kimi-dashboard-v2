import { useNavigate } from "react-router";
import { MvpNotice } from "@/components/MvpNotice";

export default function AgentSettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <MvpNotice
        title="Agent settings are read-only for now"
        description="Per-agent settings were still stored only in browser state, so they are not part of the stable MVP. Agents can still be used for chat, but persistent settings will return once they are backed by the API and database."
        actionLabel="Back to agents"
        onAction={() => navigate("/agents")}
      />
    </div>
  );
}
