# Conversational Architecture Blueprint

> Status: historical design blueprint. The production MVP chat path is now Venice-first and documented in [Active Chat Runtime](./active-chat-runtime.md). Use this document for future agent architecture ideas, not as the current production chat contract.

## Goal

Build the first real conversational layer of Aura around a single scalable agent engine.

This layer should:

- validate the MVP with real users and real model APIs
- support one primary agent plus optional supporting agents
- persist per-user agent configuration
- attach user-specific context to each run
- stay provider-agnostic across OpenAI, Anthropic, Kimi, DeepSeek, and future vendors
- avoid treating each agent as a separate backend system

The core principle is:

> every agent uses the same execution engine, and only varies by prompt, allowed context, capabilities, preferred model, and orchestration role.

---

## Product Model

### What changes from the current MVP

Today the frontend presents agents as product entities, but the backend still treats them mostly as static records in code.

For the next phase, the product model should be:

1. `agent_definition`
   Global marketplace definition of an agent.
   Example: `Generalist`, `Bloodwork`, `Research Synthesizer`.

2. `user_agent_setting`
   Per-user configuration for that agent.
   Example:
   - favorite or not
   - custom context
   - response style
   - whether it may use vault
   - whether it may use scientific web research

3. `conversation_agent`
   How that agent participates inside a specific chat.
   Example:
   - primary agent
   - supporting agent
   - synthesizer
   - reviewer

4. `agent_run`
   A concrete execution of that agent for one turn.
   Example:
   - what prompt was used
   - what context blocks were injected
   - what model/provider was called
   - what output came back
   - latency/cost/errors

This separation is important because it lets the same agent:

- exist globally in the marketplace
- be configured differently by each user
- play different roles in different chats

---

## Agent State Map

### Recommended architecture terms

- `marketplace`
  The agent exists in the catalog and can be discovered.

- `favorited`
  The user pinned the agent in the UI.
  This is a product/UI state, not an installation boundary.

- `configured`
  The user has saved settings for that agent.

- `active_in_chat`
  The agent is currently participating in a conversation.

- `primary`
  The main agent responsible for the final answer in a turn.

- `supporting`
  A specialist agent consulted by the primary agent.

- `reviewer`
  Optional second-pass agent used to critique or validate a draft.

### What not to model yet

Do not add separate installation semantics like plugin stores or isolated agent runtimes yet.
For the MVP, all agents should live in one catalog and share one engine.

That keeps the system simple while still allowing:

- favorites
- per-user settings
- chat participation
- future marketplace expansion

---

## Backend Design

## Core tables

### `agent_definitions`

Purpose:
store the global definition of each agent in the marketplace.

Suggested fields:

- `id`
- `slug`
- `name`
- `description`
- `long_description`
- `icon`
- `color`
- `status` (`active`, `draft`, `archived`)
- `visibility` (`public`, `internal`)
- `default_role` (`primary`, `supporting`, `reviewer`)
- `allowed_vault_categories` JSONB
- `capabilities` JSONB
- `default_provider_id` nullable
- `default_model_id` nullable
- `created_at`
- `updated_at`

Notes:

- `allowed_vault_categories` replaces the current hardcoded category permissions.
- `capabilities` may include flags like `web_search`, `scientific_search`, `vault_access`, `citation_mode`, `multi_agent_consult`.

### `prompt_templates`

Purpose:
version prompts independently from the agent definition.

Suggested fields:

- `id`
- `agent_definition_id`
- `kind` (`system`, `developer`, `planner`, `reviewer`, `synthesizer`)
- `version`
- `template_text`
- `is_active`
- `created_at`

Notes:

- This lets prompts evolve without losing history.
- Different prompt templates may be used for different orchestration steps.

### `user_agent_settings`

Purpose:
store per-user preferences and private agent configuration.

Suggested fields:

