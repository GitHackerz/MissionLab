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
