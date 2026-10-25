# 04 — Implemented Simulation Engine

Owner: Kammoun. Public exports: `src/simulation/index.ts`. Pure TypeScript; no React, browser, Zustand, rendering, network or external AI dependency.

## Time and configuration

`createInitialMission(config?)` deep-copies a validated, serializable config into state and creates a running mission. The default is `RED_STORM_CONFIG`. All rates are total habitat rates for the configured crew, rather than multiplied again by crew count. The seven electrical ratings are centralized in `INITIAL_MODULES`. Legacy states without embedded configuration use Red Storm rules.

`advanceMission(state, hours)` returns a new state. `advanceMissionSteps` returns every intermediate state. Advances require positive safe integer hours; configuration rates, reserves and inventories require finite nonnegative numbers. Mission duration, crew count and repair duration require positive integers; spare pumps require an integer. Battery initialization cannot exceed capacity. Invalid actions return the original state and an actionable reason. Direct invalid advances/configuration throw `RangeError`.

An hour integrates the half-open interval `[h,h+1)`. Scheduled conditions at h are present before integration. Repair work progresses during that interval and completes at h+1; production resumes in the following interval. Scheduled boundary events at h+1 are applied before returning the state, so the hour-30 snapshot already exposes the fault and accepts repair. This explicit convention avoids losing an hour of recovery before the fault or shortening a repair.

The storm executes during initialization at hour 0. It persists through the mission. A pump fault executes at hour 30. Unique scheduled event records prevent duplicate execution; rewind before a scheduled boundary naturally replays it. No storm-clear event is modeled.

## Electrical allocation

One timestep is one hour. Available average power in kW is solar generation plus battery energy in kWh divided by one hour. There is no separate battery discharge-rate constraint or conversion loss in this educational model.

Allocate greedily, permitting partial supply, in this order:

1. Life support: 2.0 kW.
2. Habitat heating: 1.2 kW.
3. Recycler: 1.2 kW.
4. Greenhouse: 2.5 kW.
5. Research: 1.5 kW.

A disabled module requests zero power. `powerDemandKw` is its enabled nameplate rating; `suppliedPowerKw` is its actual allocated load. Optional modules remain enabled during shortages, with warning/offline status depending on supply. They recover automatically when supply permits. Production and science require full supply and an operational module. Mechanical degradation/repair status takes precedence over electrical status. A failed/repairing recycler continues drawing its rated 1.2 kW for energized control/heating circuitry, with zero water recovery.

`state.power` separates requested, available, supplied and unserved power, plus solar generation. Surplus solar charges the battery up to capacity; extra generation is curtailed. Battery accounting is:

```
batteryNext = clamp(batteryCurrent + solarGenerationKw - suppliedPowerKw, 0, capacity)
```

Record the first demand/generation deficit, the battery warning and every actual shortage. Demand above solar alone does not cause automatic shedding. Battery depletion alone is not failure: essential supply can still come from solar. Any actual shortfall to life support, heating or the recycler ends the mission at the timestep boundary. Optional-only shortfall does not end the mission.

## Coupled water and oxygen

Normal water recovery is 0.42 L/h, only from a fully supplied operational recycler. Crew water use is 0.50 L/h. Recovery is zero while damaged or repairing. First reserve water for crew consumption, then use remaining process water for oxygen generation.

Fully supplied, operational life support produces up to 0.16 kg/h oxygen. Electrolysis consumes **1.125 L/kg oxygen**, an explicit simplified stoichiometric input, or 0.18 L/h at full output. Production is limited by available process water; deduct this water exactly once. Crew consumes 0.14 kg/h oxygen. No oxygen credit is granted to greenhouse lighting.

`state.flows` reports actual last-interval recovery, oxygen output, process-water use and net resource changes, so the HUD does not repeat physical calculations.

Thus normal water loss is **0.26 L/h**, and fault/repair water loss is **0.68 L/h**, while oxygen normally increases by 0.02 kg/h. Water and oxygen are clamped at zero. These are simplified educational parameters, not flight engineering values. Wastewater availability, gas tank capacity, temperature dynamics, food metabolism, agricultural output, work energy and component aging are not modeled. Food inventory stays unchanged. Science gains one point for each fully powered operational research hour.