- `id`
- `user_id`
- `agent_definition_id`
- `is_favorite`
- `is_enabled`
- `custom_context`
- `training_notes`
- `response_style`
- `preferred_provider_id` nullable
- `preferred_model_id` nullable
- `allow_vault_context`
- `allow_web_research`
- `allow_scientific_research`
- `allowed_context_overrides` JSONB nullable
- `created_at`
- `updated_at`

Notes:

- This is where the new frontend settings screen will eventually persist.
- `Generalist` can still be force-pinned in product logic if desired.

### `model_providers`

Purpose:
register API vendors and available routing targets.

Suggested fields:

- `id`
- `slug` (`openai`, `anthropic`, `kimi`, `deepseek`)
- `name`
- `status`
- `base_url` nullable
- `auth_strategy`
- `supports_tools`
- `supports_streaming`
- `supports_json_mode`
- `supports_vision`
- `created_at`
- `updated_at`

Notes:

- Keeps the system provider-agnostic from day one.

### `model_endpoints`

Purpose:
store concrete models per provider.

Suggested fields:

- `id`
- `provider_id`
- `model_name`
- `label`
- `status`
- `input_cost_per_million` nullable
- `output_cost_per_million` nullable
- `supports_tools`
- `supports_reasoning`
- `supports_vision`
- `max_context_tokens` nullable
- `created_at`
- `updated_at`

Notes:

- The original prompt list only asked for `model_providers`, but in practice this table is strongly recommended.
- It avoids hardcoding model strings all over the app.

### `conversation_agents`

Purpose:
declare which agents are attached to a conversation.

Suggested fields:

- `id`
- `conversation_id`
- `agent_definition_id`
- `role` (`primary`, `supporting`, `reviewer`)
- `added_by_user` boolean
- `position`
- `is_active`
- `created_at`

Notes:

- A conversation should normally have exactly one active primary agent.
- It may have zero or more supporting agents.

### `message_context_blocks`

Purpose:
record what context was attached to a message or run.

Suggested fields:

- `id`
- `conversation_id`
- `message_id` nullable
- `agent_run_id` nullable
- `source_type` (`vault_file`, `vault_chunk`, `user_note`, `conversation_summary`, `agent_setting`, `web_result`, `scientific_result`, `manual_attachment`)
- `source_id` nullable
- `title` nullable
- `content`
- `metadata` JSONB
- `relevance_score` nullable
- `created_at`

Notes:

- This is the audit trail for “what context did this agent actually receive?”
- Very useful for debugging output quality.

### `agent_runs`

Purpose:
store each execution of an agent.

Suggested fields:

- `id`
- `conversation_id`
- `message_id`
- `agent_definition_id`
- `conversation_agent_id` nullable
- `parent_run_id` nullable
- `run_type` (`primary_reply`, `supporting_consult`, `review`, `synthesis`)
- `provider_id`
- `model_endpoint_id`
- `status` (`queued`, `running`, `completed`, `failed`)
- `input_messages_json` JSONB
- `resolved_system_prompt`
- `resolved_user_context`
- `output_text`
- `output_json` JSONB nullable
- `latency_ms` nullable
- `input_tokens` nullable
- `output_tokens` nullable
- `cost_usd` nullable
- `error_message` nullable
- `started_at` nullable
- `completed_at` nullable
- `created_at`

Notes:

- This is the operational heart of the system.
- It makes evaluation, cost control, and debugging possible.

---

## Recommended additions to existing tables

### `conversations`

Add:

- `status` (`active`, `archived`)
- `summary` nullable
- `orchestration_mode` (`single_agent`, `primary_plus_supporting`, `review_loop`)
- `last_agent_run_at` nullable

### `messages`

Add:

- `kind` (`user`, `assistant`, `system`, `tool`, `agent_internal`)
- `parent_message_id` nullable
- `finalized` boolean
- `visible_to_user` boolean default true

Notes:

