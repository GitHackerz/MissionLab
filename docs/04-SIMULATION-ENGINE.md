# 04 — Simulation Engine & Mathematical Models

**Document Status:** Approved Engineering Specification  
**Owner:** Kammoun (Simulation Engine & Game Logic)  
**Dependencies:** Pure TypeScript, zero React/DOM/Three.js imports

---

## 1. Engine Architecture & Determinism Principles

The MissionLab simulation engine is a **pure, deterministic, state-transition machine**. It is completely decoupled from UI rendering, framerates, animation loops, and browser graphics APIs.

```text
(State_t, Action_t, Environment_t) ───[ Pure Transition Function ]───> State_{t+1}
```

### Determinism Invariants
1. **Frame Independence:** The simulation advances solely when `advanceMission(state, deltaHours)` is invoked. Whether the browser renders at 120 FPS, 30 FPS, or drops frames during complex 3D rendering, the underlying physics are identical.
2. **Strict Invariant Bounds:**
   - $0 \le \text{batteryKwh} \le \text{batteryCapacityKwh}$ ($150\text{ kWh}$)
   - $\text{waterLiters} \ge 0$
   - $\text{oxygenKg} \ge 0$
   - $\text{health} \in [0.0, 1.0]$
3. **No Unaccounted Shortfalls:** When energy or resources are exhausted, the engine logs the exact unserved load and identifies which subsystems lost power, rather than silently clamping numbers.

---

## 2. Mathematical Governing Equations

### 2.1 Electrical Power & Energy Balance
At each simulation step $\Delta t = 1\text{ hour}$:

$$P_{\text{solar}} = \begin{cases} 4.0\text{ kW} & \text{if stormActive = true} \\ 10.0\text{ kW} & \text{if stormActive = false} \end{cases}$$

Total active electrical load:
$$P_{\text{demand}} = \sum_{m \in \text{Modules}} (m.\text{enabled} \land m.\text{status} \ne \text{offline} \ ?\ m.\text{powerDemandKw} : 0)$$

Subsystem default power demands:
- `life-support`: $2.0\text{ kW}$ (Essential)
- `crew-habitat` (Thermal Heating): $1.2\text{ kW}$ (Essential)
- `water-recycler`: $1.2\text{ kW}$ (Essential during nominal recycling)
- `greenhouse`: $2.5\text{ kW}$ (Optional grow lighting)
- `research-lab`: $1.5\text{ kW}$ (Optional computational arrays)

Net power balance:
$$P_{\text{net}} = P_{\text{solar}} - P_{\text{demand}}$$

Battery state transition:
$$E_{t+1} = \max\left(0, \min\left(150, E_t + P_{\text{net}} \cdot \Delta t\right)\right)$$

If $E_{t+1} = 0$, an **energy blackout** occurs:
- Central circuit breaker trips.
- `life-support` status $\to$ `offline`, supplied power $\to 0$.
- Habitat temperature management fails.
- Mission status $\to$ `failed`.

### 2.2 Potable Water Balance
Water inventory evolves based on crew metabolic consumption and mechanical recycling recovery:

$$W_{t+1} = \max\left(0, W_t + (R_{\text{water}} - C_{\text{water}}) \cdot \Delta t\right)$$

Where:
- $C_{\text{water}} = 0.50\text{ L/h}$ (Total crew consumption: 4 crew $\times 0.125\text{ L/h}$)
- Normal recovery: $R_{\text{water}} = 0.42\text{ L/h}$ (84% closed-loop recovery)
- Degraded recovery: $R_{\text{water}} = 0.00\text{ L/h}$ (Distillation pump failure)

**Water Net Rates:**
- Nominal Mode: $\Delta W = 0.42 - 0.50 = -0.08\text{ L/h}$ (35 L lasts $> 400\text{ hours}$)
- Degraded Mode: $\Delta W = 0.00 - 0.50 = -0.50\text{ L/h}$ (35 L reaches critical threshold in 42 hours)

