# 19 — Mission Catalogue, Assignments & Dashboards

**Owner:** Amina (integration) · **For:** anyone adding a mission

## How it fits together

```text
src/config/missions.ts        ← the catalogue: every mission, "available" or "coming-soon"
        │ id = MissionConfig.scenarioId
        ▼
Teacher assigns a mission     → Assignment(classroomId, missionId, dueAt?, note?)
Student finishes a mission    → MissionRun(scenarioId = engine summary's scenarioId)
Dashboards match the two      → done = a run of that mission finished after it was assigned
```

The server only **stores** the engine's own `MissionSummary`; it never computes mission results.

## Publish a new mission (3 steps)

1. **Define the mission** in `src/simulation/missions/registry.ts` (unique `id`, briefing, objectives, config; atmospheric missions also an `emergency` rule set). The engine copies the id into every `MissionState.scenarioId`, and finished runs are saved with it.
2. **Make it playable.** `/mission?mission=<id>` already starts any registered mission through `MissionIntro`; `MissionResultRecorder` is mounted for signed-in students in `src/app/mission/page.tsx`.
3. **Flip it on in `src/config/missions.ts`:** set `status: 'available'` and `href: '/mission?mission=<id>'`. The `id` must equal the registry id (a test enforces this).

That's all. Teachers can assign it immediately; it appears on student dashboards and in history.
Missions marked `coming-soon` are listed but can't be assigned or played.

## What each role sees

| Page | Who | Shows |
|---|---|---|
| `/teacher` | Teacher | Classes, join codes, quick stats, "Create a sample class" |
| `/teacher/classes/[id]` | Teacher | Assignments (assign / unassign, progress), overview, why missions ended, students table (disable / enable / remove), recent missions |
| `/dashboard` | Student | Assigned missions (to do / done, due dates), stats, all missions, full mission history |
| `/join` | Student | Join a class with its code |

## Rules

- **Disable** pauses a student's mission access and keeps their history. **Remove** takes them out of the class only.
- Sample classes are labelled "Sample data"; their results come from real engine runs (`src/server/classes/sample.ts`).
- Known limit: results are reported by the browser. Replaying the action log on the server would make them tamper-proof.
