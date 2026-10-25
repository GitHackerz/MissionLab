# 03 — Mission Scenarios & Gameplay Specifications

## Mission 01: The Red Storm (implemented)

A fictional 2045 habitat in Chryse Planitia houses four astronauts. At hour 0, a severe storm reduces solar generation to 4 kW. At hour 30, the water-recycler pump fails. Survive 72 hours with essential electrical supply and reserves above the water/oxygen safety limits. Battery at or below 15 kWh is a warning, rather than a terminal condition. Water at or below 14 L and oxygen at or below 1.5 kg end the mission. Communications delay is narrative context; no communications queue is implemented.

### Scheduled conditions and outcomes

| Hour | Condition |
|---|---|
| 0 | Storm active on initialization; generation 4 kW |
| 1 | First demand/generation deficit record |
| 22 | All-on battery warning: 13.2 kWh |
| 25 | All-on battery empty; that interval was still fully supplied |
| 26 | All-on essential power shortfall: solar cannot fully supply recycler |
| 30 | Pump fault, recovery becomes zero; repair action available |
| 34 | Four-hour repair started at 30 completes; recovery resumes next interval |
| 50 | Conservation without repair fails at 13.6 L water |
| 72 | Conservation with repair succeeds; storm still active |

### Decisions and tradeoffs

- Suspend/restore greenhouse lighting: changes requested demand by 2.5 kW. Agricultural yield is not scored in this version.
- Pause/resume research: changes requested demand by 1.5 kW. Each fully supplied research hour earns one science point.
- Repair a genuinely damaged recycler: consumes exactly one spare, requires four full intervals, cannot start twice.
- Advance one or six hours: retains every intermediate hourly snapshot and stops at a terminal outcome.
- Rewind to an hourly snapshot or exact same-hour decision: creates an independent branch and preserves the original future.

### Canonical playthroughs

| Policy | Result | Hour | Battery kWh | Water L | Oxygen kg | Science |
|---|---|---:|---:|---:|---:|---:|
| Leave optional loads enabled | Power failure | 26 | 0 | 27.82 | 5.52 | 25 |
| Suspend both at 0; ignore pump | Water failure | 50 | 90 | 13.60 | 6.00 | 0 |
| Suspend both at 0; repair at 30 | Success | 72 | 81.20 | 14.60 | 6.44 | 0 |

The successful policy keeps both optional loads off through hour 72. Other research schedules can be explored using the same engine; no score or outcome is hardcoded. Oxygen production consumes 0.18 L/h process water at nominal output, making normal water loss 0.26 L/h and fault/repair loss 0.68 L/h. All equations, interval conventions and simplifying assumptions are in [04-SIMULATION-ENGINE.md](04-SIMULATION-ENGINE.md).

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
