# 11 — Testing and Quality

Run the locked dependency installation, then `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Lint uses the installed flat ESLint configuration (`eslint .`); Next 15's deprecated `next lint` invocation is not used. Build output and dependencies are ignored by ESLint.

The Vitest suite covers shared contracts, independently calculated resource balances, priority supply and unserved demand, production dependencies, bounds, numeric validation, scheduled events, repair timing, complete power/water/oxygen/success outcomes, terminal validation, deterministic replay, same-hour decisions, hourly history, independent branch prefixes, terminal-state rewind, store integration, and the review panel's rewind control.

Canonical paths and exact mathematical expectations are documented in [04-SIMULATION-ENGINE.md](04-SIMULATION-ENGINE.md). `runRedStormPaths` is an exported fixture helper that runs the actual engine; the scenario test prints its computed results. Fixtures use reachable engine states instead of hand-authored mock totals.

A safety limit is not resource exhaustion: water terminates at 14 L, oxygen at 1.5 kg. Battery warning does not end the mission. Essential supply shortfall does. Tests intentionally enforce failure before success at duration expiry.

The UI component integration test exercises real store state without mounting WebGL. It does not establish browser GPU performance, mobile layout quality, or visual correctness of the 3D scene. Those remain frontend verification tasks.

See [16-IMPLEMENTATION-REPORT.md](16-IMPLEMENTATION-REPORT.md) for executed checks and environment constraints.
