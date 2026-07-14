# NutritionOps Development Roadmap

## Vision

Evolve MyHealthMonitor into a local-first personal nutrition and health analytics platform that consolidates nutrition, body weight, workouts, sleep, and biometric data into a user-owned system.

The platform should:

- Preserve raw source data so it can be reprocessed later.
- Normalize data from nutrition apps, Apple Health, scales, and manual inputs.
- Surface reliable nutrition, body-composition, training, and recovery trends.
- Estimate energy expenditure from logged intake and weight trends.
- Analyze meal timing around boxing and other workouts.
- Produce transparent, evidence-informed nudges and natural-language insights.
- Keep sensitive health data local unless remote sync is explicitly enabled.

## Core Questions

The finished system should help answer:

- Am I consistently hitting protein, fiber, calorie, and micronutrient targets?
- Which foods contribute most to protein, sodium, saturated fat, or fiber?
- How does carbohydrate intake affect evening boxing performance?
- Does a larger lunch or dinner work better for training, hunger, and sleep?
- What is my estimated maintenance calorie level?
- How complete and trustworthy is my nutrition data?
- How do travel, sleep, and training volume affect weight and recovery?
- What is one practical action I should take next?

## Product Principles

1. **Local first** — health data remains on the user's machine by default.
2. **Raw data is immutable** — every import is retained unchanged before transformation.
3. **Provenance is mandatory** — derived metrics must trace back to their source.
4. **Observations and interpretations are separate** — measured data is stored independently from scores, estimates, and recommendations.
5. **Integrations are replaceable** — providers map into a canonical internal schema.
6. **Confidence is visible** — estimated restaurant meals and incomplete logging must not look as precise as weighed foods.
7. **Deterministic analytics before AI** — rules and calculations should be reliable before adding an LLM assistant.

## Target Architecture

```text
Nutrition Sources
Cronometer / MacroFactor / MyFitnessPal / Manual Entry
                         |
                         v
Apple Health / Apple Watch / Bluetooth Scale
                         |
                         v
               Ingestion Adapters
       Python parsers / uploads / iOS Shortcut
                         |
                         v
                  Raw Data Store
             JSON / CSV / XML / Parquet
                         |
                         v
          Validation and Transformation
              Python / Polars / SQL
                         |
                         v
             Canonical Analytics Store
          SQLite first, ClickHouse when needed
                         |
             +-----------+-----------+
             |                       |
             v                       v
       FastAPI service          React dashboard
             |
             v
  Recommendation engine / LLM tools
```

The current React and local JSON snapshot should remain useful throughout the migration. The backend can be introduced incrementally rather than replacing the existing dashboard all at once.

---

# Phase 0 — Repository and Data Safety Foundation

## Goal

Make the project safe to extend with real personal health data.

## Tasks

- [ ] Confirm all real exports are excluded by `.gitignore`.
- [ ] Separate anonymized fixtures from personal files.
- [ ] Add `.env.example` for local configuration.
- [ ] Document the local-first privacy model.
- [ ] Add a data-retention and deletion policy.
- [ ] Add structured import logs without exposing sensitive values.
- [ ] Add schema-version metadata to generated snapshots.
- [ ] Add tests for the existing Apple Health and MyFitnessPal parsers.
- [ ] Add CI checks for the React application and Python scripts.

## Definition of Done

- Real health exports cannot be accidentally committed.
- The application can be built and tested from a clean clone.
- Sample data is clearly labeled as synthetic or anonymized.

---

# Phase 1 — Nutrition Import MVP

## Goal

Replace one-off nutrition extraction with a repeatable import pipeline.

## Initial Sources

1. Cronometer CSV export.
2. MyFitnessPal CSV export when available.
3. Existing MyFitnessPal PDF parser as a legacy fallback.
4. Manual daily macro entry for missing days.

## Tasks

- [ ] Define a common nutrition import interface.
- [ ] Preserve each original file with a file hash and import timestamp.
- [ ] Build a Cronometer CSV adapter.
- [ ] Add a MyFitnessPal CSV adapter.
- [ ] Keep the PDF parser isolated as a legacy adapter.
- [ ] Validate required columns and units.
- [ ] Normalize calories, grams, milligrams, and micrograms.
- [ ] Detect duplicate imports using file and record hashes.
- [ ] Quarantine malformed rows instead of silently dropping them.
- [ ] Record source application and source record ID.
- [ ] Generate daily macro and micronutrient summaries.
- [ ] Expose import status in the dashboard.

