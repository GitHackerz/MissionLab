# 20 — NOVA: Holographic AI Mission Companion

NOVA is an onboard training assistant that lives **inside** the playable habitat. It is a presentation layer on top of the deterministic engine: it reads what the learner is allowed to know, explains, hints and points. It never changes mission state.

Code: `src/features/nova/`, `src/app/api/nova/route.ts`, `src/server/nova/`.

## Product role and learning goals
- Support independent scientific reasoning (power balance, closed water loop, pressure/flow, sensor vs. reality, verify with measurements). NOVA asks guiding questions and never hands over the diagnosis.
- Three hint levels: **1 conceptual**, **2 investigative** (suggests a measurement), **3 directional** (points at a place or instrument). The ladder climbs per stage of the mission and resets when the stage changes.

## Visual design and states
Original design: bright core, fresnel hologram shell (tiny `ShaderMaterial`), three thin orbital rings that assemble on first appearance, ~28 orbiting motes. No lights, no shadows, no postprocessing, shared materials, geometry/material created once. Pose lives in refs (no React re-renders while moving).

| State | Look |
|---|---|
| idle | cyan, slow spin, breathing |
| listening | rings widen and pulse |
| thinking | rings orbit fast, indigo tint |
| speaking | core/rings pulse with a restrained level tied to speech playback and word boundaries (not a real waveform) |
| guiding | teal, with a beam to the target |
| warning | amber, ~7 s, only for safety-relevant events |
| offline | subdued (Gemini unreachable or not configured) |
| error | soft red tint, ~2.5 s |

Colours and values damp toward the target state, so changes never pop. `prefers-reduced-motion`: no hover bob, spin, pulsing or materialisation animation.

Presence: beside the astronaut while exploring (fixed camera-relative anchor above wall height, no pathfinding or collision), anchored smaller beside the equipment while a task is open, hidden in the debrief overlay. When guiding it leans toward the target.

## Visual guidance registry
`targets.ts` is the only source of world positions. Ids: `room:*`, `station:*` (from `INTERACTABLES`), `part:*` (recycler components plus `pressure-gauges`, positioned from the recycler model). The model can only name an id; unknown ids, `__proto__`, and coordinates are dropped. Markers: floor halo, camera-facing halo for parts, beam from NOVA, label. Concept cards use authored text (`NOVA_CONCEPTS`); the model only picks an id.

Anti-spoiler gate (`canTarget`): rooms/stations are always allowed (objective-level destinations); equipment parts require hint level 3, or an *explain*/*reflect*/*debrief* request, or an already revealed outcome. Level-3 pointing in diagnosis follows the learner's own **evidence gaps** (`nextProbe`), not the fault.

## Context adapter (no hidden-answer leakage)
`ai/context.ts` builds the context field by field (whitelist); the store is never serialised. It contains resources, power telemetry, module statuses, non-info events, the evidence the learner collected, inspected components, the learner's own diagnoses, repair phase, recent action names, stage/objective, room and focus. It never reads `faultKind`, `activeFault`, live un-measured recycler readings, or step-failure explanations. The fault label and outcome (`debrief`) are included only when `revealed` (mission over or repair verified).

The server re-parses with a **strict** zod schema: any extra field (e.g. a leaked `faultKind`) is a 400. Browser-submitted context is untrusted and is never used for scoring.

