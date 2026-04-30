# Mobile Overview And Chat Design

## Summary

This change improves the mobile-first experience of the authenticated Aura app in three specific places:

1. `Overview` should stop rendering the full built-in agent list on mobile and instead prioritize favorite agents plus a clear marketplace CTA.
2. `Chat` should keep the composer visually anchored at the bottom of the viewport so the app feels like a native messaging experience.
3. The chatbot should no longer get stuck in a loading state when the OpenAI stream uses CRLF-delimited SSE frames.

## Goals

- Reduce vertical clutter on the mobile dashboard.
- Make the chat input always discoverable and usable on mobile.
- Guarantee that a streamed or fallback assistant response materializes for the user instead of leaving the screen in a permanent "working" state.

## Non-Goals

- No desktop redesign beyond preserving compatibility with the current layout.
- No marketplace information architecture changes beyond a focused CTA from the mobile overview.
- No provider expansion beyond fixing the existing OpenAI stream path.

## Design

### 1. Mobile Overview

`src/pages/Dashboard.tsx` will render two different agent sections:

- Desktop/tablet keeps the current built-in grid.
- Mobile shows a "Favorites" block using `useAgentCatalog().favoriteAgents`.

The mobile block will:

- Always include `generalist` if it is part of the persisted favorite set.
- Show at most three favorite agents to avoid a long stacked list.
- Include a secondary CTA like `Explore marketplace agents` that routes to `/agents`.

This keeps the mobile overview focused and makes the list feel curated instead of exhaustive.

### 2. Mobile Chat Layout

`src/pages/Chat.tsx` will be restructured into a mobile-first shell:

- Header remains at the top.
- Messages area becomes the only scrolling region.
- Composer region becomes sticky at the bottom with a stronger background and safe spacing.

The empty state will also be compressed on mobile so the shortcut chips do not push the composer off-screen. The result should feel closer to high-quality mobile chat apps, where the message box is always visually available.

### 3. Chatbot Stream Reliability

The likely root cause is in `server/services/model-gateway.ts`.

`extractOpenAIStreamEvents()` currently splits the raw stream only on `\n\n`. Real SSE payloads commonly use `\r\n\r\n`. When that happens:

- multiple events can collapse into one buffer block,
- JSON payload boundaries are lost,
- no semantic events are emitted,
- the UI receives stage updates but never a text delta or a completed message.

The parser will be updated to normalize CRLF/LF line endings before event splitting so both formats produce the same event stream.

## Testing Strategy

- Add a failing test for CRLF-delimited OpenAI SSE parsing in `server/services/model-gateway.test.ts`.
- Add a focused UI test for the mobile favorites derivation helper if extracted.
- Run the relevant chat stream and fallback tests after implementation.

## Risks

- Sticky composer changes can cause nested scroll issues if applied at the wrong container level.
- Favorites-only mobile rendering must preserve discoverability for non-favorite agents via the marketplace CTA.
- Stream parser changes must remain compatible with the current LF-only tests.
