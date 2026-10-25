# 09 — Team Responsibilities & Work Breakdown

**Document Status:** Canonical Team Agreement  
**Team Members:** Kammoun (Person 1), Habib (Person 2), Amina (Person 3)

---

## 1. Workstream Ownership Matrix

| Area | Primary Owner | Secondary / Collaborator | Core Files & Directory |
|---|---|---|---|
| **Simulation Physics & Invariants** | **Kammoun** | Amina | `src/simulation/**` |
| **Mathematical Models & Balance** | **Kammoun** | Habib, Amina | `src/simulation/config.ts`, `engine.ts` |
| **Action Validation & Scheduling** | **Kammoun** | Amina | `src/simulation/actions.ts`, `events.ts` |
| **Snapshots, Rewind & History** | **Kammoun** | Amina | `src/simulation/history.ts`, `debrief.ts` |
| **Engine Invariant Tests** | **Kammoun** | Shared | `src/simulation/__tests__/**` |
| **3D Mars Scene & Atmosphere** | **Habib** | Amina | `src/features/habitat-3d/components/**` |
| **3D Module Meshes & Shaders** | **Habib** | Kammoun | `src/features/habitat-3d/modules/**`, `src/features/habitat-3d/components/**` |
| **Camera Navigation & Selection** | **Habib** | Amina | `src/features/habitat-3d/HabitatScene.tsx` |
| **3D Asset Optimization & Credits** | **Habib** | Shared | `public/models/**`, `docs/13-SOURCES-ATTRIBUTION.md` |
| **Application Shell & Layout** | **Amina** | Habib | `src/app/**` |
| **Resource HUD & Inspector UI** | **Amina** | Kammoun | `src/features/mission-ui/**` |
| **Zustand Application Store** | **Amina** | Kammoun | `src/state/missionStore.ts` |
| **Autopsy & Comparison Screens** | **Amina** | Kammoun | `src/features/debrief/**` |
| **Deployment & Demo Rehearsal** | **Amina** | All | Vercel Deployment, `docs/12-HACKATHON-PITCH.md` |

---

## 2. Person 1 — Kammoun (Simulation Engine & Game Logic)

### Mission
Build the trusted, deterministic mathematical core of MissionLab. All resource balances, failure states, event triggers, and replay histories are calculated here.

### Prioritized Deliverables
1. **P0 (Critical Path):**
   - Implement fixed-step simulation advance (`advanceMission`) with multi-step support.
   - Refine critical vs optional power load shedding with explicit unserved load logging.
   - Ensure coupled oxygen and water production dependencies: oxygen generation requires electrical power and nominal water inventory.
   - Expand scheduled event triggers for Mission 01 (Hour 0 storm, Hour 30 pump fault).
   - Write comprehensive invariant tests (`pnpm test`) validating boundary limits and determinism.
2. **P1 (Advanced Engine Features):**
   - Simulated transmission delay queue for Earth mission communications.
   - Granular agricultural yield scoring based on greenhouse uptime.
   - Sensitivity testing harness for mission tuning.

### Verification Commands
```bash
pnpm test
pnpm typecheck
```

---

## 3. Person 2 — Habib (3D Digital Twin & Visualization)

### Mission
Create an authentic, responsive 3D Mars habitat that visually mirrors the simulation engine's canonical state without computing physics in the visual layer.

### Prioritized Deliverables
1. **P0 (Critical Path):**
   - Ensure all 7 modules have distinct, recognizable silhouettes matching `ModuleId`.
   - Implement telemetry-driven shaders and emissive materials responding to `operational`, `warning`, `degraded`, `offline`, and `repairing`.
   - Implement atmospheric storm response (fog density increase and solar array dust accumulation).
   - Maintain smooth camera orbit, zoom, and framing with strict ground clipping prevention.
   - Ensure scene renders $\ge 45\text{ FPS}$ on standard laptops.
2. **P1 (Visual Polish):**
   - Camera focus transition zooming to a newly selected module.
   - Atmospheric dust particle emitter active during storm periods.
   - Subtle procedural antenna or pump rotor animations for operating modules.

### Verification Commands
```bash
pnpm dev # Verify 3D rendering and selection in browser
pnpm build # Verify production bundling
```

---

## 4. Person 3 — Amina (Application UI/UX & Integration)

### Mission
Unify the simulation engine and 3D digital twin into an intuitive educational product with a compelling 5-minute hackathon pitch flow.

### Prioritized Deliverables
1. **P0 (Critical Path):**
   - Maintain the Zustand bridge (`missionStore.ts`) connecting engine telemetry to the HUD and 3D scene.
   - Ensure bi-directional module selection operates seamlessly between the 3D canvas and the inspection panel.
   - Implement full available action dispatching with validation reasons for disabled actions.
   - Build the Mission Autopsy screen displaying structured causal logs and resource margins.
   - Build the interactive Rewind timeline selector and A/B branch comparison table.
   - Manage deployment to Vercel and coordinate presentation rehearsal.
2. **P1 (SaaS Value Add):**
   - Educator debrief mode (printable PDF summary of student decisions).
   - Session telemetry export to JSON.
   - Responsive layout optimization for smaller screens.

### Verification Commands
```bash
pnpm lint
pnpm typecheck
pnpm build
```

---

## Training Update: ownership

- **Kammoun:** `src/simulation/training/**` (component model, faults, evidence, procedure rules, time and spares, forecast, assessment, tests).
- **Habib:** `modules/WaterRecycler.tsx`, `components/Hotspot.tsx`, `utils/serviceInteractions.ts`, camera service view, flow and maintenance animation.
- **Amina:** `TrainingPanel`, `PowerPlanner`, `MissionDebrief`, `SidePanel`, `FeedbackToast`, store feedback and rewind.
- Integration edits to others' files are listed in [16-TRAINING-DESIGN.md](16-TRAINING-DESIGN.md) §2 and need owner review.

---

## Playable Habitat: ownership

- **Habib:** `src/features/explore/**` (character, controller, camera, interior, interaction framework, task lifecycle) plus `SpriteLabel`.
- **Kammoun:** no engine change was required. The habitat uses the existing procedure engine, `forecastPlan` and `APPLY_POWER_PLAN`. One rule change in this phase: the mission opens with `stormActive: true` and a logged arrival event.
- **Amina:** the task panels are reused (`TrainingPanel` gained an `embedded` flag, `PowerPlanner` a `schematic` flag, `FeedbackToast` a `className`); `page.tsx` hosts the entry button and switches between colony and habitat.
