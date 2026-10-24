# MissionLab — Interactive Mars Mission Training Platform

> **LUMEN 2.0 — Beyond 2030 Hackathon Project**  
> *Concept Inspiration: NASA Space Apps Challenge 2026 — Build a Junior Astronaut Mission Trainer*  
> **Status:** Phase 0 Architecture, Technical Contracts & Vertical Slice Initialized

---

## 1. Product Summary

**MissionLab** is an interactive, browser-based 3D Mars mission simulator designed for STEM education and astronaut systems-thinking training. Students act as acting mission commanders responsible for maintaining a simulated 2045 Mars research colony through environmental crises.

Rather than answering multiple-choice quizzes or watching pre-rendered outcomes, learners interact directly with habitat machinery, allocate scarce electrical power, manage life-support resources, experience the cascading consequences of their operational decisions in real time, and use an evidence-based **Mission Autopsy** and deterministic **Rewind** engine to understand *why* their mission succeeded or failed.

### Core Value Proposition
- **Systems Thinking:** Learn how power generation, battery buffers, water recycling, air revitalization, and greenhouse agriculture are physically interconnected.
- **State-Driven 3D Digital Twin:** Every habitat subsystem reflects genuine engine state via React Three Fiber without physics duplication in UI components.
- **Deterministic Simulation:** Fixed-step mathematical modeling ensures that identical actions from identical initial states yield identical outcomes.
- **Causal Rewind & Autopsy:** Fork earlier decision points into alternate timelines, test counterfactual choices, and compare outcomes side-by-side using real engine telemetry.

> **Important Honesty & Scope Note:**  
> MissionLab is an educational digital-twin-style simulation. It does not ingest real spacecraft telemetry, nor does it claim NASA certification, endorsement, or flight-level life-support fidelity. All numerical parameters are game-calibrated educational approximations.

---

## 2. Team & Ownership Boundaries

| Team Member | Role | Core Ownership |
|---|---|---|
| **Kammoun (Person 1)** | Simulation Engine & Game Logic | `src/simulation/**`, mathematical models, event scheduling, action validation, determinism tests, autopsy cause generation |
| **Habib (Person 2)** | Three.js Digital Twin & 3D Experience | `src/features/habitat-3d/**`, Mars terrain, module 3D meshes, status shaders, storm visual effects, asset optimization |
| **Amina (Person 3)** | Application UI/UX & Integration | `src/app/**`, `src/features/mission-ui/**`, `src/features/debrief/**`, `src/state/**`, mission HUD, telemetry panels, deployment |

---

## 3. Technology Stack

- **Language:** TypeScript 5.9+ (Strict Mode enabled across all modules)
- **Web Framework:** Next.js 15.5+ (App Router architecture, React 19)
- **3D Engine:** Three.js + React Three Fiber (`@react-three/fiber`) + Drei (`@react-three/drei`)
- **State Management:** Zustand (central typed store bridging simulation engine and UI/3D)
- **Styling:** Tailwind CSS (custom Mars palette: `#120705`, `#c86d51`, `#b94a28`)
- **Testing:** Vitest + React Testing Library (contract invariants and deterministic replay verification)
- **Icons:** Lucide React
- **Package Manager:** pnpm 12.15+

---

## 4. Getting Started

### Prerequisites
- **Node.js:** v20+ or v24+
- **pnpm:** v10+ or v12+ (`npm install -g pnpm`)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/missionlab.git
cd missionlab

# Install dependencies
pnpm install

# In pnpm v12+, approve any native build scripts if prompted
pnpm approve-builds --all
```

### Local Development
```bash
# Start Next.js development server
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Verification & Testing
```bash
# Run Vitest contract and simulation invariant tests
pnpm test

# Run TypeScript strict type-checking
pnpm typecheck

# Run ESLint validation
pnpm lint

# Build optimized production bundle
pnpm build
```

---

## 5. Repository Architecture

