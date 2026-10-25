# 17 — Playable Habitat: Astronaut Exploration and Focused Tasks (Authoritative)

**Status:** Implemented (vertical slice). *Not implemented* items are listed in §10.
Code: `src/features/explore/**`. Entry: the button **Explore the habitat as an astronaut** on the colony view. The colony overview remains the default screen and is unchanged.

## 1. Experience

Spawn in the central hub → walk with WASD/arrows → rooms light up their doorways → an interaction ring and prompt appear near equipment → **E** opens a focused task while the camera moves to the machine → the learner works with real mission state → **Esc / Back** returns to walking. The mission clock never advances because of walking or camera moves; only validated actions (which have explicit simulated time costs, doc 16) and the +1h / +6h buttons advance it.

## 2. Architecture

```text
useGameInput (one window listener)  ->  keys ref  ->  Player (useFrame: kinematic move + AABB collision)
                                                      -> picks nearest interactable (pure fn) -> store.nearbyId
E / prompt click -> explore store.beginTask -> ExploreCamera lerps to the focus pose -> mode 'task' -> TaskShell + task content
task content -> existing mission store / engine actions (applyAction, forecastPlan, ...)
```
- **Separation.** Walking, camera and task lifecycle live in `explore/store.ts` (`GameplayMode = exploration | transitioning | task | debrief`). Character transform is in a ref, never in a store. Mission truth stays in the engine/mission store. No Three.js or physics objects are serialised.
- **Controller.** Custom circle-vs-AABB collision (`world/collision.ts`), sliding per axis with sub-steps of at most 0.1 m so thin walls cannot be tunnelled, frame-rate independent (`dt` clamped to 50 ms). No physics dependency was added: the world is flat and axis-aligned, and `@react-three/rapier` or Ecctrl would add weight with no benefit here.
- **Camera.** Elevated follow camera with fixed yaw so movement stays camera-relative and predictable. Low (1.25 m) walls act as a cutaway, so the player is never hidden behind them. Transitions are damped, interruptible (Esc during the move closes the task) and always finish within 2.2 s even if the camera never arrives, so controls cannot stay locked. In the water-recycler task the camera hands over to a limited orbit (rotate and zoom, no pan).
- **One canvas.** The colony canvas unmounts while exploring, so only one WebGL context exists at a time. Interior geometry reuses `BatchedStatic` (about 45 draw calls measured in dev) and the shared material set.
- **Labels.** `SpriteLabel` (canvas-texture sprite) replaces drei `Html`: its separate React root threw `removeChild` errors when unmounting during a parent unmount (React 19).

## 3. Layout (metres, +Z south on screen)

```text
            [ Mission Control ]  x -4..4,  z -9..-4
                     |  2.4 m doorway/corridor
[ Life Support ] - [ Hub ] - [ Power Room ]
 x -10..-4         x -2..2    x 4..10, z -3..3
                     |
              [ Greenhouse ]  x -4..4, z 4..9
```
Doorway thresholds glow in the destination room's accent colour (wayfinding by light); each room has one softly tinted point light (no shadows). Walls and props collide; decorative wall items do not. All layout data (rooms, walls, props, interactables, spawn) is plain data in `world/layout.ts` and is covered by tests (spawn is free, doorways are walkable, interactables stand on free ground, the astronaut cannot leave).

## 4. Interaction framework

`WorldInteractable` (in `world/layout.ts`): `id`, `moduleId` (shared `ModuleId`), `taskId`, `label`, `verb`, `description`, `position`, `interactionRadius`, `room`, camera `focus`, `enabled`. One pure function, `pickInteractable`, chooses the target: nearest within range, with a facing bonus and hysteresis so the target does not flicker between two nearby machines. The prompt reads *"Water Recycler — Press E to Inspect"* and is also a clickable button.

