import { Routes, Route, Navigate } from "react-router";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import AgentSettingsPage from "./pages/AgentSettings";
import Chat from "./pages/Chat";
import Vault from "./pages/Vault";
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
        <Route path="/agents" element={<Agents />} />
        <Route path="/agents/:agentId" element={<AgentSettingsPage />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/vault" element={<Vault />} />
        <Route path="/predictions" element={<Predictions />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
