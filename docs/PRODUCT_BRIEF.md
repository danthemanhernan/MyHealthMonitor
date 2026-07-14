# Product Brief

## Goal

Build a personal health monitor that turns everyday data into a small set of clear signals and nudges. The app should be useful enough for daily personal use and polished enough to grow into a portfolio project.

## Recommended App Shape

Start with a responsive web app.

Why:

- Fastest path to a working dashboard.
- Easier to learn and iterate than a native iOS app.
- Works on desktop for deeper review and on mobile for daily check-ins.
- Can become a PWA before committing to native app development.
- Avoids early HealthKit complexity while the product model is still forming.

Native iOS becomes more attractive when direct HealthKit ingestion, notifications, widgets, or Apple Watch companion behavior are the main priorities.

## Initial Data Scope

Use data sources that already support the daily habit loop:

- Apple Watch / Apple Health: sleep, steps, workouts, resting heart rate, heart rate variability if available.
- Scale: weight trend and possibly body composition if already synced into Apple Health.
- MyFitnessPal: calories, protein, carbs, fat, meal timing.

Defer blood panels until the app has a useful daily and weekly feedback loop.

## First Useful Dashboard

The first dashboard should include:

- Sleep, activity, and nutrition daily scores as the primary score surface.
- Core metric cards with current value, target, and trend.
- Small set of actionable nudges.
- Source freshness and import status.

## Scoring Philosophy

Avoid pretending the app is a medical device. Use transparent, adjustable heuristics:

- Sleep: duration, consistency, low-sleep flags, and sleep debt.
- Activity: steps, workout minutes, strength sessions, cardio sessions.
- Nutrition: protein target, calorie consistency, late eating, fiber if available.
- Body composition: trend over weeks, not daily weight swings.

The app should not carry over Oura's single readiness score as the core concept. The main score should stay split into sleep, nutrition, and activity so tradeoffs remain visible.

Initial sleep rules:

- Goal: 7h 30m.
- Green: 7h 30m or more.
- Watch: 6h 30m to 7h 29m.
- Red flag: under 6h 30m.
- Sleep debt: sub-6h30m nights create debt against the 7h30m goal; later sleep above 7h30m can repay it.

The 7h30m goal is reasonable for a healthy adult because adult guidance generally falls at 7+ hours or 7-9 hours depending on the source and age band. If training volume climbs, the app should nudge toward more sleep based on recovery signals instead of blindly changing the baseline for every day.

See `SCIENCE_NOTES.md` before adding or changing scoring rules.

## Nudge Philosophy

Nudges should be specific, small, and tied to a visible pattern.

Good:

- "Shift 200 calories earlier in the day."
- "Plan two strength sessions this week."
- "Keep bedtime within a 45-minute window tonight."

Avoid:

- Generic wellness copy.
- Medical claims.
- Too many simultaneous recommendations.

## AI-Assisted Insight Path

Start with transparent local rules before using a model:

- Detect trend changes and missed targets from normalized daily records.
- Generate insight candidates with explicit evidence and next actions.
- Let an AI model rewrite or rank those candidates later, but keep the evidence trace visible.
- Avoid medical diagnosis language; frame recommendations as habit and training observations.

Good AI-assisted insight structure:

- Title.
- Plain-language summary.
- Evidence from the data.
- One next action.
- Confidence level.