## Repair and outcomes

Repair requires genuine damage (`degraded`/`offline`, health below 0.5) and one spare. It consumes that spare immediately; a second start is rejected. Four complete intervals are required. A repair begun at hour 30 completes at 34, after four intervals without recovery. Completion is recorded once.

| Limit | Consequence |
|---|---|
| Battery at or below 15 kWh | Warning only |
| Any essential electrical demand unserved | Immediate terminal power failure |
| Water at or below 14 L | Immediate terminal safety failure |
| Oxygen at or below 1.5 kg | Immediate terminal safety failure |
| Duration reached with no unsafe condition | Success |

Numerical comparisons use a 1e-9 tolerance to avoid missing a threshold at floating-point equality. Failure takes precedence over success at expiry. Failures include kind, hour, resource values and event cause references, with a compatible display string. Safety termination does not assert that astronauts died.

## History, branching and evidence

`createSnapshot` deep-copies state and action. IDs combine branch, hour and event count. Every successful same-hour physical action appends an event, so decision IDs cannot collide. `timestamp` is a logical event sequence, not epoch time. Hourly advances have distinct hours. No authoritative identifier uses random or wall-clock data.

`recordMissionAction` orchestrates hourly recording without duplicating calculations. `forkMission(history, snapshotId, branchId?)` rejects missing targets, deep-copies the exact common prefix and appends a boundary state with the new branch ID. The optional ID lets a session choose deterministic unique sibling IDs. With no ID supplied, the same source/target yields the same reproducible branch ID. Store IDs use the archived-branch count. Callers managing siblings directly must supply unique IDs.

The store's `history` is the active path; `branches` archives original paths on rewind. `REWIND_TO` optionally accepts `snapshotId` to distinguish same-hour decisions. Hour-only rewind selects the earliest snapshot at that hour. Rewind is handled at session level, including from terminal states. The pure engine rejects rewind without history instead of pretending to restore state. Reset restores configuration and clears the session's branches.

`getMissionSummary` uses actual hourly snapshots, action records and engine events. It exposes resource minima, margins against configured limits, significant events, structured root cause, decisions and deterministic scientific explanation templates. Failure `causeIds` link to recorded storm, deficit, reserve, shortage or mechanical-fault evidence. `compareBranches` reports full summaries, resource/science deltas and ordered decision differences. It describes association between alternatives and outcomes; it does not claim arbitrary decisions were isolated experimentally.

## Verified scenario calculations

The canonical repair policy disables both optional modules at hour 0 and repairs at hour 30.

| Policy | Terminal hour | Result | Battery kWh | Water L | Oxygen kg |
|---|---:|---|---:|---:|---:|
| Optional loads enabled | 26 | Essential power shortage | 0 | 27.82 | 5.52 |
| Optional loads disabled; no repair | 50 | Unsafe water reserve | 90 | 13.60 | 6.00 |
| Optional loads disabled; repair | 72 | Success | 81.20 | 14.60 | 6.44 |

All-on demand is 8.4 kW; 110 / 4.4 = 25 hours of battery buffering. At hour 25 the battery is empty but all loads were supplied for that interval. During interval 25–26, 4 kW solar supplies life support and heating, but only 0.8 kW of recycler demand. This is a real essential shortage, not a total solar blackout.

Conservation drains 0.4 kWh/h: `110 - 72 × 0.4 = 81.2`. Thirty nominal intervals precede the fault. Without repair, water is `35 - 30 × 0.26 - 20 × 0.68 = 13.6` at hour 50. With four repair intervals, water is `35 - 68 × 0.26 - 4 × 0.68 = 14.6` at hour 72.

Earlier documents/fixtures claimed blackout at hour 25, zero water before hour 72, 48.5 kWh final battery and 26.8 L final water. Those values do not follow from the equations and are superseded here; physical calculations were not tuned to match those assertions.
