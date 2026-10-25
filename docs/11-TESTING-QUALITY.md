# 11 — Testing and Quality

Run the locked dependency installation, then `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Lint uses the installed flat ESLint configuration (`eslint .`); Next 15's deprecated `next lint` invocation is not used. Build output and dependencies are ignored by ESLint.

The Vitest suite covers shared contracts, independently calculated resource balances, priority supply and unserved demand, production dependencies, bounds, numeric validation, scheduled events, repair timing, complete power/water/oxygen/success outcomes, terminal validation, deterministic replay, same-hour decisions, hourly history, independent branch prefixes, terminal-state rewind, store integration, and the review panel's rewind control.

Canonical paths and exact mathematical expectations are documented in [04-SIMULATION-ENGINE.md](04-SIMULATION-ENGINE.md). `runRedStormPaths` is an exported fixture helper that runs the actual engine; the scenario test prints its computed results. Fixtures use reachable engine states instead of hand-authored mock totals.

A safety limit is not resource exhaustion: water terminates at 14 L, oxygen at 1.5 kg. Battery warning does not end the mission. Essential supply shortfall does. Tests intentionally enforce failure before success at duration expiry.

The UI component integration test exercises real store state without mounting WebGL. It does not establish browser GPU performance, mobile layout quality, or visual correctness of the 3D scene. Those remain frontend verification tasks.

See [16-IMPLEMENTATION-REPORT.md](16-IMPLEMENTATION-REPORT.md) for executed checks and environment constraints.

---

## Training Tests

- `src/simulation/__tests__/training.test.ts`: fault evidence consistency, hypothesis support, procedure validation (order, tools, compatibility, orientation, spares, interruption, retry), correct/wrong replacement, verification, power forecast vs engine, greenhouse trade-off, replay from snapshot, guidance, rejection logging.
- `src/features/habitat-3d/__tests__/serviceInteractions.test.ts`: hotspot → engine request mapping and cadet hints.
- `src/features/mission-ui/__tests__/panels.test.tsx`: evidence collection, rejections, full repair through the UI buttons, planner apply, rewind with comparison.
- WebGL interaction was verified manually in a browser with Playwright (real clicks through the 3D hotspots); there is no automated WebGL test in CI.

---

## Playable Habitat Tests

`src/features/explore/__tests__/core.test.ts` (collision, layout, targeting, task lifecycle) and `input-ui.test.tsx` (input handling, stuck-key prevention, listener cleanup, task surfaces and mission-state persistence without WebGL). Movement, camera and 3D task interaction were verified manually in a browser (Playwright); they are not part of CI.

## Atmospheric expansion verification

Additional suites cover gas-species conservation, pressure faults and isolation, separate oxygen/CO₂ balances, treatment power and consumables, all six new fault variants, genuine failures, wrong interventions, safe recovery, minute history, terminal rewind, mission-isolated saves, invalid/versioned save recovery, catalog/HUD routing, companion context and UI action validation. Executed gates and limitations are in [21-MULTI-MISSION-EXPANSION.md](21-MULTI-MISSION-EXPANSION.md). Unit tests alone are not evidence of browser success.