- `agent_internal` messages are useful if later we want to store hidden agent-to-agent messages.
- For MVP v1, we can skip agent-to-agent raw messages from the user UI and only show the final synthesis.

---

## Execution Layer

## One engine, many agents

Create a backend service layer with these responsibilities:

### `AgentRegistryService`

Responsibilities:

- fetch agent definitions
- merge prompt templates
- merge user agent settings
- resolve final execution profile for a user + agent

### `ContextAssemblerService`

Responsibilities:

- collect recent conversation history
- inject conversation summary
- select allowed vault context
- inject agent custom context
- attach web/scientific research results if enabled
- write `message_context_blocks`

### `ModelGatewayService`

Responsibilities:

- expose a unified API for all LLM providers
- normalize request and response formats
- centralize retry, timeout, error handling
- centralize token/cost tracking

Suggested interface:

- `generateText()`
- `streamText()`
- `generateStructured()`
- `searchWeb()` optional later
- `searchScientific()` optional later

### `ConversationOrchestratorService`

Responsibilities:

- receive the user turn
- resolve the primary agent
- decide whether supporting agents are needed
- run supporting agents first if needed
- run synthesis on the primary agent
- persist runs and messages

This is the service that converts a user message into actual multi-step execution.

---

## Conversational Flow

## MVP v1 flow

1. User sends a message.
2. System resolves the active primary agent for the conversation.
3. System loads user settings for that agent.
4. System assembles context:
   - recent messages
   - optional conversation summary
   - user custom agent context
   - allowed vault context
5. System checks whether supporting agents were manually attached to the conversation.
6. If yes, each supporting agent receives:
   - the user question
   - filtered context limited by its permissions
   - a specialist prompt asking only for its domain contribution
7. Supporting outputs are persisted as `agent_runs`.
8. Primary agent receives:
   - the user message
   - its own filtered context
   - the supporting agent outputs
9. Primary agent generates the final user-facing answer.
10. Final answer is stored as the assistant message.

This flow is enough to validate:

- users understand agent roles
- multi-agent synthesis is useful
- model/provider quality is acceptable
- agent settings and context actually improve output

## MVP v2 flow

Add automatic specialist consultation.

1. User sends message.
2. Primary agent or planner step classifies whether specialist help is useful.
3. System selects supporting agents automatically.
4. Supporting agents answer.
5. Primary agent synthesizes.

This is where the “if it detects it should consult others” behavior starts.

## MVP v3 flow

Add optional review and memory.

1. Primary draft is created.
2. Reviewer agent checks:
   - missing evidence
   - contradictions
   - unsupported claims
3. Primary agent revises and returns final.
4. Conversation summary/memory is updated.

---

## Context Strategy

## Context should be layered

Every run should receive context in this order:

1. prompt template
2. user-specific agent settings
3. conversation summary
4. recent chat history
5. attached domain context
6. supporting agent findings
7. current user message

## Context types

### persistent user-agent context

Examples:

- “This user prefers concise summaries first.”
- “Always compare current biomarkers against previous uploads.”
- “Prioritize RCTs and guideline sources.”

Stored in:

- `user_agent_settings.custom_context`
- `user_agent_settings.training_notes`

### persistent conversation context

Examples:

- current goals
- tracked programs
- current protocol under discussion

Stored in:

- `conversations.summary`
- future dedicated conversation memory tables if needed

### ephemeral runtime context

Examples:

- retrieved file chunks
- fresh web results
- supporting agent outputs

Stored in:

- `message_context_blocks`
- `agent_runs`

---

## Provider Strategy

## Recommended MVP approach

Support providers through one abstraction, but launch initially with one real provider plus stubs for others.

Recommended path:

- v1:
  - one production provider
  - one default model
  - infrastructure already prepared for more

- v2:
  - provider fallback
  - per-agent preferred model

- v3:
  - dynamic routing by task type, cost, latency, or quality

This avoids overbuilding while still protecting the architecture.

## Provider selection rules

For each run:

