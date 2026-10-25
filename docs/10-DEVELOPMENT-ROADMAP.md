# 10 — Development Roadmap & Task Milestones

**Document Status:** Authoritative Project Roadmap  
**Team Schedule Target:** LUMEN 2.0 Hackathon Pitch — 25 October 2026, 09:00

---

## Milestone Overview

```text
Milestone 0: Foundation & Contracts [COMPLETED]
     │
     ├──────────────────────────┐
     ▼                          ▼
Milestone 1: Simulation Core  Milestone 2: 3D Digital Twin
(Kammoun)                    (Habib)
     │                          │
     └──────────┬───────────────┘
                ▼
Milestone 3: Playable Mission Integration
(Amina + All)
                │
                ▼
Milestone 4: Autopsy, Rewind & Branching
(Kammoun + Amina)
                │
                ▼
Milestone 5: Polish, Rehearsal & Pitch Defense
(All)
```

---

## Detailed Task Breakdown

### Milestone 0: Architecture & Foundation [COMPLETED]

| Task ID | Task Description | Owner | Priority | Dependencies | Deliverable | Status |
|---|---|---|---|---|---|---|
| **M0-01** | Repository setup, Next.js 15, Tailwind, Vitest | Amina / Lead | P0 | None | Working repo structure | **DONE** |
| **M0-02** | Shared TypeScript interfaces & types (`types.ts`) | All | P0 | M0-01 | Shared contract definition | **DONE** |
| **M0-03** | Red Storm scenario configuration (`config.ts`) | Kammoun | P0 | M0-02 | Fictional calibrated constants | **DONE** |
| **M0-04** | 6 Typed development mock fixtures (`fixtures/`) | Kammoun | P0 | M0-02 | Normal, storm, degraded, failed mock states | **DONE** |
| **M0-05** | Zustand application store bridge (`missionStore.ts`) | Amina | P0 | M0-02 | Functional central state bridge | **DONE** |
| **M0-06** | Minimal 3D scene with 7 module meshes | Habib | P0 | M0-02 | R3F canvas and selectable meshes | **DONE** |
| **M0-07** | Mission control HUD & inspection panel | Amina | P0 | M0-05 | Bi-directional selection UI | **DONE** |
| **M0-08** | Automated contract & smoke tests | Kammoun | P0 | M0-02 | 6 passing Vitest unit tests | **DONE** |
| **M0-09** | 15-part technical documentation system | All | P0 | M0-01 | Complete `docs/` library | **DONE** |

---

### Milestone 1: Simulation Core (Hours 0–12)

| Task ID | Task Description | Owner | Priority | Dependencies | Deliverable | Status |
|---|---|---|---|---|---|---|
| **M1-01** | Implement discrete 1-hour fixed-step clock | Kammoun | P0 | M0-03 | `advanceMission` multi-step loop | Planned |
| **M1-02** | Implement power allocation and load priority | Kammoun | P0 | M1-01 | Power balance equations | Planned |
| **M1-03** | Implement water consumption and recovery balance | Kammoun | P0 | M1-01 | Distillation recovery calculations | Planned |
| **M1-04** | Implement oxygen production and ECLSS coupling | Kammoun | P0 | M1-02 | Electrolysis respiration equations | Planned |
| **M1-05** | Implement scheduled dust storm and pump fault | Kammoun | P0 | M1-01 | `events.ts` trigger execution | Planned |
| **M1-06** | Implement action validation and preconditions | Kammoun | P0 | M0-02 | `validateAction` error handling | Planned |
| **M1-07** | Write invariant unit tests for power/water balance | Kammoun | P0 | M1-02 | Suite of $\ge 12$ Vitest tests | Planned |

---

### Milestone 2: Interactive 3D Habitat (Hours 0–12)