## Acceptance Criteria

- Re-importing the same file creates no duplicate records.
- Daily totals match the source application within a documented tolerance.
- Invalid rows generate actionable errors.
- Source records and normalized records can be traced to one another.

---

# Phase 2 — Canonical Health Data Model

## Goal

Create a source-independent model for nutrition and health observations.

## Core Entities

### Import Batch

- `batch_id`
- `source_name`
- `source_filename`
- `file_hash`
- `imported_at`
- `record_count`
- `error_count`
- `schema_version`

### Food

- `food_id`
- `source_food_id`
- `name`
- `brand`
- `barcode`
- `serving_description`
- `source_database`
- `verification_status`

### Food Log Entry

- `entry_id`
- `consumed_at`
- `meal_type`
- `food_id`
- `quantity`
- `quantity_unit`
- `grams`
- `calories_kcal`
- `protein_g`
- `carbohydrates_g`
- `fat_g`
- `fiber_g`
- `sodium_mg`
- `source_name`
- `is_estimated`
- `confidence_score`

### Daily Nutrition Summary

- `date`
- `calories_kcal`
- `protein_g`
- `carbohydrates_g`
- `fat_g`
- `fiber_g`
- `sodium_mg`
- `potassium_mg`
- `magnesium_mg`
- `calcium_mg`
- `iron_mg`
- `vitamin_d_mcg`
- `omega_3_g`
- `logging_completeness`

### Body Measurement

- `measured_at`
- `weight_kg`
- `body_fat_percent`
- `waist_cm`
- `source_name`

### Workout

- `started_at`
- `ended_at`
- `workout_type`
- `duration_minutes`
- `active_energy_kcal`
- `average_heart_rate`
- `maximum_heart_rate`
- `distance_km`
- `source_name`

### Sleep Session

- `started_at`
- `ended_at`
- `duration_minutes`
- `deep_sleep_minutes`
- `rem_sleep_minutes`
- `awake_minutes`
- `source_name`

## Data Quality Fields

Use these where relevant:

- `is_estimated`
- `confidence_score`
- `is_user_verified`
- `source_record_id`
- `transformation_version`
- `created_at`
- `updated_at`

---

# Phase 3 — Weight Trend and Energy Expenditure

## Goal

Implement the most valuable MacroFactor-style capability: estimating actual energy expenditure from logged intake and body-weight trends.

## Tasks

- [ ] Import body weight from Apple Health and manual entries.
- [ ] Display raw scale weight separately from trend weight.
- [ ] Implement a seven-day rolling average.
- [ ] Implement an exponentially weighted trend.
- [ ] Detect likely single-day water-weight anomalies.
- [ ] Calculate average calorie intake over configurable windows.
- [ ] Estimate energy balance from trend-weight change.
- [ ] Estimate total daily energy expenditure as a range.
- [ ] Score estimate confidence using logging completeness and weigh-in frequency.
- [ ] Exclude or flag periods with travel, illness, or incomplete data.
- [ ] Add unit tests using known synthetic examples.

## Important Constraints

The estimate must not overreact to:

- Sodium-heavy restaurant meals.
- High-carbohydrate days and glycogen changes.
- Missed weigh-ins.
- Incomplete food logging.
- Different scale devices.
- Travel and illness.

## Dashboard Outputs

- Raw weight.
- Smoothed weight trend.
- Weekly rate of change.
- Average calorie intake.
- Estimated expenditure range.
- Confidence score.
- Current calorie target versus estimated maintenance.

---

# Phase 4 — Apple Health Synchronization

## Goal

Move beyond one-time XML exports toward incremental ingestion.

## Step 1: Improve XML Import

- [ ] Make Apple Health XML imports idempotent.
- [ ] Persist source identifiers.
- [ ] Record synchronization checkpoints.
- [ ] Add import summaries and warnings.
- [ ] Add tests for sleep-window grouping and duplicate source handling.

## Step 2: iOS Shortcut Bridge

- [ ] Build an iOS Shortcut that reads recent Health samples.
- [ ] Serialize records to JSON.
- [ ] POST data to a local FastAPI endpoint.
- [ ] Authenticate requests with a local API token.
- [ ] Sync weight, workouts, sleep, resting heart rate, HRV, steps, and active energy.