| Interactable | Module | Task surface | Uses |
|---|---|---|---|
| Water Recycler | `water-recycler` | 3D machine + embedded `TrainingPanel` | Existing hotspots, procedure engine, evidence, verification (doc 16) |
| Power Distribution Board | `battery-bank` | SVG schematic + `PowerPlanner` | `forecastPlan` (real engine) and `APPLY_POWER_PLAN` |
| Mission Console | `crew-habitat` | objectives, events, forecast, documentation | `getGuidance`, `forecastPlan`, `MissionDebrief` |
| Greenhouse Workstation | `greenhouse` | what-if on lights vs food and battery | `forecastPlan` twice, `APPLY_POWER_PLAN` |
| Crew Habitat Terminal | `crew-habitat` | reserves against mission safety rules | mission resources and `RED_STORM_CONFIG` |
| Air Revitalization Unit | `life-support` | status, health, oxygen reasoning | module state |

## 5. Input rules

`useGameInput` registers one set of window listeners for the whole habitat: WASD/arrows, Shift (run), E (interact), Tab (objectives), Esc. E fires once per press (key-repeat ignored) and only when a target is in range and the mode is `exploration`. Keys are ignored while typing in an input/select/textarea or with Ctrl/Meta/Alt held. Movement keys are cleared on window blur, tab hide, when a task opens and on unmount, so keys cannot stick. Listeners are removed on unmount.

## 6. Task lifecycle

`beginTask` succeeds only from `exploration` inside the habitat, so a task can never start twice. `endTask` works from `task` and from the transition in, and always returns to `exploration` once the camera is back (or after the timeout). Closing a task does not reset anything: procedure progress, evidence and inventory live in the mission state, so reopening shows them. Escape never bypasses validation: it only leaves the screen; a half-finished procedure stays half-finished (hatch open, unit in maintenance) and the habitat shows it. Rewind and reset restore the mission state; the astronaut simply stays where they are.

## 7. Water-recycler vertical slice

Approach (the unit's beacon shows a degraded diamond after the fault) → prompt → **E** → camera moves in, astronaut hidden so it never blocks the machine → investigate (click parts, tests cost simulated time) → diagnose → full procedure with tools, hatch, cartridges, keyed orientation, startup test → engine-verified result → **Esc** → beacon returns to a green circle and the HUD shows the new hour, water and spares. No separate repair logic exists in this mode: it is the same `WaterRecycler` model, hotspot mapping and engine as the colony service view.

## 8. Character

No rigged astronaut model is bundled and none could be sourced with a verifiable licence in this environment, so the astronaut is a stylised procedural model (`character/Astronaut.tsx`): suit, helmet with visor, life-support pack, articulated arms and legs. Animations implemented: **idle** (breathing, arm sway), **walk**, **run** (faster cycle with forward lean), **turning** (body lean into the turn) and **interact** (right arm reaches forward). Limb swing is blended by speed and smoothed. There are no baked clips. If a licensed GLB is added later, only `Astronaut.tsx` needs replacing; the controller feeds it an `AstronautPose` (`anim`, `speed`, `turn`). See doc 13.

## 9. Accessibility, performance, tests

- Accessibility: visible controls guide; the prompt is an `aria-live` button, so mouse users can interact; every task surface is a labelled dialog with a Back button; status uses shapes and text as well as colour; reduced motion disables limb swing, bobbing and camera easing; without WebGL the habitat becomes a button list that opens the same tasks.
- Performance: about 45 draw calls and 14k triangles in the interior (dev, 1400x900); no React re-render per frame (transform and animation in refs; only target and room changes reach the store).
- Mobile and touch are out of scope for this phase (no virtual joystick); desktop keyboard only.
- Tests: `src/features/explore/__tests__/` (collision, layout, targeting, lifecycle, input, task UI without WebGL). Browser checks with Playwright covered movement and collision, the prompt, E opening the correct task, movement lock during tasks, Esc restoring control, the complete recycler repair through 3D clicks, the power board, and the mission console. There is no automated WebGL test in CI.

## 10. Not implemented

Touch/gamepad controls; a licensed rigged character with baked clips; footsteps or other audio; doors that animate; camera rotation by the player; more rooms or tasks (e.g. research lab); interior simulation effects for the dust storm (dust only affects the colony view); tasks for filter and sensor swaps in this mode have not been exercised in a browser (same hotspots as the colony service view).
