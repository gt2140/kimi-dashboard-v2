import { Routes, Route, Navigate } from "react-router";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import KimiChat from "./pages/KimiChat";
import Predictions from "./pages/Predictions";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/agents" element={<Navigate to="/kimi/agents" replace />} />
        <Route path="/agents/:agentId" element={<LegacyAgentRedirect />} />
        <Route path="/chat" element={<Navigate to="/kimi/chat" replace />} />
        <Route path="/vault" element={<Navigate to="/kimi/chat" replace />} />
        <Route path="/kimi/chat" element={<KimiChat />} />
        <Route path="/kimi/agents" element={<Navigate to="/kimi/chat" replace />} />
        <Route path="/kimi/agents/:agentId" element={<Navigate to="/kimi/chat" replace />} />
        <Route path="/kimi/vault" element={<Navigate to="/kimi/chat" replace />} />
        <Route path="/predictions" element={<Predictions />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function LegacyAgentRedirect() {
  return <Navigate to="/kimi/chat" replace />;
}