## Step 3: Native HealthKit Client — Stretch Goal

- [ ] Create a SwiftUI companion application.
- [ ] Request HealthKit permissions.
- [ ] Use incremental HealthKit queries.
- [ ] Support background delivery where permitted.
- [ ] Keep the server optional so the app remains local-first.

---

# Phase 5 — Backend Analytics API

## Goal

Introduce a stable API without blocking current frontend development.

## Suggested Endpoints

```text
POST /v1/imports/cronometer
POST /v1/imports/myfitnesspal
POST /v1/imports/apple-health
POST /v1/imports/weight
GET  /v1/imports
GET  /v1/nutrition/daily
GET  /v1/nutrition/foods
GET  /v1/nutrition/macros
GET  /v1/nutrition/micronutrients
GET  /v1/nutrition/meal-timing
GET  /v1/body-weight
GET  /v1/body-weight/trend
GET  /v1/energy/expenditure
GET  /v1/workouts
GET  /v1/sleep
GET  /v1/insights
```

## Requirements

- [ ] FastAPI with versioned routes.
- [ ] Pydantic request and response models.
- [ ] OpenAPI documentation.
- [ ] Date-range filtering.
- [ ] Pagination where appropriate.
- [ ] Structured error responses.
- [ ] Health and readiness endpoints.
- [ ] Integration tests.
- [ ] Local authentication before remote access is enabled.

---

# Phase 6 — Nutrition and Body-Composition Dashboards

## Nutrition Overview

- [ ] Daily calories and macros.
- [ ] Protein and fiber target adherence.
- [ ] Seven- and thirty-day averages.
- [ ] Micronutrient coverage.
- [ ] Incomplete logging indicators.
- [ ] Estimated versus verified foods.

## Body Composition

- [ ] Raw and trend weight.
- [ ] Weekly rate of change.
- [ ] Intake versus estimated expenditure.
- [ ] Goal progress.
- [ ] Weight anomaly markers.

## Food Explorer

- [ ] Frequently logged foods.
- [ ] Major nutrient contributors.
- [ ] Trusted personal food catalog.
- [ ] Duplicate food comparison.
- [ ] Suspicious-entry warnings.

---

# Phase 7 — Meal Timing and Workout Fueling

## Goal

Evaluate how nutrition timing affects evening boxing sessions, hunger, recovery, and sleep.

## Derived Metrics

- `pre_workout_carbs_g`
- `pre_workout_protein_g`
- `minutes_from_meal_to_workout`
- `post_workout_protein_g`
- `post_workout_carbs_g`
- `minutes_from_workout_to_meal`
- `percent_calories_after_8pm`
- `largest_meal_of_day`
- `protein_distribution_score`

## Tasks

- [ ] Classify entries as breakfast, lunch, dinner, or snack.
- [ ] Match meals to the nearest workout.
- [ ] Compare larger-lunch and larger-dinner days.
- [ ] Compare pre-workout carbohydrate intake with workout duration and heart-rate response.
- [ ] Compare late meals with sleep duration and resting heart rate.
- [ ] Segment boxing, running, and strength workouts separately.
- [ ] Show sample size and date range for every finding.
- [ ] Label correlations as observational rather than causal.

## Initial Hypothesis to Test

For workouts beginning around 5:30–6:00 PM, a substantial lunch plus a small, low-fat pre-workout carbohydrate snack may produce better training quality than a small lunch followed by a very large dinner.

The platform should test this hypothesis against actual data rather than encode it as a permanent assumption.

---

# Phase 8 — Smart Food Scale Workflow

## Goal

Reduce logging friction while preserving accurate food weights.

## Design Principle

Treat the scale as a measurement device, not the authoritative food database.

```text
Food selected from trusted catalog
              |
              v
     Weight measured in grams
              |
              v
Nutrition calculated from canonical food record
```

## Tasks

- [ ] Add fast manual gram entry.
- [ ] Add a quick-weight API endpoint.
- [ ] Associate a weight event with a selected food.
- [ ] Support tare and ingredient accumulation.
- [ ] Record raw and cooked recipe weights.
- [ ] Calculate recipe nutrition per gram.
- [ ] Support meal-prep container portions.
- [ ] Explore Bluetooth Low Energy scale integration.
- [ ] Explore a Raspberry Pi scale bridge.
- [ ] Add a travel mode with estimated portions and confidence ranges.

