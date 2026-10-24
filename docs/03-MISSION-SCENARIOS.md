# 03 — Mission Scenarios & Gameplay Specifications

**Document Status:** Approved Game Design Document (GDD)  
**Lead Author:** Game Systems Architect

---

## 1. Flagship Scenario — Mission 01: The Red Storm

### 1.1 Narrative Premise
- **Year:** 2045
- **Location:** Chryse Planitia Research Outpost, Mars (22.4° N, 49.9° W)
- **Crew:** 4 Astronaut Specialists (Commander, ECLSS Engineer, Agricultural Specialist, Geologist)
- **Context:** An unexpected high-altitude dust storm blankets Chryse Planitia. Suspended atmospheric particulate reduces incident solar radiation drastically. At the same time, the colony's primary wastewater distillation unit develops a mechanical pump fault. With communications with Earth delayed by 18 minutes each way, the crew must manage critical dependencies autonomously over a 72-hour crisis window.

### 1.2 Mission Objectives
1. **Primary Directive (P0):** Maintain all 4 crew members safe and alive for 72 elapsed simulation hours.
2. **Resource Integrity Directive (P0):** Ensure battery reserves remain above 0 kWh (safety threshold $\ge 15\text{ kWh}$), water reserves above 0 L (safety threshold $\ge 14\text{ L}$), and oxygen reserves above 0 kg (safety threshold $\ge 1.5\text{ kg}$).
3. **Scientific Secondary Directive (P1):** Maximize geological research points and protect hydroponic crop viability if power reserves permit.

---

## 2. Event Timeline & Critical Milestones

```text
Hour 00:00 ─── DUST STORM ARRIVAL: Solar generation collapses from 10.0 kW to 4.0 kW.
               Learner must evaluate power load shedding.
Hour 04:00 ─── BATTERY WARNING: If no loads shed, net deficit is 4.4 kW (draining battery).
Hour 22:00 ─── CRITICAL ENERGY THRESHOLD: Battery breaches 15 kWh safety reserve on un-shed branch.
Hour 25:00 ─── [PATH A TERMINATION]: Total battery exhaustion triggers ECLSS shutdown. Blackout failure.
Hour 30:00 ─── SECONDARY FAULT: Water recycler distillation pump impeller seizes.
               Recovery rate drops from 0.42 L/h to 0.00 L/h.
Hour 34:00 ─── REPAIR WINDOW: If repair was initiated at Hour 30, pump replacement concludes.
Hour 68:00 ─── [PATH B TERMINATION]: If recycler was never repaired, water reserves reach zero.
Hour 72:00 ─── [PATH S VICTORY]: Storm subsides; Chryse Planitia habitat declared safe.
```

---

## 3. Player Operational Decisions

Every action is formally defined with strict preconditions, engineering costs, and systemic trade-offs:

| Action ID | Target Subsystem | Preconditions | Resource / Time Cost | Systemic Consequence & Trade-off |
|---|---|---|---|---|
| `toggle-greenhouse` | `greenhouse` | Module is functional | $\Delta P = \pm 2.5\text{ kW}$ | Suspending lighting saves 2.5 kW power immediately, but halts crop growth and caps end-mission agricultural score. |
| `toggle-research-lab` | `research-lab` | Module is functional | $\Delta P = \pm 1.5\text{ kW}$ | Pausing science saves 1.5 kW power immediately, but freezes mission science score points. |
| `repair-water-recycler`| `water-recycler` | Recycler `degraded` or `offline`; spare pumps $> 0$; not currently repairing | 1 Spare Pump, 4 elapsed simulation hours | Restores water recovery from 0.0 to 0.42 L/h upon completion. Consumes habitat's sole spare mechanical assembly. |
| `advance-time-1h` | Simulation Engine | Mission status is `running` | +1 simulation hour | Steps physical conservation equations forward by 1 hour. |
| `advance-time-6h` | Simulation Engine | Mission status is `running` | +6 simulation hours | Fast-forwards physical conservation equations by 6 hours. |
| `rewind-to` | Session History | Target snapshot exists ($0 \le H \le \text{current}$) | Zero physical cost | Forks execution into a new timeline branch from the selected snapshot. |

