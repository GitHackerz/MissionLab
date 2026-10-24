# 08 — UI/UX Design System & Experience

**Document Status:** Approved UI/UX Design System  
**Owner:** Amina (Application UI/UX, SaaS Experience & Integration)

---

## 1. Design Philosophy

MissionLab rejects dark, illegible "Hollywood sci-fi" tropes in favor of a **modern, high-contrast, professional aerospace SaaS interface**:
- **Clarity over Clutter:** No faux-futuristic decorative borders, unreadable scanlines, or flashing neon text.
- **Cognitive Ergonomics:** Telemetry meters use standard engineering units (`kW`, `kWh`, `kg`, `L`) with explicit safety thresholds.
- **Multimodal Status:** Status is never communicated by color alone. Every warning combines an icon, a descriptive label, and numeric values.

---

## 2. Layout Structure & Information Architecture

The mission viewport is organized into a clean, desktop-first command center:

```text
+----------------------------------------------------------------------------------------------------+
| MISSIONLAB | MISSION 01: THE RED STORM | HOUR 14 / 72h | [+1h] [+6h] [Reset] | Fixture Selector     |
+----------------------------------------------------------------------------------------------------+
| BATTERY: 85.0/150 kWh  |  WATER: 31.5 L  |  OXYGEN: 5.20 kg  |  CREW: 4 SAFE  |  SCIENCE: 35 PTS   |
+-------------------------------------------------------------------------+--------------------------+
|                                                                         | SUBSYSTEM INSPECTOR      |
|                                                                         | Water Recycler           |
|                                                                         | [OPERATIONAL / DEGRADED] |
|                        INTERACTIVE 3D MARS HABITAT                      |                          |
|                                                                         | Health: 35% [====----]   |
|                                                                         | Power: 1.2 kW (0.6 kW)   |
|                                                                         |                          |
|                                                                         | OPERATIONAL DECISION:    |
|                                                                         | [Repair Water Recycler]  |
|                                                                         | Cost: 1 Spare, 4h work   |
+-------------------------------------------------------------------------+--------------------------+
| MISSION EVENT STREAM & TELEMETRY LOG                                                               |
| [H00] Martian dust storm arrived. Solar collapsed to 4.0 kW.                                       |
| [H04] Net power deficit is 4.4 kW. Battery discharging at high rate.                               |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Component Design Specifications

### 3.1 Mission Header (`MissionHeader.tsx`)
- **Brand Identity:** MissionLab mark + LUMEN 2.0 hackathon badge.
- **Status Pills:** Color-coded status capsules (e.g., `Nominal State`, `Storm Active`, `Mission Accomplished`, `Mission Failed`).
- **Simulation Clock:** Large monospace readout (`HOUR XX / 72h`) with discrete action buttons (`+1h`, `+6h`, `Reset`).
- **Dev Fixture Selector:** Direct dropdown enabling instant inspection of all 6 intermediate test states.

### 3.2 Telemetry HUD (`ResourceHud.tsx`)
- 5-card metric bar providing live readouts for:
  1. **Electrical Power:** Stored energy (kWh), capacity (150 kWh), and low-reserve alert banner when $\le 15\text{ kWh}$.
  2. **Potable Water:** Reserve volume (L), current net rate ($-0.08\text{ L/h}$ vs $-0.50\text{ L/h}$), and spare parts count.
  3. **Atmospheric Oxygen:** Stored mass (kg), consumption rate ($0.14\text{ kg/h}$), and ECLSS status.
  4. **Crew Status:** Surviving astronaut headcount and thermal heating demand.
  5. **Scientific Progress:** Accumulated research points and lab operational state.

### 3.3 Subsystem Inspector (`ModuleInspector.tsx`)
- **Bidirectional Module Pills:** Quick selector buttons at the top of the panel let the user inspect any subsystem directly from the UI, keeping selection in exact lockstep with 3D clicks.
- **Telemetry Breakdown:** Equipment health gauge, power demand vs supplied power, and remaining maintenance hours.
- **Action Triggers:** Action cards detailing power deltas, required spare parts, and descriptive trade-offs.

### 3.4 Mission Event Stream (`EventTimeline.tsx`)
- Reverse chronological telemetry log.
- Severity-coded event items:
  - `info`: Sky-blue indicator with operational notices.
  - `warning`: Amber triangle with threshold alerts.
  - `critical`: Red octagon with emergency failures.

---

## 4. Mission Autopsy & Debrief Screen (Milestone 4 Design)

When a mission concludes at Hour 72 or suffers terminal failure, the screen transitions to the **Mission Autopsy**:
- **Outcome Hero Banner:** Prominent success or failure verdict with survival duration.
- **Causal Chain Visualization:** Step-by-step breakdown connecting initial decisions to downstream bottlenecks.
- **Resource Margin Gauges:** Minimum battery, water, and oxygen margins reached during the run.
- **Timeline Rewind Trigger:** Interactive snapshot slider allowing the student to rewind to any decision point and re-run the mission on an alternate branch.
- **Side-by-Side Comparison:** Comparison table displaying Branch A vs Branch B telemetry deltas.
