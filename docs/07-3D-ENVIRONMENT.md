# 07 — 3D Mars Environment & Visualization Guide

**Document Status:** Approved 3D Technical Reference  
**Owner:** Habib (Three.js Digital Twin & 3D Experience)  
**Core Technologies:** Three.js, React Three Fiber (`@react-three/fiber`), Drei (`@react-three/drei`)

---

## 1. Visual Direction & Art Style

The visual aesthetic of MissionLab is **authentic, grounded aerospace realism**. It balances credible NASA/ESA architectural concepts with clean, low-to-mid poly educational clarity:
- **Terrain:** Chryse Planitia iron-oxide rust terrain (`#92400e`), layered dust berms, and subtle impact crater ridges.
- **Habitat Architecture:** Modular, pressurized white/grey composite domes, interconnected conduit tunnels, high-efficiency bifacial solar arrays, and exterior industrial piping.
- **Lighting Atmosphere:** Warm Martian sunlight shifted toward amber during dust storms (`#f97316`), paired with dark atmospheric fog (`#26120d` shifting to `#5c2217`).

---

## 2. World Layout & Module Spatial Placement

All 7 modules are organized within an ergonomic operational radius ($r \le 6\text{ meters}$) around the central habitat dome:

```text
                           [Solar Array]
                            (0, 0, -5.0)
                                 │
   [Water Recycler]              │              [Research Lab]
   (-2.8, 0, -2.4)               │               (3.2, 0, -2.0)
          \                      │                     /
           \                     │                    /
            \──── [Crew Habitat (Central Dome)] ────/
                        (0, 0, 0)
            /                    │                    \
           /                     │                     \
          /                      │                      \
   [Life Support]                │                 [Greenhouse]
   (-3.2, 0, 1.2)                │                 (3.5, 0, 1.8)
                           [Battery Bank]
                            (0, 0, 3.8)
```

| Subsystem ID | Spatial Position $(x, y, z)$ | Distinct Geometric Silhouette |
|---|---|---|
| `crew-habitat` | `[0, 0, 0]` | Central hemispherical dome with pressurized airlock port |
| `solar-array` | `[0, 0, -5.0]` | Dual solar photovoltaic wings mounted on a steel mast |
| `battery-bank` | `[0, 0, 3.8]` | Low-profile insulated chemical storage container with LED charge bars |
| `life-support` | `[-3.2, 0, 1.2]` | Twin cylindrical atmospheric scrubbers with cooling manifolds |
| `water-recycler`| `[-2.8, 0, -2.4]` | Vapor compression distillation module with condensation tank |
| `greenhouse` | `[3.5, 0, 1.8]` | Elongated pressurized tunnel with translucent illuminated grow bay |
| `research-lab` | `[3.2, 0, -2.0]` | Hexagonal science hub with spectrometer sensor mast |

---

## 3. Telemetry-Driven Visual Shaders & Beacons

Every module features a visible status beacon and emissive material property directly governed by `module.status`:

| Status | Beacon Color | Hex Code | Material & Animation Behavior |
|---|---|---|---|
| `operational` | Emerald Green | `#10b981` | Steady subtle emissive pulse ($0.2\text{ Hz}$) |
| `warning` | Amber | `#f59e0b` | Medium pulsing beacon ($1.0\text{ Hz}$); panels show dust accumulation |
| `degraded` | Orange / Rust | `#f97316` | Asynchronous warning flicker; reduced operational glow |
| `offline` | Crimson / Dark Red | `#ef4444` | Solid red fault beacon; all interior/panel lights extinguished |
| `repairing` | Cyan Pulse | `#06b6d4` | Fast rhythmic pulsing scale ($2.0\text{ Hz}$) indicating technician activity |

---

## 4. Dust Storm Environmental Dynamics

When `missionState.stormActive` becomes `true`:
1. **Atmospheric Fog:** Exponential fog density increases from $0.015$ to $0.045$, and fog color shifts to rust red (`#5c2217`).
2. **Sunlight Attenuation:** Directional sunlight intensity drops from $2.2$ to $0.8$, shifting from pale cream to deep amber.
3. **Solar Array Materials:** Solar panel emissive tint shifts from vibrant cobalt blue to dull amber-grey, representing thick dust accumulation.

---

## 5. Interaction & Camera Behavior

