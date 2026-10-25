# 11 — Testing Strategy & Quality Assurance

**Document Status:** Approved Quality Assurance Guide  
**Owner:** Kammoun (Test Architect) & Amina (Integration Lead)

---

## 1. Testing Philosophy

Because MissionLab is an educational simulation evaluated for **Technical Understanding & Defense (15 pts)** and **Solution Quality (30 pts)** in LUMEN 2.0, superficial frontend-only testing is unacceptable.

We adhere to a **three-tier testing strategy**:
1. **Mathematical Invariant Testing:** Pure unit tests verifying physical conservation laws, zero negative bounds, and deterministic fixed-step transitions.
2. **State & Store Integration Testing:** Verifying that Zustand dispatches update state snapshots without mutating previous timeline branches.
3. **End-to-End Playthrough Verification:** Validating the three canonical mission paths (Energy Collapse, Water Exhaustion, and 72-Hour Survival).

---

## 2. Invariant & Simulation Test Suite (`src/simulation/__tests__/`)

### Invariant Test Matrix
| Invariant ID | Test Assertion | Expected Behavior |
|---|---|---|
| **INV-01** | `batteryKwh >= 0 && batteryKwh <= 150` | Battery never becomes negative or exceeds capacity. |
| **INV-02** | `waterLiters >= 0` | Water reserves never drop below zero. |
| **INV-03** | `oxygenKg >= 0` | Oxygen mass never drops below zero. |
| **INV-04** | `health >= 0.0 && health <= 1.0` | Subsystem health remains strictly normalized. |
| **INV-05** | `advanceMission(s, 1)` is deterministic | Two fresh simulations with identical inputs yield identical floating-point values. |
| **INV-06** | Load shedding reduces battery drain | Pausing greenhouse ($-2.5\text{ kW}$) and lab ($-1.5\text{ kW}$) reduces net power drain by exactly $4.0\text{ kW}$. |
| **INV-07** | Recycler repair duration is 4 hours | Repairing decrements `repairHoursRemaining` by 1 per hour and restores operation at $t=0$. |
| **INV-08** | Repair consumes 1 spare pump | `sparePumps` decreases from 1 to 0; second repair fails with clear rejection reason. |

---

## 3. Five Critical Demo Test Cases

Before presenting to the LUMEN jury, the team must run and pass the following 5 end-to-end scenarios:

### Test Case 1: The Energy Collapse Path
- **Steps:** Start Mission 01 -> Leave all subsystems on -> Advance time to Hour 25.
- **Expected Result:** Battery drains at $4.4\text{ kWh/h}$. Critical alert at Hour 22 ($< 15\text{ kWh}$). Total blackout at Hour 25. ECLSS goes offline. Status becomes `failed`.

### Test Case 2: The Water Exhaustion Path
- **Steps:** Start Mission 01 -> Shed greenhouse and lab at Hour 0 -> Advance time to Hour 30 -> Recycler pump fault triggers -> Do NOT repair -> Advance to Hour 70.
- **Expected Result:** Battery remains safe ($> 70\text{ kWh}$). Water recovery remains $0\text{ L/h}$. Water drains by $0.50\text{ L/h}$. Water reaches $0\text{ L}$ before Hour 72. Status becomes `failed` due to dehydration.

### Test Case 3: The 72-Hour Survival Path
- **Steps:** Start Mission 01 -> Shed greenhouse and lab at Hour 0 -> Advance to Hour 30 -> Initiate water recycler repair -> Advance 4 hours -> Recycler restored at Hour 34 -> Advance to Hour 72.
- **Expected Result:** All 4 astronauts alive. Final battery $\approx 48.5\text{ kWh}$. Final water $\approx 26.8\text{ L}$. Status becomes `success`.

### Test Case 4: Deterministic Replay
- **Steps:** Execute Test Case 3 -> Rewind to Hour 0 -> Re-apply the exact same actions -> Advance to Hour 72.
- **Expected Result:** Final telemetry values match Test Case 3 to 4 decimal places.

### Test Case 5: Alternate Counterfactual Divergence
- **Steps:** Take failed branch from Test Case 1 (blackout at Hour 25) -> Rewind to Hour 0 -> Shed greenhouse and science -> Advance to Hour 25.
- **Expected Result:** Battery reads $100\text{ kWh}$ instead of $0\text{ kWh}$. Side-by-side comparison highlights a $+100\text{ kWh}$ margin difference.

---

## 4. Quality Verification Commands

```bash
# 1. Run automated Vitest test suite
pnpm test

# 2. Strict TypeScript type check
pnpm typecheck

# 3. Next.js ESLint validation
pnpm lint

# 4. Production build verification
pnpm build
```

---

## Training Tests

- `src/simulation/__tests__/training.test.ts`: fault evidence consistency, hypothesis support, procedure validation (order, tools, compatibility, orientation, spares, interruption, retry), correct/wrong replacement, verification, power forecast vs engine, greenhouse trade-off, replay from snapshot, guidance, rejection logging.
- `src/features/habitat-3d/__tests__/serviceInteractions.test.ts`: hotspot → engine request mapping and cadet hints.
- `src/features/mission-ui/__tests__/panels.test.tsx`: evidence collection, rejections, full repair through the UI buttons, planner apply, rewind with comparison.
- WebGL interaction was verified manually in a browser with Playwright (real clicks through the 3D hotspots); there is no automated WebGL test in CI.
