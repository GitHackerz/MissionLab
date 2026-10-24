# 15 — Architecture Decisions (ADRs) & Risk Register

**Document Status:** Approved Architectural Record  
**Lead Author:** Principal Software Architect

---

## 1. Architecture Decision Records (ADRs)

### ADR-001: Selection of Next.js App Router
- **Context:** We need a modern, high-performance web framework for rapid UI integration, clean TypeScript support, and zero-configuration Vercel deployment.
- **Decision:** Use Next.js 15+ App Router with React 19.
- **Consequences:** Provides fast client-side navigation, static page optimization, and seamless integration with Tailwind CSS and Zustand. Dynamic client imports (`ssr: false`) are used for 3D canvas mounting.

### ADR-002: Selection of Three.js via React Three Fiber & Drei
- **Context:** We require an interactive 3D Mars habitat that integrates cleanly into React state without maintaining an unwieldy imperative Three.js lifecycle.
- **Decision:** Adopt `@react-three/fiber` (R3F) and `@react-three/drei`.
- **Consequences:** Declarative scene composition; meshes react cleanly to Zustand state changes. Strict draw-call and geometry budgets prevent performance degradation on mobile/integrated GPUs.

### ADR-003: Pure TypeScript Simulation Engine Decoupled from React
- **Context:** The simulation must be 100% deterministic, testable in headless CI environments, and capable of instant timeline rewinds and A/B branch comparisons.
- **Decision:** Implement the simulation engine as pure TypeScript functions with zero imports of React, Zustand, Three.js, or DOM APIs.
- **Consequences:** The engine can be tested with Vitest in milliseconds. The same engine runs in browser web workers, serverless endpoints, or CLI scripts without modification.

### ADR-004: Lightweight State Bridge via Zustand
- **Context:** Both the 3D scene (Habib) and the Mission Control HUD (Amina) need concurrent, low-overhead access to the current `MissionState` and selection identifiers.
- **Decision:** Use Zustand as the sole application state bridge.
- **Consequences:** Avoids Redux boilerplate; prevents unnecessary re-renders of the 3D canvas; provides a simple dispatch interface for player actions.

### ADR-005: Fixed-Step Determinism over Real-Time Physics Engines
- **Context:** Traditional game physics engines (e.g., Ammo, Rapier) compute variable delta-time integrations that lead to non-deterministic divergence when rewound.
- **Decision:** Use discrete fixed-step integration ($\Delta t = 1\text{ hour}$).
- **Consequences:** Mathematically reproducible state transitions; simple snapshotting; zero frame-rate dependence.

### ADR-006: Exclusion of Backend Databases for Hackathon MVP
- **Context:** Running PostgreSQL, Redis, or NestJS introduces network latency, authentication barriers, and high risk of failure during live pitch demos.
- **Decision:** Host all snapshot history and scenario execution entirely within browser memory for the MVP.
- **Consequences:** 100% offline resilience; instant response times; zero cloud infrastructure cost for the hackathon.

### ADR-007: Digital-Twin-Style Simulation vs. Real Spacecraft Telemetry
- **Context:** We must establish clear, defensible boundaries regarding what the product claims to be.
- **Decision:** Explicitly market MissionLab as an *educational digital-twin-style simulation*.
- **Consequences:** Protects credibility with the jury; prevents confusion with operational flight software.

### ADR-008: Exclusion of Generative AI from Physical Calculations
- **Context:** Generative LLMs hallucinate numbers and cannot guarantee physical conservation laws.
- **Decision:** All resource transitions and autopsy causal chains are computed deterministically.
- **Consequences:** Transparent, defensible mathematics that can withstand technical scrutiny by the jury.

---

## 2. Risk Management Register

| Risk ID | Category | Description | Severity | Likelihood | Mitigation Strategy & Owner |
|---|---|---|---|---|---|
| **RSK-01** | Technical | 3D Canvas crashes or renders black screen on older hardware | High | Low | Low-poly procedural geometry fallback; client dynamic import with error boundary (Habib). |
| **RSK-02** | Technical | Non-deterministic divergence during timeline rewind | High | Low | Automated Vitest replay tests validating floating-point parity (Kammoun). |
| **RSK-03** | Presentation | Unreliable Wi-Fi during the live LUMEN pitch | Critical | Medium | Static build runs entirely on `localhost:3000` with pre-cached assets (Amina). |
| **RSK-04** | Presentation | Exceeding the strict 5-minute pitch time limit | High | Medium | Rehearsed script with timecoded transitions; single narrator flow (All). |
| **RSK-05** | Product | Jury perceives product as an oversimplified quiz game | High | Low | Emphasize deterministic conservation math, autopsy causal graph, and counterfactual rewind (Amina). |
| **RSK-06** | Product | Jury questions NASA endorsement or flight fidelity | Medium | Low | Explicit disclosures in README and pitch: calibrated educational approximations (All). |
| **RSK-07** | Team | Integration merge conflicts between UI and 3D workstreams | Medium | Low | Rigid file ownership: `habitat-3d/` (Habib), `mission-ui/` (Amina), `simulation/` (Kammoun). |