---

# Phase 9 — Deterministic Recommendation Engine

## Goal

Generate useful recommendations without relying on an LLM.

## Inputs

- Remaining calories and macros.
- Micronutrient gaps.
- Time of day.
- Upcoming workout.
- Recent meals.
- Foods available at home.
- Dietary preferences.
- Preparation time.

## Example Rules

- If protein remaining is high and fat remaining is low, prioritize lean protein.
- If boxing starts within 90 minutes, prioritize digestible carbohydrates with low fat and moderate fiber.
- If fiber is low late in the day, suggest foods that close the gap without requiring a very large pre-bed meal.
- If sodium is elevated after restaurant meals, provide context rather than an alarmist warning.
- If data completeness is poor, avoid precise recommendations.

## Requirements

- [ ] Every recommendation includes its rationale.
- [ ] Every recommendation includes a confidence level.
- [ ] The engine never changes goals without explicit confirmation.
- [ ] Rules are testable and versioned.

---

# Phase 10 — Natural-Language Health Assistant

## Goal

Allow questions over personal data through a controlled analytics layer.

## Example Questions

- Why was my protein intake low last week?
- Which lunches best supported evening boxing sessions?
- How often do I miss my fiber target?
- Did late dinners correlate with worse sleep?
- What can I eat tonight to hit protein without exceeding fat?
- How did travel weeks differ from normal weeks?

## Safe Architecture

```text
User question
      |
      v
Intent classification
      |
      v
Approved analytics tools
      |
      v
Parameterized queries
      |
      v
Validated results
      |
      v
LLM explanation
```

## Guardrails

- [ ] No unrestricted SQL generation.
- [ ] No database writes from the assistant.
- [ ] Include date ranges and source provenance.
- [ ] Separate observations from recommendations.
- [ ] State uncertainty and data-quality limitations.
- [ ] Avoid medical diagnosis.
- [ ] Keep external model data sharing configurable and off by default.

---

# Phase 11 — Data Quality and Food Verification

## Goal

Detect inaccurate nutrition entries before they contaminate long-term analytics.

## Tasks

- [ ] Prefer USDA or verified vendor records.
- [ ] Track source database and verification state.
- [ ] Compare duplicate entries for the same food.
- [ ] Detect impossible or highly unlikely macro combinations.
- [ ] Compare listed calories with macro-derived calories.
- [ ] Account for fiber, sugar alcohols, alcohol, and label rounding.
- [ ] Store barcode associations.
- [ ] Allow user verification.
- [ ] Maintain a trusted personal food catalog.
- [ ] Flag estimated restaurant meals separately.

---

# Phase 12 — Recipes and Meal Prep

## Goal

Make home-cooked food accurate and easy to reuse.

## Tasks

- [ ] Create recipes from weighed ingredients.
- [ ] Record raw ingredient weights.
- [ ] Record final cooked weight.
- [ ] Calculate nutrition per gram and per serving.
- [ ] Track batch yield.
- [ ] Version recipes when ingredients change.
- [ ] Clone common meals.
- [ ] Generate meal-prep portion summaries.

---

# Phase 13 — Daily and Weekly Briefs

## Daily Brief

- [ ] Current calories and macro progress.
- [ ] Protein and fiber remaining.
- [ ] Upcoming workout context.
- [ ] One actionable nutrition suggestion.
- [ ] Data-completeness warning when needed.

## Weekly Review

- [ ] Average calories and macros.
- [ ] Protein and fiber adherence.
- [ ] Estimated expenditure range.
- [ ] Weight trend and rate of change.
- [ ] Training volume.
- [ ] Sleep and recovery trends.
- [ ] Meal-timing observations.
- [ ] One experiment for the coming week.

---

# Phase 14 — Deployment and Operations

## Local Development

- [ ] Docker Compose for API and analytics store.
- [ ] One-command startup.
- [ ] Automatic schema migrations.
- [ ] Local backup command.

## Home Server

- [ ] Deploy to a mini PC, NAS, or Raspberry Pi where practical.
- [ ] Add HTTPS for remote access.
- [ ] Add encrypted backups.
- [ ] Add data-freshness monitoring.
- [ ] Add storage and import-failure alerts.

## Kubernetes — Stretch Goal

