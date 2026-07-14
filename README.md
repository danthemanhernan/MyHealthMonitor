# My Health Monitor

A local-first personal health dashboard inspired by Oura-style readiness, but built around the data you already have: Apple Watch, Apple Health, a Bluetooth scale, and MyFitnessPal.

## Product Direction

Start as a web app. A browser-based dashboard is the most practical first version because it is faster to build, easier to share as a portfolio project, and can still become a mobile-friendly PWA. Native iOS can come later if HealthKit integration becomes the main bottleneck.

The first useful version should answer three questions:

1. How am I doing today?
2. Which trend is helping or hurting my goals?
3. What is one practical nudge I should act on next?

## Current Scaffold

- Vite + React + TypeScript app shell
- Imported local snapshot data in `src/data/health-data.json`, generated from the files under `data/raw/`
- Dashboard UI with readiness signals, a sleep trend chart, AI-assisted insights, core metrics, nudges, and source import status
- Planning docs for product scope and data ingestion
- Science notes for evidence-informed health features

## Run Locally

Install dependencies, then start the dev server:

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Build the local data snapshot

The current fixture was generated once from the expanded Apple Health XML/GPX export and the MyFitnessPal PDF:

```bash
UV_CACHE_DIR=/tmp/myhealth-uv-cache uv run --with pypdf python3 scripts/build_health_data.py
```

The importer streams the large Apple Health XML, normalizes daily metrics and workouts, indexes GPX routes as privacy-conscious summaries, and extracts MyFitnessPal daily totals from the PDF. Use a CSV-based importer for future MyFitnessPal exports; the PDF path is intentionally a one-time fallback.

The generated fixture keeps a rolling three-month window based on the latest imported date.

Sleep records are grouped into overnight windows beginning at 8:00 PM and ending at 11:00 AM the next day. The current dashboard goals are 150 lb, 2,000 calories, 25g fiber, 195g carbs, 54g fat, and 170g protein.

Daily steps now prefer the Apple Watch source to avoid adding overlapping iPhone and Watch samples together; the selected source is retained as `stepSource` in each daily record.

## Near-Term Roadmap

1. Replace seed data with a simple local JSON import.
2. Add Apple Health export parsing for sleep, resting heart rate, steps, workouts, and weight.
3. Add a weekly MyFitnessPal macro import path.
4. Build goal settings for weight trend, protein, steps, sleep, and workouts.
5. Generate nudges from trend rules instead of static copy.

See `docs/MANUAL_DATA_EXPORT.md` for the first real-data collection steps.
See `docs/SCIENCE_NOTES.md` for the evidence standard behind health rules like sleep debt.

## Privacy Posture

Keep the first version local-first. Health data should stay on your machine unless you intentionally add sync or hosted storage later.
