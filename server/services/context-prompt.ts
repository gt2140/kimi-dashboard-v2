type PromptMessage = {
  role: string;
  content: string;
};

type AccessibleFile = {
  filename: string;
  category: string;
};

type SupportingNote = {
  agentName: string;
  content: string;
  status: "completed" | "failed";
};

type ContextDiagnosticsInput = {
  recentMessages: PromptMessage[];
  accessibleFiles: AccessibleFile[];
  conversationSummary: string | null;
  customContext: string | null;
  trainingNotes: string | null;
  allowVaultContext: boolean;
};

type PromptContextInput = ContextDiagnosticsInput & {
  userMessage: string;
  consultationRationale?: string | null;
  supportingNotes?: SupportingNote[];
  taskInstruction: string;
};

function renderTag(tag: string, content: string) {
  return `<${tag}>\n${content}\n</${tag}>`;
}

function renderList(items: string[]) {
  return items.length > 0 ? items.map(item => `- ${item}`).join("\n") : "- none";
}

function truncateText(content: string, maxLength: number) {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength - 3)}...`;
}

export function buildContextSummary(params: ContextDiagnosticsInput) {
  const parts = [
    `${params.recentMessages.length} recent message${
      params.recentMessages.length === 1 ? "" : "s"
    }`,
    params.allowVaultContext
      ? `${params.accessibleFiles.length} vault file${
          params.accessibleFiles.length === 1 ? "" : "s"
        }`
      : "vault context disabled",
    params.conversationSummary
      ? "conversation summary available"
      : "no conversation summary yet",
    params.customContext
      ? "custom agent context enabled"
      : "no custom agent context",
    params.trainingNotes ? "training notes enabled" : "no training notes",
  ];

  return parts.join(" | ");
}

export function collectMissingContext(params: ContextDiagnosticsInput) {
  const missing: string[] = [];

  if (params.allowVaultContext && params.accessibleFiles.length === 0) {
    missing.push("No compatible vault files were available for this turn.");
  }

  if (!params.conversationSummary) {
    missing.push("This conversation does not have a long-form summary yet.");
  }

  if (!params.customContext && !params.trainingNotes) {
    missing.push("No user-specific agent guidance is configured yet.");
  }

  return missing;
}

export function formatPromptContext(input: PromptContextInput) {
  const recentMessages = input.recentMessages.slice(-6);
  const accessibleFiles = input.accessibleFiles.slice(0, 6);
  const supportingNotes = (input.supportingNotes ?? []).slice(0, 3);
  const missingContext = collectMissingContext(input);
  const contextSnapshot = buildContextSummary(input);
  const recentMessagesBlock = renderList(
    [
      ...recentMessages.map(
        message => `${message.role}: ${truncateText(message.content, 500)}`
      ),
      ...(input.recentMessages.length > recentMessages.length
        ? [
            `...${input.recentMessages.length - recentMessages.length} earlier message(s) omitted for brevity.`,
          ]
        : []),
    ]
  );
  const accessibleFilesBlock = renderList(
    [
      ...accessibleFiles.map(file => `${file.filename} (${file.category})`),
      ...(input.accessibleFiles.length > accessibleFiles.length
        ? [
            `...${input.accessibleFiles.length - accessibleFiles.length} additional compatible file(s) omitted for brevity.`,
          ]
        : []),
    ]
  );
  const supportingNotesBlock = renderList(
    [
      ...supportingNotes.map(
        note =>
          `${note.agentName}: ${truncateText(note.content, 700)}${
            note.status === "failed" ? " [fallback]" : ""
          }`
      ),
      ...((input.supportingNotes ?? []).length > supportingNotes.length
        ? [
            `...${
              (input.supportingNotes ?? []).length - supportingNotes.length
            } additional specialist note(s) omitted for brevity.`,
          ]
        : []),
    ]
  );

  return [
    renderTag("task", input.taskInstruction),
    renderTag("user_message", input.userMessage),
    renderTag("context_snapshot", contextSnapshot),
    renderTag(
      "conversation_summary",
      input.conversationSummary ?? "none"
    ),
    renderTag("recent_messages", recentMessagesBlock),
    renderTag("accessible_vault_context", accessibleFilesBlock),
    renderTag(
      "user_specific_context",
      input.customContext ?? "none"
    ),
    renderTag("training_notes", input.trainingNotes ?? "none"),
    renderTag(
      "consultation_rationale",
      input.consultationRationale ?? "none"
    ),
    renderTag("supporting_notes", supportingNotesBlock),
    renderTag("missing_context", renderList(missingContext)),
    renderTag(
      "operating_rules",
      [
        "- Work with the supplied context plus your general knowledge.",
        "- If a file is only listed by name, do not pretend you saw its contents.",
        "- If information is missing, say what is missing and how it would change confidence.",
      ].join("\n")
    ),
  ].join("\n\n");
}
