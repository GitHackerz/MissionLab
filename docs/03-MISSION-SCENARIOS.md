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

## Implemented mission catalog

| Number | Stable ID | Mission | Core learning |
|---|---|---|---|
| 01 | `mission-01-red-storm` | The Red Storm | Power, water recovery and evidence-based maintenance |
| 02 | `mission-02-pressure-drop` | Pressure Drop | Gas conservation, compartment isolation and pressure verification |
| 03 | `mission-03-silent-air` | Silent Air | CO₂ removal, ventilation, oxygen distinctions and independent instruments |

All three are playable, with identical physics across Cadet/Engineer/Commander guidance levels. New atmospheric missions offer reproducible Exercise A/B/C fault variants without revealing the cause in their briefings. Full equations, assumptions, reference paths and verification are in [21-MULTI-MISSION-EXPANSION.md](21-MULTI-MISSION-EXPANSION.md).

Older design documents used “Mission 02” for a speculative ECLSS cascade and “Mission 03” for a solar-proton event. These speculative display assignments are retired; no playable save IDs existed for them. Silent Air implements an atmospheric-treatment exercise, not a Sabatier model. Radiation, hydroponic nutrient depletion and communications blackout remain **unnumbered future concepts, not playable missions**. No radiation scenario was added in this milestone.

---

## Training Update: Mission 01 as implemented

- The mission opens under the dust storm at Hour 0, as in the simulation-core engine.
- Hour 30: the engine reports only the **symptom** ("recovery below expected range"). The configured root cause (default pump cartridge; filter obstruction and sensor drift are also supported) must be diagnosed from evidence.
- A repair is the validated maintenance procedure (about 2 simulated hours, one spare part), not a 4-hour button. Wrong replacements consume spares and fail verification.
- An ignored recycler fault ends in failure when water reaches the 14 L safety threshold (simulation-core rule).
- See [16-TRAINING-DESIGN.md](16-TRAINING-DESIGN.md) for the full journey.
