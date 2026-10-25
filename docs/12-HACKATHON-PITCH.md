# 12 — Hackathon Pitch & Jury Defense Guide

**Event:** LUMEN 2.0 — Beyond 2030  
**Scheduled Pitch:** 25 October 2026, 09:00  
**Pitch Time Budget:** 5 Minutes Live Presentation & Demo + 5 Minutes Jury Q&A  
**Presenters:** Amina (Product & Flow), Habib (3D & Visuals), Kammoun (Simulation & Defense)

---

## 1. Five-Minute Pitch Outline & Timecode Script

| Timecode | Speaker | Section | Visual on Screen | Core Message / Takeaway |
|---|---|---|---|---|
| **0:00 – 0:45** | **Amina** | Hook & Future Problem | Chryse Planitia 3D Habitat during peaceful sunrise | *"Beyond 2030, humans on Mars will face 20-minute communication delays with Earth. Trainees cannot rely on Houston; they must master systems thinking under high constraints."* |
| **0:45 – 1:30** | **Habib** | The 3D Digital Twin | Interacting with 3D modules; clicking Water Recycler | *"This is not decorative art. Every 3D mesh, emissive beacon, and dust shader is directly bound to a deterministic simulation engine running in TypeScript."* |
| **1:30 – 2:30** | **Amina** | The Crisis & Bad Decision | Dust Storm arrives; fast-forward to Hour 26 essential power shortage | *"A dust storm cuts solar to 4 kW. The student leaves optional science running. Battery drains. At Hour 26, solar and depleted storage cannot fully supply essential electrical demand."* |
| **2:30 – 3:30** | **Kammoun** | Mission Autopsy & Rewind | Mission Autopsy screen; clicking "Rewind to Hour 0" | *"No 'Game Over' screens. Mission Autopsy uses structured telemetry evidence to explain the causal chain. We rewind time to Hour 0, shed non-essential loads, and repair the pump."* |
| **3:30 – 4:30** | **Amina** | Alternate Victory & Compare | Fast-forward to Hour 72; recorded branch comparison | *"On the exact same physics engine, the colony survives 72 hours. Recorded branch comparison shows how operational trade-offs save lives."* |
| **4:30 – 5:00** | **All** | SaaS Vision & Wrap | SaaS roadmap graphic & architecture diagram | *"MissionLab turns complex space engineering into intuitive systems thinking. Thank you."* |

---

## 2. Centerpiece Live Demonstration Flow

The live demo follows a strict, rehearsed, high-drama arc:
1. **The Setup:** Open Mission 01 in Chryse Planitia. Point out the initial $110\text{ kWh}$ battery and four crew members. The storm is already active at initialization.
2. **The Shock:** Inspect the recorded Hour 0 dust storm. Show the visual environment turn into a dense Martian rust storm and solar power collapse to $4.0\text{ kW}$.
3. **The Mistake:** Explain that a typical student neglects power loads. Advance time by $+6\text{h}$ multiple times. Show battery gauge steadily drop into the red ($13.2\text{ kWh}$). At Hour 26, essential electrical shortage terminates the mission.
4. **The Autopsy:** Transition to the Mission Autopsy. Explain the recorded causal evidence: *"At Hour 0, keeping greenhouse (2.5 kW) and lab (1.5 kW) active created a 4.4 kW deficit, exhausting stored energy at Hour 25 and leaving essential demand unserved during the following interval."*
5. **The Rewind:** Open "Mission Autopsy & Rewind", select the initial Hour 0 state, and click "Create alternative branch". The storm remains active under the same environmental assumptions.
6. **The Correction:** Click Greenhouse -> Suspend ($+2.5\text{ kW}$ margin). Click Research Lab -> Pause ($+1.5\text{ kW}$ margin). Advance to Hour 30.
7. **The Secondary Fault:** Recycler pump fails! Explain the maintenance dilemma. Select the recycler and confirm "Repair Water Recycler". Advance four one-hour steps. Show the pump restore to operational green. Advance to Hour 72.
8. **The Victory & Comparison:** Mission Accomplished banner appears. Open the review panel and show the preserved original failure and the active successful branch. The survival policy ends with 81.2 kWh battery, 14.6 L water and 6.44 kg oxygen.

---

## 3. Anticipated Jury Questions & Authoritative Answers

### Q1: "Is this a real digital twin or just a 3D game?"
> **Answer (Habib):** *"It is an interactive digital-twin-style educational simulation. We are completely honest: it does not ingest live telemetry from NASA spacecraft. However, unlike traditional games where outcomes are scripted or pre-rendered, our 3D visualization is directly driven by a pure, decoupled simulation engine calculating conservation equations in real time."*

### Q2: "Are your physical numbers NASA validated?"
> **Answer (Kammoun):** *"Our scientific concepts—such as Sabatier CO₂ recovery, water distillation loops, and solar dust degradation—are directly sourced from published NASA ECLSS research papers. However, our numerical values are educational approximations calibrated to create a balanced, pedagogically rigorous 72-hour teaching scenario rather than certified flight software."*

### Q3: "Why not use Generative AI to narrate the simulation outcomes?"
> **Answer (Kammoun):** *"Life-support survival must be auditable and mathematically reproducible. Generative LLMs hallucinate physics. In MissionLab, every failure and autopsy conclusion is deterministically derived from logged state transitions. We plan to introduce AI post-hackathon only as a constrained Socratic tutor that explains verified engine evidence."*

### Q4: "How does this become a viable SaaS business beyond the hackathon?"
> **Answer (Amina):** *"Our commercial model targets institutional B2B subscriptions for secondary schools, science academies, and space camps. Teachers get a cohort dashboard to assign mission scenarios, review student decision autopsies, and evaluate systems-thinking competencies aligned with Next Generation Science Standards (NGSS)."*

---

## 4. Emergency Demo Contingency Plan

- **Wi-Fi Outage:** The production build is completely statically bundled. We have a pre-tested local version running on `localhost:3000` requiring zero internet connectivity.
- **WebGL Crash:** If the judging laptop's graphics driver encounters an unexpected issue, the fixture dropdown in the header allows instantaneous demonstration of all 6 mission states and the autopsy comparison via 2D telemetry panels.
- **Hardware Failure:** A 60-second backup video capture of the full playthrough is cached on a USB thumb drive and mobile phone.
