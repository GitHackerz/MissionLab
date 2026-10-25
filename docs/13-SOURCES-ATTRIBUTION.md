# 13 — Sources, Citations & Attribution Register

**Document Status:** Mandatory Competition Compliance Document  
**Governing Standard:** LUMEN 2.0 Hackathon Specification Book (Part III, Rules & Attribution)

---

## 1. Competition & Challenge Context

- **Competition:** LUMEN 2.0 — Beyond 2030 (13-page Official Specification Book)
  - Theme: *Humanity Beyond Earth: Developing technological solutions for lunar and Martian settlement.*
  - Evaluation Criteria: SaaS / Solution Quality (30 pts), Innovation & Creativity (25 pts), Future Relevance (20 pts), Problem Significance (10 pts), Technical Defense (15 pts).
- **Concept Inspiration:** NASA Space Apps Challenge 2026 — *Build a Junior Astronaut Mission Trainer*
  - URL: [https://www.spaceappschallenge.org/2026/challenges/build-a-junior-astronaut-mission-trainer/](https://www.spaceappschallenge.org/2026/challenges/build-a-junior-astronaut-mission-trainer/)
  - *Disclaimer:* NASA Space Apps 2026 serves solely as creative concept inspiration. MissionLab has no official affiliation, sponsorship, or certification from NASA.

---

## 2. Scientific Literature & Technical References

The governing concepts in MissionLab are derived from publicly available aerospace engineering research:

1. **NASA Environmental Control and Life Support Systems (ECLSS):**
   - Reference: National Aeronautics and Space Administration (NASA), *ECLSS Architecture and Human Exploration Requirements*.
   - URL: [https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/](https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/)
   - *Application in MissionLab:* Sourced principles for human metabolic water consumption ($0.5\text{ L/h}$ per 4-person crew), oxygen respiration rates ($0.14\text{ kg/h}$), and vapor compression distillation recycling loops.

2. **Martian Dust Storm Atmospheric Impact:**
   - Reference: NASA Mars Exploration Program, *The Fact and Fiction of Martian Dust Storms*.
   - URL: [https://www.nasa.gov/solar-system/the-fact-and-fiction-of-martian-dust-storms/](https://www.nasa.gov/solar-system/the-fact-and-fiction-of-martian-dust-storms/)
   - *Application in MissionLab:* Sourced realistic degradation rates of incident solar irradiance during regional dust storm events (modeled as a 60% collapse in photovoltaic power output).

3. **NASA Mars Surface Architecture White Papers:**
   - Reference: NASA Architecture Concept Review (ACR-23), *Surface Power and Life Support Infrastructure Compiled White Papers*.
   - URL: [https://www.nasa.gov/wp-content/uploads/2024/01/acr23-white-papers-compiled-v10.pdf](https://www.nasa.gov/wp-content/uploads/2024/01/acr23-white-papers-compiled-v10.pdf)
   - *Application in MissionLab:* Architectural basis for modular surface habitats, localized battery storage buffers, and separate agricultural greenhouse bays.

4. **Mars Communications Delay & Disruption:**
   - Reference: NASA Deep Space Network, *Mars Communications Disruption and Delay*.
   - URL: [https://www.nasa.gov/wp-content/uploads/2024/01/mars-communications-disruption-and-delay.pdf](https://www.nasa.gov/wp-content/uploads/2024/01/mars-communications-disruption-and-delay.pdf)
   - *Application in MissionLab:* Motivates the core problem of crew operational autonomy in Chryse Planitia.

---

## 3. Open Source Software Dependencies

Every third-party software library used in MissionLab is open-source and properly licensed:

| Package Name | Version | License | Intended Role in Project |
|---|---|---|---|
| `next` | `^15.5.28` | MIT | Web application framework (App Router) |
| `react` & `react-dom` | `^19.3.1` | MIT | Component UI runtime |
| `three` | `^0.174.0` | MIT | WebGL 3D rendering library |
| `@react-three/fiber` | `^9.8.2` | MIT | React declarative wrapper for Three.js |
| `@react-three/drei` | `^10.7.9` | MIT | Three.js shader, lighting & camera helpers |
| `zustand` | `^5.0.16` | MIT | Lightweight client-side application state |
| `tailwindcss` | `^3.4.19` | MIT | Utility-first CSS styling engine |
| `lucide-react` | `^0.475.0` | ISC | Accessible UI icons |
| `vitest` | `^3.2.7` | MIT | Unit and invariant testing runner |
| `zod` | `^3.25.76` | MIT | TypeScript schema runtime validation |

---

## 4. 3D Meshes, Visual Assets & Media

- **Procedural 3D Geometry:** Phase 0 habitat meshes (Central Dome, Solar Mast, Battery Containers, Distillation Towers, Hydroponic Tunnels) are created procedurally using native Three.js primitives (`CylinderGeometry`, `BoxGeometry`, `SphereGeometry`, `RingGeometry`) authored directly by the team.
- **Palette & Atmosphere:** Color hex values are mathematically derived from Chryse Planitia Viking Lander and Curiosity rover calibrated terrain spectra.
- **Full colony build:** every module, the terrain, rocks, ridgeline, sky dome, dust particles, pipes and tunnels are generated procedurally in code (Three.js primitives, value noise, canvas-generated solar-cell and regolith-grain textures, a local `Lightformer` environment). No external 3D model, texture, HDRI or font is loaded, so there are no additional licences or network fetches at runtime.
- **Astronaut character:** the MissionLab mascot, modelled in Blender from the team's own character sheet by `scripts/blender/build_astronaut.py` and exported to `public/models/astronaut.glb` (no third-party mesh, texture or animation clip). Interior rooms and props are procedural.
- **Third-Party 3D Models:** Any external GLB models imported in subsequent milestones will be logged here with explicit CC-BY or public domain licenses and creator links before presentation.

---

## 5. AI Tooling & Code Generation Disclosures

In strict compliance with LUMEN 2.0 Rules (Part III, Article 4):
- **AI Coding Assistants:** Antigravity / Gemini was utilized as an architectural pair-programmer to scaffold TypeScript contracts, generate documentation blueprints, and format mathematical formulas.
- **Team Verification:** Every line of generated code, equation, and interface contract has been reviewed, tested, and validated by the team engineers (Kammoun, Habib, Amina). The team can defend every algorithm and line of code during jury questioning.
