import {
  buildPendingTurnStages,
  type PendingTurnStage,
} from "@/lib/chat-experience";

export const STARTING_TURN_STAGE: PendingTurnStage = {
  id: "starting",
  label: "Starting turn",
};

export function createInitialPendingStages(input?: {
  primaryAgentId: string;
  helperAgentIds: string[];
  userMessage: string;
}) {
  if (!input) {
    return [STARTING_TURN_STAGE];
  }

  return buildPendingTurnStages(input);
}

export function applyRuntimeStageUpdate(
  current: PendingTurnStage[],
  nextStage: PendingTurnStage,
) {
  if (current.length === 1 && current[0]?.id === STARTING_TURN_STAGE.id) {
    return [nextStage];
  }

  const existingIndex = current.findIndex(stage => stage.id === nextStage.id);
  if (existingIndex >= 0) {
    return current.map((stage, index) =>
      index === existingIndex ? nextStage : stage
    );
  }

  return [...current, nextStage];
}

export function resolveActiveStageIndex(stages: PendingTurnStage[]) {
  return stages.length > 0 ? stages.length - 1 : 0;
}