## Gemini integration
- SDK `@google/genai`, called only in `src/server/nova/gemini.ts` (`server-only`). Env: `GEMINI_API_KEY` (alias `GEMINI_API`), `GEMINI_MODEL` (**no default model id is hardcoded**; set a currently supported Flash/Flash-Lite id from the official model list), `NOVA_TIMEOUT_MS`, `NOVA_RATE_PER_MINUTE`, `NOVA_DAILY_LIMIT`. See `.env.example`. Without key and model NOVA uses the offline tutor.
- One instructor, one call, structured JSON (`responseJsonSchema`), `maxOutputTokens` 1024, short answers (< 60 words prompt, 420-char hard cap), no retries (the offline tutor is the fallback), 8 s default timeout, request abort propagated.
- Prompt: persona and hard rules in `ai/prompts.ts`; learner text is passed as a JSON field `studentMessage` and declared untrusted.
- Route `POST /api/nova`: same-origin check, 12 KB body cap, strict schema, per-client sliding-window limit (default 10/min) plus global daily budget (default 1500), no message logging. `GET /api/nova` returns `{available}`; `?metrics=1` returns counters in development only.
- Output validation (`validateModelOutput`): text length, emotion enum, hint level clamped to the request, action type/target/concept validated against the registry and gating, and an anti-spoiler text filter (assertive "the pump is seized / replace the filter" statements are rejected while the answer is not yet revealed). Invalid → 502 → client uses the offline tutor. The client re-validates (`checkResponse`) before acting.
- Client (`ai/tutor.ts`): 10 s timeout, small response cache, 60 s cool-down after a quota response, 15 s after network failure; always resolves with a usable reply.

## Capabilities (intents)
Explain, Guide (`where`), Progressive hints, Reflect (why did that happen), Debrief. NOVA cannot repair, advance time, spend resources or complete procedures: the schema has no such action.

## Voice
- P0 output: browser Speech Synthesis (`audio/speech.ts`), testable state machine with a watchdog so a browser that never fires `end` cannot leave NOVA speaking. Subtitles always work; speech failure is silent. Mute, volume, stop, repeat, text-only toggle (persisted in `localStorage`, guarded).
- P1 input: push-to-talk through `SpeechRecognition` where supported (Chrome/Edge/Safari). It needs a connection and microphone permission, opens the mic only on click and closes after one utterance, stores no audio, and falls back to text with a clear message. Not offline-capable.
- Not implemented: Gemini Live (P2).

## Proactive, event-driven guidance
`events.ts` derives conditions from validated mission state (storm objective, low battery/water, recycler symptom, failed/passed verification, mission end), dedupes by key (`EventLedger`), and applies `gateDecision` (priority + 12 s cooldown, 3 s for safety messages, queue instead of interrupting, silent subtitle only during focused tasks, never while the learner is mid-conversation). Messages are authored, so no Gemini call is needed. Reset/rewind/load seeds the ledger silently, clears guidance, stops speech and drops queued narration. The player can switch proactive speech off.

## Offline behaviour
`ai/fallback.ts` is a rule-based tutor over the same learner-visible context: stage hint tables, concept cards, authored equipment explanations, live numbers, direct-answer refusal, debrief after the outcome. The orb switches to the offline look and the dock says "Offline tutor". Speech availability is independent of AI availability.

## Integration points (existing code touched)
`ExploreScene.tsx` renders `<NovaCompanion/>` inside the existing canvas; `HabitatExplorer.tsx` renders `<NovaDock/>`. No simulation, training, store or contract file was modified.

## Testing
`src/features/nova/__tests__`: context projection and hidden-fault filtering for all three faults, strict schema, registry and gating, output validation (unknown targets, spoilers, overlong text), offline hint ladder, tutor timeouts/failures/cache/cool-down, event derivation/dedupe/gate, voice state machine, rate limiting, route behaviour, and runtime integration (no mission mutation, reset/rewind clear guidance, Gemini down).
Browser-verified manually in the app (see the implementation report in the PR/hand-off for exact results). **Not verified:** a successful live Gemini response (no key was available), audible speech (the test browser has no voices), microphone input.

## Known limitations
- Rate limits are in-process; use a shared store if deployed across instances.
- The spoiler text filter is deliberately narrow; Gemini phrasing the answer indirectly is only mitigated by the prompt and by the model never receiving the answer.
- Markers on equipment parts are derived from the recycler model's layout; if the model is moved or rescaled, update `PART_LIST` in `targets.ts`.
- On narrow phones the dock shares space with the touch controls.