- **Hover Feedback:** Hovering over any module displays a translucent cyan ring (`opacity: 0.6`) and updates the cursor to a pointer.
- **Selection Highlighting:** Clicking a module locks a rotating selection ring around its base and triggers `onSelectModule(id)`.
- **Orbit Controls Constraints:**
  - `minDistance`: $5\text{ m}$ (prevents clipping into modules)
  - `maxDistance`: $35\text{ m}$ (prevents losing the outpost in the distance)
  - `maxPolarAngle`: $\pi / 2.05 \approx 87^\circ$ (strictly prevents camera from dipping beneath the terrain plane)
  - `enableDamping`: Smooth inertial camera motion (`dampingFactor: 0.08`)

---

## 6. Performance Optimization & WebGL Fallback

- **Draw Call Management:** Instanced geometries or merged static meshes where possible. Total scene draw calls $< 40$.
- **Texture Budgets:** Max $1024 \times 1024$ resolution for any external GLB textures.
- **SSR Safety:** `HabitatScene` is dynamically loaded via Next.js `dynamic(..., { ssr: false })` with a clean CSS-based loading placeholder.

---

## 7. Implementation Notes (Phase 1-5 build)

**Structure** (`src/features/habitat-3d/`): `HabitatScene.tsx` (public entry, WebGL check, error boundary, DOM overlay), `components/` (environment, lighting, sky, dust storm, camera, selection, beacons, infrastructure), `modules/` (one file per `ModuleId`), `utils/visualState.ts` (pure state → visual adapters), `constants/` (layout, status visuals), `__tests__/`.

**Documented deviations from the sections above**
- *Fog/sky colour:* clear-sky haze is a lighter dusty salmon (`#c88a62`) rather than `#26120d`, so the day scene reads as Mars instead of night. Storm haze is `#7a3a22`. Fog densities are `0.015` clear and `0.042` storm (doc: `0.045`) to keep module silhouettes legible.
- *Draw calls:* the `< 40` budget is not met. Static meshes are merged per module and material at mount (`BatchedStatic`); a dev measurement at 1440x900 was about 160 calls (including the shadow pass) and about 77k triangles. Frame pacing, not call count, was the acceptance criterion.
- *Storm phases:* `MissionState` only exposes the boolean `stormActive`. The scene eases a render-only 0..1 intensity toward it (about 2 s up, 3 s down), which reads as approaching / active / recovering. No timer drives gameplay and nothing is written back.
- *Resource-driven indicators:* only values the state already carries are used: battery bank LED strip (`batteryKwh / batteryCapacityKwh`), solar dust (`health`), and module `status`. Water, oxygen and food have no capacity in the contract, so no tank levels are drawn.
- *Status is never colour-only:* beacon shape changes with status (circle, triangle, diamond, square, ring), hovered/selected modules show a text label with the status word, and a DOM status key sits over the viewport.
- *Selection:* one handler group per module with an invisible hit proxy. Clicking empty ground does nothing, because `onSelectModule` has no `null` form in the contract. Double-click focuses; selection changes re-centre the orbit target without changing the viewing angle.
- *Dev only:* `window.__habitatDebug` (renderer, scene, camera) is set outside production builds for profiling.

---

## 8. Equipment Service View (water recycler)

- `viewMode="service"` moves the camera to the recycler's west-facing front and makes **parts** selectable instead of modules: wastewater tank, pump / filter / flow-sensor cartridges (via port lights when the hatch is closed), pressure gauges, treatment stage, clean tank, hatch, control console, spare-parts tray, tool rack, retainer clips, pull handles and the part in hand.
- Every click maps to a typed request in `utils/serviceInteractions.ts` (`actionForHotspot`), e.g. console → `ENTER_MAINTENANCE_MODE` / `CONFIRM_INACTIVE` / `RESTORE_TEST_READY` / `RUN_STARTUP_TEST` by state. The engine validates; the scene only animates toward `training.recycler.procedure` (hatch swing, cartridge slide, clip colour and rotation, held-part orientation).
- Cadet hint outlines follow the learner's own diagnosis (`nextHintKey`), never the real fault.
- Circulation pulses on the output line scale with the true recovery rate (a cue, not a reading).
- Hotspot outlines use `raycast={() => null}`: three.js line raycasting has a large default threshold that otherwise creates huge invisible hit areas.

---

## 9. Interior Habitat

The playable interior (rooms, collision, camera, interaction prompts, task cameras) is specified in [17-PLAYABLE-HABITAT.md](17-PLAYABLE-HABITAT.md). The detailed water recycler model of section 8 is reused unchanged inside the Life Support room.
