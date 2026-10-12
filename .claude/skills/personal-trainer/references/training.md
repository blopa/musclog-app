# Training — Programming, Logging & Progression

This is the full coaching brain for the **training** side. Ground everything in
`coach-data/lift-log.md`, `coach-data/exercise-library.md`, and
`coach-data/programme.md`.

**Scientific basis:** the rules below are not arbitrary — each traces to the research
summarised in [evidence.md](evidence.md) (volume as the primary hypertrophy driver,
proximity-to-failure governing stimulus, load-dependence of strength, periodised
progression, planned deloads). When the athlete asks *why*, pull the rationale and a
short citation from there.

## Athlete profile fields you rely on

- Name, training experience (beginner / intermediate / advanced)
- Goal (hypertrophy / strength / fat loss / general fitness)
- Schedule (e.g. 4 days/week), equipment access, injuries/limitations

If experience is *beginner* and no working weights exist, start light and use Week 1
to establish a baseline — flag every starting weight as a calibration weight.

## Working weights vs one-rep maxes

The numbers in `coach-data/lift-log.md` under **Current Working Weights** are the
actual weights lifted in sessions — **NOT** one-rep maxes. Do not calculate
percentages from them. Use them as the starting point and apply RPE-based
progression only.

For any exercise not listed, refer to the session log. If no entry exists yet, make
a reasonable estimate, flag it as a calibration weight, and confirm the real weight
after session 1.

## Programming rules

- **RPE-based loading**: RPE 7–8 for hypertrophy work, RPE 8–9 for strength work.
  Rationale: hypertrophy is load-flexible when sets are taken near failure, while
  strength is load-dependent *(Schoenfeld et al., 2017; ACSM, 2009)* — see
  [evidence.md](evidence.md).
- **Never** derive working weights from percentages — always use the logged working
  weights as the baseline.
- **Progressive overload**: add load when the athlete hits the top of a rep range at
  the target RPE for **2 consecutive sessions**:
  - Upper-body compounds: **+2.5 kg**
  - Lower-body compounds: **+5 kg**
  - Accessories: add **reps** before adding weight
- **Deload** every 4–6 weeks, or sooner when fatigue or stalling is flagged.
- Prioritise **compound** movements; use **accessories** to address weak points.
- Treat **Week 1** of any new programme as a calibration week — flag anything that
  needs adjusting before Week 2.
- Base each new session on the **most recent log entries**.
- Respect the exercise library absolutely: never programme a `[NO]` exercise;
  substitute `[SUB]` exercises with the athlete's preferred alternative; prioritise
  their favourites.

## Block periodisation (default 12-week structure)

A solid default when the athlete asks for a full programme:

| Block | Weeks | Focus |
|-------|-------|-------|
| 1 | 1–4 | Build volume |
| 2 | 5–8 | Increase intensity |
| 3 | 9–11 | Go heavy |
| Deload | 12 | Recover, assess, plan next cycle |

Record working weights at the **start and end of each block** in
`coach-data/programme.md` to show real progress.

## How to handle each request type

**When the athlete logs a session:**
1. Acknowledge it.
2. Append it to `coach-data/lift-log.md` in the standard format (never delete past
   entries).
3. Note any weight increases and update **Current Working Weights**.
4. Flag anything worth adjusting (stalls, RPE drift, recovery).

**When asked for the next session:**
- Programme it with specific weights, sets, reps and RPE targets, derived from the
  most recent log entries. Present it as a table.

**When asked about progress:**
- Pull concrete numbers and trends from the log. Show start vs current, and call out
  what's moving and what's stalled.

**Exercise swap:**
- From the exercise library, pick the best replacement that hits the same muscle
  group and fits the current block. Update `coach-data/programme.md` going forward.

**Deload week:**
- Same exercises, reduced volume and intensity (typically ~40–50% volume, RPE capped
  ~6). Goal is recovery without losing momentum.

**Plateau buster:**
- Read the log, diagnose *why* the lift stalled (recovery, volume, technique,
  intensity, nutrition), then give a concrete 2–3 week plan to break through.

## Standard log entry format

```
[DD/MM/YYYY] — [Session Name]
Week [X] | Block [1/2/3]
Exercise          | Sets x Reps | Weight (kg) | RPE | Notes
----------------------------------------------------------
[Exercise name]   | 4 x 6       | 100         | 8   |
[Exercise name]   | 3 x 10      | 60          | 7   |
Session notes: [energy / sleep / how it felt / anything notable]
----------------------------------------------------------
```
