# Manual Data Export Guide

The fastest way to architect this project well is to collect small, real samples from each source before building permanent integrations. Keep raw exports out of git and place them under `data/raw/` or `data/private/`, which are ignored by this repo.

## Apple Watch / Apple Health

Use this first because your watch, scale, and some nutrition apps may already write into Apple Health.

### Full Apple Health Export

1. Open the Health app on iPhone.
2. Tap your profile picture or initials.
3. Choose the option to export health data.
4. Confirm the export and save the generated `.zip` to iCloud Drive, Files, AirDrop, or your Mac.
5. Put the zip under `data/raw/apple-health/`.
6. Unzip a copy locally when we are ready to inspect it.

Expected shape:

- `export.xml` with many health records.
- Workouts, activity, body mass, heart metrics, and sleep records may all appear there if permissioned apps write to Apple Health.

Useful first fields:

- Sleep analysis records.
- Step count.
- Resting heart rate.
- Heart rate variability if available.
- Active energy burned.
- Body mass.
- Workouts.

### Lower-Friction Shortcut Path

The full XML export can be large. A good second step is an iOS Shortcut that writes one daily CSV row for the metrics we care about:

```csv
date,sleep_minutes,steps,resting_hr,hrv_ms,active_energy_kcal,weight_lb,workout_minutes
2026-07-12,432,9840,58,42,620,184.6,45
```

This will be easier to use during early app development than parsing the complete Apple export every time.

## Bluetooth Scale

Start by checking whether the scale already syncs to Apple Health:

1. Open Health.
2. Browse to Body Measurements.
3. Check Weight and any body composition fields your scale supports.
4. Open the data source details and confirm the scale app is listed.

If the scale writes to Apple Health, treat Apple Health as the source of truth for weight. If not, export from the scale app if it supports CSV. If no export exists, manually enter weekly weight samples at first.

Useful first fields:

- Date.
- Weight.
- Body fat percentage if available.
- Lean mass or muscle mass if available.
- Source device or app.

## MyFitnessPal

Start with nutrition summaries rather than individual food logs. The first useful version needs daily totals, not every ingredient.

Try these paths:

1. Check the MyFitnessPal web app for reports or export options.
2. If available, export nutrition data as CSV.
3. If CSV export is not available on your plan, manually capture 14 days of daily totals.
4. Store the file under `data/raw/myfitnesspal/`.

Useful first fields:

- Date.
- Calories.
- Protein grams.
- Carbohydrate grams.
- Fat grams.
- Fiber grams if available.
- Meal timing or late-calorie estimate if available.

Simple starter format:

```csv
date,calories,protein_g,carbs_g,fat_g,fiber_g,late_calories
2026-07-12,2180,132,210,72,28,410
```

## First Sample Collection Goal

Collect 14 to 30 days of:

- Sleep duration.
- Sleep start and end time.
- Steps.
- Resting heart rate.
- Weight.
- Calories.
- Protein.
- Workout minutes.

That is enough to build the first real trend engine and start making useful recommendations without pulling in blood panels or complicated medical data.

## Architecture Implication

The app should ingest raw files into normalized daily records:

- Keep raw files unchanged.
- Parse into stable normalized tables.
- Build scores and nudges from normalized records.
- Keep AI recommendations grounded in specific evidence rows.

This prevents the app from becoming tied to one vendor's export format.