- [ ] Package services with Helm.
- [ ] Add persistent storage.
- [ ] Add secrets management.
- [ ] Add health probes and resource limits.
- [ ] Add scheduled ingestion jobs.
- [ ] Add Prometheus-compatible metrics.

---

# Suggested Milestones

## Milestone 1 — Reliable Nutrition Imports

Deliver:

- Cronometer CSV importer.
- MyFitnessPal CSV importer.
- Raw-file preservation.
- Idempotent imports.
- Nutrition dashboard updates.

## Milestone 2 — Weight and Expenditure

Deliver:

- Weight ingestion.
- Trend-weight model.
- Expenditure estimate.
- Confidence scoring.
- Body-composition dashboard.

## Milestone 3 — Incremental Apple Health

Deliver:

- Improved XML ingestion.
- iOS Shortcut sync.
- Workouts, sleep, heart rate, and weight updates.

## Milestone 4 — Meal Timing

Deliver:

- Meal classification.
- Pre- and post-workout nutrition analysis.
- Lunch-versus-dinner analysis.
- Meal timing and sleep comparisons.

## Milestone 5 — Smart Logging

Deliver:

- Recipe and meal-prep workflow.
- Scale-assisted gram entry.
- Trusted food catalog.
- Data-quality warnings.

## Milestone 6 — Personal Health Assistant

Deliver:

- Deterministic recommendations.
- Controlled natural-language analytics.
- Daily and weekly briefs.
- Provenance and uncertainty reporting.

---

# Recommended Next Sprint

## Sprint Goal

Replace the existing one-time nutrition extraction path with a repeatable, tested nutrition import pipeline while preserving compatibility with the current React dashboard.

## Backlog

- [ ] Add a `NutritionSourceAdapter` interface.
- [ ] Move the current MyFitnessPal PDF logic behind a legacy adapter.
- [ ] Add a Cronometer CSV fixture.
- [ ] Implement the Cronometer CSV parser.
- [ ] Define normalized nutrition models.
- [ ] Add file hashing and import metadata.
- [ ] Add duplicate detection.
- [ ] Add malformed-row reporting.
- [ ] Update `build_health_data.py` to consume normalized nutrition records.
- [ ] Add nutrition import tests.
- [ ] Display source, freshness, and completeness in the dashboard.
- [ ] Document how to export and import Cronometer data.

## Definition of Done

1. A Cronometer CSV can be imported with one command.
2. The same file can be imported twice without duplication.
3. Existing dashboard views continue to work.
4. Daily calories, protein, carbohydrates, fat, and fiber match the source export.
5. Import failures are visible and actionable.
6. No personal health data is committed to GitHub.

---

# Technology Direction

| Concern | Near-Term Choice | Later Option |
|---|---|---|
| Frontend | React + TypeScript | PWA or SwiftUI companion |
| Parsing | Python | Python services |
| Validation | Pydantic | Versioned data contracts |
| Transformation | Python / Polars | dbt or SQL models |
| Local storage | JSON or SQLite | ClickHouse for larger analytics workloads |
| API | None initially | FastAPI |
| Visualization | Existing React charts | Grafana for engineering diagnostics |
| CI | GitHub Actions | Expanded integration and container checks |
| Deployment | Local process | Docker Compose, then home server |
| AI | Static or deterministic insights | Tool-based LLM assistant |

## Storage Decision

Do not introduce ClickHouse solely because it is interesting. Start with SQLite if the primary workload is local, single-user, and modest in scale. Move analytical event data to ClickHouse when query volume, long-term time-series retention, or dashboard complexity provides a clear benefit.

---

# Non-Goals for the Initial Release

The first release will not:

- Diagnose medical conditions.
- Replace a physician or registered dietitian.
- Automatically change calorie targets.
- Depend on camera-only calorie estimation.
- Assume restaurant meals are precise.
- Require Kubernetes.
- Require a native iOS application.
- Support multiple users.
- Use an LLM before deterministic analytics are trustworthy.

# Success Criteria

The project is successful when:

- Nutrition and health data can be retained independently of any vendor.
- New sources can be added through adapters rather than rewrites.
- Every derived insight can be traced to source records.
- Data quality and completeness are visible.
- The dashboard provides useful daily and weekly guidance.
- Meal timing and energy-expenditure analyses are based on personal trends rather than generic assumptions.
- The repository demonstrates practical data engineering, analytics, API design, privacy, observability, and applied AI.