1. If user agent settings specify a preferred provider/model, use that.
2. Else if agent definition specifies defaults, use those.
3. Else use the system default model.

This should be resolved by `AgentRegistryService`.

---

## Frontend Implications

The current frontend changes already point in the right direction.

### Good current direction

- all agents belong to the marketplace
- favorites are a user preference, not a separate agent class
- agent settings exist as a first-class screen
- Generalist can remain product-pinned as the default coordinator

### What frontend should evolve next

#### Agent settings screen

Eventually persist:

- favorite state
- custom context
- training notes
- allow vault context
- allow web research
- allow scientific research
- preferred model/provider

#### Chat screen

Show:

- primary agent
- supporting agents
- why a specialist was consulted
- files/context used
- citations/references

#### Agent detail UI

Optional later:

- prompt version preview
- test run / sandbox prompt
- cost and quality metrics
- recent execution history

---

## MVP Roadmap

## V1 - Real single-engine conversations

Goal:
replace placeholder replies with real model execution and persist agent configuration.

Scope:

- `agent_definitions`
- `prompt_templates`
- `user_agent_settings`
- `model_providers`
- `model_endpoints`
- `conversation_agents`
- `agent_runs`
- `message_context_blocks`
- one provider integrated
- one primary agent + manually attached supporting agents
- final synthesis only shown to user

Success criteria:

- user can favorite/configure agents
- user can start a chat with a real model
- user can attach supporting agents
- outputs improve when user config/context is present

## V2 - Smart orchestration

Goal:
make the system choose when to consult specialists.

Scope:

- planner/classifier step
- automatic supporting agent selection
- initial web/scientific retrieval
- conversation summarization
- better traceability in UI

Success criteria:

- consultations feel helpful rather than noisy
- users understand why specialists were used
- latency and cost remain acceptable

## V3 - Memory, review, optimization

Goal:
improve quality, consistency, and efficiency.

Scope:

- reviewer/critic loop
- long-term user memory
- better retrieval
- multi-provider routing
- evaluation and quality scoring

Success criteria:

- better consistency across conversations
- lower hallucination rate
- improved answer quality on complex cases

---

## Recommended Implementation Order

1. move agent definitions out of hardcoded frontend data into backend-backed definitions
2. persist `user_agent_settings`
3. create provider abstraction and integrate one real model API
4. refactor `chat-router` into orchestration service + run persistence
5. add `conversation_agents`
6. add context assembly for vault and user settings
7. add supporting agent synthesis
8. add evaluation and review loops later

This order keeps the MVP practical and measurable.

---

## Key Decisions

### Decision 1

Do not model “favorite agents” as installed agents.

Why:

- favorites are just a user UI preference
- installation semantics add complexity too early

### Decision 2

Keep `Generalist` as the default orchestrator.

Why:

- product-wise it gives a stable entry point
- architecturally it provides a natural primary-agent default

### Decision 3

Do not build 22 different backends for 22 agents.

Why:

- same engine is simpler
- prompts and permissions carry most of the variation
- easier testing, scaling, logging, and cost control

### Decision 4

Persist every real run.

Why:

- needed for debugging
- needed for cost tracking
- needed for user feedback analysis
- needed to evolve prompts and routing intelligently

---

## First backend milestone after this document

The next implementation milestone should be:

### “Conversational MVP Foundation”

Deliver:

- schema migration for:
  - `agent_definitions`
  - `prompt_templates`
  - `user_agent_settings`
  - `model_providers`
  - `model_endpoints`
  - `conversation_agents`
  - `agent_runs`
  - `message_context_blocks`
- seed script for existing 22 agents
- backend service skeleton:
  - `AgentRegistryService`
  - `ContextAssemblerService`
  - `ModelGatewayService`
  - `ConversationOrchestratorService`
- favorite/settings persistence endpoints
- one provider integration behind a unified interface

That gives us the first durable foundation for the conversational product.