```text
missionlab/
├── docs/                                  # Complete 15-part project documentation
│   ├── 01-PRODUCT-VISION.md
│   ├── 02-PRODUCT-REQUIREMENTS.md
│   ├── 03-MISSION-SCENARIOS.md
│   ├── 04-SIMULATION-ENGINE.md
│   ├── 05-SYSTEM-ARCHITECTURE.md
│   ├── 06-INTERFACES-CONTRACTS.md
│   ├── 07-3D-ENVIRONMENT.md
│   ├── 08-UI-UX-DESIGN.md
│   ├── 09-TEAM-RESPONSIBILITIES.md
│   ├── 10-DEVELOPMENT-ROADMAP.md
│   ├── 11-TESTING-QUALITY.md
│   ├── 12-HACKATHON-PITCH.md
│   ├── 13-SOURCES-ATTRIBUTION.md
│   ├── 14-SAAS-ROADMAP.md
│   └── 15-DECISIONS-AND-RISKS.md
│
├── public/                               # Static 3D models and textures
│   ├── models/
│   ├── textures/
│   └── images/
│
├── src/
│   ├── app/                              # Next.js App Router (Layout & Pages)
│   │   ├── globals.css                   # Tailwind and Mars theme definitions
│   │   ├── layout.tsx                    # Root shell layout
│   │   └── page.tsx                      # Mission Control page composition
│   │
│   ├── features/
│   │   ├── habitat-3d/                   # Habib's 3D Digital Twin workstream
│   │   │   ├── components/
│   │   │   │   ├── MarsEnvironment.tsx  # Atmosphere, sunlight, crater terrain
│   │   │   │   └── ModuleMesh.tsx       # 7 selectable module meshes & status rings
│   │   │   └── HabitatScene.tsx          # R3F Canvas and OrbitControls
│   │   │
│   │   ├── mission-ui/                   # Amina's Mission Control UI workstream
│   │   │   └── components/
│   │   │       ├── EventTimeline.tsx    # Live telemetry event stream
│   │   │       ├── MissionHeader.tsx    # Clock, status badges, fixture selector
│   │   │       ├── ModuleInspector.tsx  # Subsystem telemetry & action panel
│   │   │       └── ResourceHud.tsx      # Power, water, oxygen, crew metrics
│   │   │
│   │   └── debrief/                      # Mission Autopsy & rewind comparisons
│   │       └── components/
│   │
│   ├── simulation/                       # Kammoun's Simulation Engine (Pure TS)
│   │   ├── __tests__/                   # Automated invariant & contract tests
│   │   │   └── contracts.test.ts
│   │   ├── fixtures/                     # 6 typed development mock states
│   │   │   └── index.ts
│   │   ├── actions.ts                   # Action validation & preconditions
│   │   ├── config.ts                    # Red Storm mission initial parameters
│   │   ├── debrief.ts                   # Autopsy summary & branch comparison logic
│   │   ├── engine.ts                    # Fixed-step advance & action transitions
│   │   ├── events.ts                    # Scenario scheduled event triggers
│   │   ├── history.ts                   # Snapshots & deterministic branch forking
│   │   ├── index.ts                     # Public engine API exports
│   │   └── types.ts                     # Single source of truth TypeScript contracts
│   │
│   └── state/
│       └── missionStore.ts              # Zustand bridge connecting engine, 3D & UI
│
├── .github/
│   └── pull_request_template.md         # Collaboration and PR checklist
├── next.config.ts                       # Next.js transpile and compiler config
├── tailwind.config.ts                   # Tailwind theme styling
├── tsconfig.json                        # TypeScript strict mode configuration
├── vitest.config.ts                     # Vitest configuration
└── package.json
```

---

## 6. Shared Integration Contracts

The project operates under a strict contract boundary in `src/simulation/types.ts`:
- **7 Habitat Subsystems:** `solar-array`, `battery-bank`, `life-support`, `water-recycler`, `greenhouse`, `research-lab`, `crew-habitat`
- **Subsystem Statuses:** `operational`, `warning`, `degraded`, `offline`, `repairing`
- **Core Telemetry Resources:** `batteryKwh` (max 150 kWh), `oxygenKg` (safety 1.5 kg), `waterLiters` (safety 14 L), `foodRations`, `sparePumps`
- **Unidirectional Integration:**
  ```text
  Engine (Kammoun) ──> Zustand Store (Amina) ──> 3D Habitat (Habib)
                                             └──> Telemetry HUD (Amina)
                                             └──> Subsystem Inspector (Amina)
  ```

---

## 7. Current Milestone 0 Status

- [x] Next.js 15+ App Router configured in strict mode
- [x] Tailwind CSS configured with custom Mars palette
- [x] React Three Fiber and Drei configured and compiling
- [x] Shared TypeScript contracts defined and validated
- [x] 6 typed test fixtures available for parallel development
- [x] 3D scene renders all 7 habitat modules with status glow
- [x] Bi-directional selection established between 3D scene and inspection panel
- [x] Vitest invariant test suite configured and passing
- [x] Zero TypeScript, ESLint, or Next.js build errors
- [x] Complete 15-part documentation system written in `docs/`

---

## 8. Documentation Index

For detailed guidelines, consult the dedicated documentation files:
- [01. Product Vision & Educational Value](docs/01-PRODUCT-VISION.md)
- [02. Product Requirements Document (PRD)](docs/02-PRODUCT-REQUIREMENTS.md)
- [03. Mission Scenarios & The Red Storm](docs/03-MISSION-SCENARIOS.md)
- [04. Simulation Engine & Mathematical Models](docs/04-SIMULATION-ENGINE.md)
- [05. System Architecture & Component Design](docs/05-SYSTEM-ARCHITECTURE.md)
- [06. Shared Interfaces & TypeScript Contracts](docs/06-INTERFACES-CONTRACTS.md)
- [07. 3D Mars Environment & Visualization Guide](docs/07-3D-ENVIRONMENT.md)
- [08. UI/UX Design System & Experience](docs/08-UI-UX-DESIGN.md)
- [09. Team Responsibilities & Work Breakdown](docs/09-TEAM-RESPONSIBILITIES.md)
- [10. Development Roadmap & Task Milestones](docs/10-DEVELOPMENT-ROADMAP.md)
- [11. Testing Strategy & Quality Assurance](docs/11-TESTING-QUALITY.md)
- [12. Hackathon Pitch Script & Live Defense](docs/12-HACKATHON-PITCH.md)
- [13. Sources, Citations & Attribution Register](docs/13-SOURCES-ATTRIBUTION.md)
- [14. Post-Hackathon SaaS Commercial Roadmap](docs/14-SAAS-ROADMAP.md)
- [15. Architecture Decisions (ADRs) & Risk Register](docs/15-DECISIONS-AND-RISKS.md)

---

## 9. License & Attribution

Developed for **LUMEN 2.0 — Beyond 2030** by Kammoun, Habib, and Amina.  
Scientific concepts inspired by NASA Space Apps Challenge 2026 and published NASA ECLSS engineering research. See `docs/13-SOURCES-ATTRIBUTION.md` for full citations and asset licensing information.