| Task ID | Task Description | Owner | Priority | Dependencies | Deliverable | Status |
|---|---|---|---|---|---|---|
| **M2-01** | Model 7 distinct module geometries and silhouettes | Habib | P0 | M0-06 | Clean composite 3D meshes | Planned |
| **M2-02** | Telemetry-driven status shaders (Green/Amber/Red/Cyan)| Habib | P0 | M2-01 | Dynamic status materials | Planned |
| **M2-03** | Dust storm atmospheric response (fog & lighting) | Habib | P0 | M0-06 | Atmospheric transition | Planned |
| **M2-04** | Selection indicator rings and hover cursors | Habib | P0 | M2-01 | Smooth selection UX | Planned |
| **M2-05** | Camera orbit damping and terrain collision bounds | Habib | P0 | M0-06 | Ergonomic camera controls | Planned |
| **M2-06** | Asset optimization: ensure $\ge 45\text{ FPS}$ on laptops | Habib | P0 | M2-01 | Production performance audit | Planned |

---

### Milestone 3: Playable Mission Integration (Hours 12–18)

| Task ID | Task Description | Owner | Priority | Dependencies | Deliverable | Status |
|---|---|---|---|---|---|---|
| **M3-01** | Connect live engine dispatch to UI buttons | Amina | P0 | M1-06, M0-05 | Working in-world action dispatch | Planned |
| **M3-02** | Wire live 3D scene to live Zustand mission state | Amina / Habib | P0 | M2-02, M0-05 | Zero mock data in live mode | Planned |
| **M3-03** | Build time steppers (+1h, +6h) with live animations | Amina | P0 | M1-01, M0-05 | Time progression controls | Planned |
| **M3-04** | Implement mission terminal success/failure detection | Amina / Kammoun | P0 | M1-02, M1-03 | Automatic game over triggers | Planned |
| **M3-05** | Test full Red Storm playthrough end-to-end | All | P0 | M3-04 | Working survival and failure runs | Planned |

---

### Milestone 4: Educational Differentiation (Hours 18–24)

| Task ID | Task Description | Owner | Priority | Dependencies | Deliverable | Status |
|---|---|---|---|---|---|---|
| **M4-01** | Capture immutable state snapshots at each step | Kammoun | P0 | M1-01 | `history.ts` snapshot recorder | Planned |
| **M4-02** | Implement deterministic rewind and branch forking | Kammoun | P0 | M4-01 | `forkMission` timeline branching | Planned |
| **M4-03** | Generate structured causal evidence for debrief | Kammoun | P0 | M4-01 | `autopsyCauseChain` generator | Planned |
| **M4-04** | Build Mission Autopsy verdict UI screen | Amina | P0 | M4-03 | Interactive debrief report | Planned |
| **M4-05** | Build A/B branch comparison table | Amina | P0 | M4-02 | Side-by-side outcome delta view | Planned |

---

### Milestone 5: Polish, Rehearsal & Pitch Defense (Hours 24–30)

| Task ID | Task Description | Owner | Priority | Dependencies | Deliverable | Status |
|---|---|---|---|---|---|---|
| **M5-01** | UI visual polish, typography, and responsive review | Amina | P0 | M4-04 | Polished command center styling | Planned |
| **M5-02** | Full automated regression test suite run | Kammoun | P0 | All | All unit & invariant tests green | Planned |
| **M5-03** | Verify production build and deploy to Vercel | Amina | P0 | All | Publicly accessible URL | Planned |
| **M5-04** | Prepare offline local fallback bundle | Habib | P0 | M5-03 | Zero-network local demo backup | Planned |
| **M5-05** | Complete 5-minute timed presentation rehearsal | All | P0 | M12-01 | Rehearsed live jury pitch | Planned |

---

## Training Milestones

- **T0 (done):** component model, three faults, evidence, hypotheses, 16-step validated procedure, engine verification, forecast, assessment, tests.
- **T1 (done):** 3D recycler service view, tools, spares, hotspots, camera transition; Training / Power / Debrief tabs; rewind to decisions with comparison.
- **T2 (next):** guided onboarding sequence, per-step coach overlays, sound-free alternatives for all cues, additional faults, more modules with procedures, greenhouse experiments, radiation shelter scenario, touch and keyboard polish for the 3D service view, profiling on low-end GPUs.

---

## Playable Habitat Milestones

- **P1 (done):** astronaut, controller with collision, follow camera, compact interior, interaction framework, six tasks, water-recycler vertical slice, tests, docs.
- **P2 (next):** licensed rigged character with clips, touch controls, more interior tasks (research lab, radiation shelter), audio-free feedback polish, profiling on low-end GPUs.