---

## 4. Playthrough Branch Profiles

### 4.1 Failure Path A: The Complacent Commander (Energy Collapse)
1. **Hour 0:** Storm strikes. Player leaves greenhouse (+2.5 kW) and science lab (+1.5 kW) running.
2. **Hour 1–20:** Total power demand is $8.4\text{ kW}$. Solar input is $4.0\text{ kW}$. Net drain is $4.4\text{ kWh/h}$.
3. **Hour 22:** Battery breaches the $15\text{ kWh}$ reserve (reading $13.2\text{ kWh}$). Warning banners flash.
4. **Hour 25:** Battery reaches $0\text{ kWh}$. Central breaker trips. ECLSS life support loses power.
5. **Autopsy Verdict:** *"Failure A: Electrical Blackout at Hour 25. High optional loads exhausted energy reserves during storm conditions."*

### 4.2 Failure Path B: The Fixated Technician (Water Dehydration)
1. **Hour 0:** Player correctly pauses greenhouse and science lab. Net drain drops to $0.4\text{ kW}$. Battery is safe.
2. **Hour 30:** Water recycler pump fails. Water recovery drops to $0.0\text{ L/h}$. Net loss becomes $-0.50\text{ L/h}$.
3. **Hour 30–70:** Player ignores the degraded recycler to preserve the spare pump. Water inventory steadily drops from $31.5\text{ L}$ to $0\text{ L}$.
4. **Hour 68:** Water reserve is exhausted. Crew dehydration emergency declared.
5. **Autopsy Verdict:** *"Failure B: Dehydration Emergency at Hour 68. Power was managed successfully, but deferred pump maintenance drained potable reserves below critical minimums."*

### 4.3 Success Path S: The Agile Systems Commander (Survival & Balance)
1. **Hour 0:** Player sheds greenhouse ($2.5\text{ kW}$) and science ($1.5\text{ kW}$) loads. Net drain is $-0.4\text{ kW}$.
2. **Hour 30:** Recycler pump fails. Player immediately inspects the module and authorizes a pump replacement using the spare part.
3. **Hour 34:** 4 hours of repair conclude successfully. Water recovery returns to $0.42\text{ L/h}$.
4. **Hour 40:** Seeing healthy battery reserves ($> 70\text{ kWh}$), player selectively re-enables the research lab for 20 hours to accumulate scientific points.
5. **Hour 72:** Mission concludes with all 4 crew members safe, $48.5\text{ kWh}$ in batteries, $26.8\text{ L}$ water, and an 85-point science score.

---

## 5. Future Mission Scenarios (Post-Hackathon Catalog)

These scenarios illustrate how the MissionLab architecture extends to a curriculum-aligned mission catalog:

### Mission 02: ECLSS Atmospheric Cascade (Grade Level 9–12)
- **Crisis:** Sabatier carbon dioxide reduction reactor malfunctions. Carbon dioxide levels in the habitat rise while oxygen generation becomes constrained.
- **Concepts:** Atmospheric partial pressures, CO₂ toxicity thresholds, chemical scrubber saturation.

### Mission 03: The Solar Proton Event (Grade Level 10–University)
- **Crisis:** Coronal mass ejection (CME) produces an intense solar particle storm. Crew must retreat to the pressurized regolith storm shelter while keeping critical systems operating remotely.
- **Concepts:** Radiation shielding half-value layers, remote telemetry control, emergency load shedding.

### Mission 04: Hydroponic Nitrogen Depletion (Grade Level 8–11)
- **Crisis:** Closed-loop crop nutrient cycle suffers a biofilter bacterial crash. Crop plants exhibit chlorosis, threatening long-term food rations.
- **Concepts:** Nitrogen cycle, closed ecological life support systems, biological recycling buffers.

### Mission 05: Earth Communications Blackout (Grade Level 9–12)
- **Crisis:** Mars solar conjunction blocks radio communications between Earth and Mars for 14 days. Autonomous operational decision-making with zero ground telemetry support.
- **Concepts:** Autonomous systems, delayed feedback loops, contingency reserves.
