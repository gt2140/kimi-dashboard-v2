import { Routes, Route, Navigate, useParams } from "react-router";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import KimiChat from "./pages/KimiChat";
import KimiAgents from "./pages/KimiAgents";
import KimiAgentSettings from "./pages/KimiAgentSettings";
import KimiVault from "./pages/KimiVault";
import Bounties from "./pages/Bounties";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/whitepaper" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/agents" element={<Navigate to="/kimi/agents" replace />} />
        <Route path="/agents/:agentId" element={<LegacyAgentRedirect />} />
        <Route path="/chat" element={<Navigate to="/kimi/chat" replace />} />
        <Route path="/vault" element={<Navigate to="/kimi/vault" replace />} />
        <Route path="/kimi/chat" element={<KimiChat />} />
        <Route path="/kimi/agents" element={<KimiAgents />} />
        <Route path="/kimi/agents/:agentId" element={<KimiAgentSettings />} />
        <Route path="/kimi/vault" element={<KimiVault />} />
        <Route path="/bounties" element={<Bounties />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function LegacyAgentRedirect() {
  const { agentId } = useParams();
  return <Navigate to={`/kimi/agents/${agentId ?? "generalist"}`} replace />;
}