### 2.3 Breathable Oxygen Balance
Oxygen inventory is maintained by the ECLSS air revitalization electrolysis unit:

$$O_{t+1} = \max\left(0, O_t + (G_{\text{oxygen}} - C_{\text{oxygen}}) \cdot \Delta t\right)$$

Where:
- $C_{\text{oxygen}} = 0.14\text{ kg/h}$ (Crew metabolic respiration: 4 crew $\times 0.035\text{ kg/h}$)
- $G_{\text{oxygen}} = 0.16\text{ kg/h}$ if `life-support` is operational and $E_t > 0$; otherwise $0.00\text{ kg/h}$.

---

## 3. Power Allocation & Load Shedding Policy

When electrical generation is constrained ($P_{\text{solar}} = 4.0\text{ kW}$), subsystems operate under a strict priority hierarchy:

```text
Priority 1 (Critical): Life Support ECLSS (2.0 kW)
Priority 2 (Critical): Habitat Thermal Life Safety (1.2 kW)
Priority 3 (Essential): Water Recycler (1.2 kW)
Priority 4 (Optional): Agricultural Greenhouse (2.5 kW)
Priority 5 (Optional): Science Computational Lab (1.5 kW)
```

- When the commander suspends the Greenhouse, $2.5\text{ kW}$ is shed.
- When the commander suspends the Research Lab, $1.5\text{ kW}$ is shed.
- Total optional shedding saves $4.0\text{ kW}$.
- With optional loads shed, essential demand is $4.4\text{ kW}$, resulting in a minimal battery drain of just $0.4\text{ kWh/h}$, preserving battery reserves well above safety thresholds for $> 200\text{ hours}$.

---

## 4. Equipment Maintenance & Repair Mechanics

- **Fault Scheduling:** At Hour 30, a scheduled mechanical event causes the water recycler pump to seize (`status: 'degraded'`, `health: 0.35`, recovery drops to $0\text{ L/h}$).
- **Repair Preconditions:**
  1. Recycler status must be `degraded` or `offline`.
  2. Inventory must contain $\ge 1$ spare pump (`resources.sparePumps > 0`).
  3. Module must not already be in `repairing` status.
- **Repair Progression:**
  - Upon initiation: `sparePumps` decrements by 1, `status` becomes `repairing`, and `repairHoursRemaining = 4`.
  - Each simulation hour: `repairHoursRemaining` decrements by 1.
  - At $t = 0$: `status` restores to `operational`, `health` restores to $0.95$, and water recovery restores to $0.42\text{ L/h}$.

---

## 5. Timeline Rewind & Branching Model

```text
Main Timeline:
Snap(H0) ──> Snap(H10) ──> Snap(H20) ──> Snap(H25) [FAILED: Blackout]
                 │
                 └── Fork at Hour 10 (Branch B)
                         │
                         └── Snap(H10_B: Shed Greenhouse) ──> Snap(H72_B) [SUCCESS]
```

### Snapshot Structure
```ts
export interface MissionSnapshot {
  snapshotId: string;
  branchId: string;
  hour: number;
  state: MissionState;
  actionTaken?: MissionAction;
  timestamp: number;
}
```

- Snapshots are immutable deep clones (`JSON.parse(JSON.stringify(state))`).
- Rewinding creates a new `branchId` linked to its `parentBranchId` and `forkHour`.
- Forward simulation on the rewound branch uses the exact same deterministic rules, allowing meaningful A/B outcome comparison.

---

## 6. Verification & Invariant Testing Checklist

Every pull request impacting `src/simulation/**` must verify:
- [x] Initial state matches Red Storm constants.
- [x] Battery energy never drops below 0 or exceeds 150 kWh.
- [x] All-on storm branch produces power failure within 25 hours.
- [x] Load-shedding branch preserves battery above 15 kWh through 72 hours.
- [x] Ignoring water pump fault triggers water failure before Hour 72.
- [x] Repair consumes 1 spare and requires exactly 4 hours to complete.
- [x] Deterministic replay: 2 runs with identical actions produce identical telemetry.
