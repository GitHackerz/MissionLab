## Description
<!-- Provide a clear summary of changes and reference relevant tasks from docs/10-DEVELOPMENT-ROADMAP.md -->

## Workstream Owner
- [ ] Kammoun (Simulation Engine / Game Logic)
- [ ] Habib (3D Digital Twin / Habitat Visualization)
- [ ] Amina (Application UI/UX / Integration)
- [ ] Shared / Architecture

## Contract & Interface Impact
- [ ] No changes to shared contracts (`src/simulation/types.ts`)
- [ ] Changed shared contracts (requires agreement from all 3 owners & updated `docs/06-INTERFACES-CONTRACTS.md`)

## Checklist
- [ ] Code compiles in TypeScript strict mode (`pnpm typecheck`)
- [ ] ESLint passes (`pnpm lint`)
- [ ] Automated tests pass (`pnpm test`)
- [ ] Production build succeeds (`pnpm build`)
- [ ] No console errors or warnings in browser
- [ ] Third-party assets/dependencies credited in `docs/13-SOURCES-ATTRIBUTION.md`
