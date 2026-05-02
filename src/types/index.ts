export interface Agent {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  icon: string;
  color: string;
  systemPrompt: string;
  allowedVaultCategories: string[];
  source?: "built-in" | "marketplace";
  author?: string;
  installs?: number;
  rating?: number;
  tags?: string[];
}

export interface AgentSettings {
  agentId: string;
  vaultAccess: string[];
  canSearchWeb: boolean;
  customContext: string;
  responseStyle: "concise" | "detailed" | "academic";
  autoSuggest: boolean;
  enabled: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentId: string;
  timestamp: Date;
  metadata?: {
    sources?: string[];
    confidence?: number;
    relatedVaultFiles?: string[];
    calledAgents?: string[];
    orchestrationMode?: string;
    note?: string;
    responseMode?: "model" | "limited";
    consultedAgentNames?: string[];
    consultationMode?: "none" | "explicit" | "auto";
    consultationReason?: string;
    contextSummary?: string;
    missingContext?: string[];
    executionNotes?: string[];
    providerSlug?: string;
    modelName?: string;
    requestedProviderSlug?: string;
    requestedModelName?: string;
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface VaultFile {
  id: string;
  filename: string;
  fileType?: string;
  category:
    | "bloodwork"
    | "genetics"
    | "wearables"
    | "body-composition"
    | "notes"
    | "other";
  size: number;
  uploadedAt: Date;
  updatedAt?: Date;
  status?: "ready" | "processing" | "failed";
  url?: string;
  encrypted?: boolean;
}

export interface ChatSession {
  id: string;
  agentId: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Prediction {
  id: string;
  title: string;
  description: string;
  objective: string;
  validationCriteria: string;
  rewardTokens: number;
  status: "open" | "in-progress" | "resolved" | "expired";
  createdBy: string;
  createdAt: Date;
  deadline: Date;
  responses: PredictionResponse[];
  bestResponseId?: string;
  category: string;
}

export interface PredictionResponse {
  id: string;
  predictionId: string;
  responderId: string;
  responderName: string;
  content: string;
  confidence: number;
  votes: number;
  createdAt: Date;
  status: "pending" | "accepted" | "rejected";
}

export interface TokenBalance {
  aura: number;
  staked: number;
  earned: number;
  spent: number;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  bio: string;
  joinedAt: Date;
  healthGoals: string[];
  connectedDevices: string[];
}

export interface ActivityLog {
  id: string;
  type:
    | "chat"
    | "vault-upload"
    | "prediction-created"
    | "prediction-won"
    | "prediction-responded"
    | "token-earned"
    | "token-spent";
  description: string;
  tokens?: number;
  timestamp: Date;
}
