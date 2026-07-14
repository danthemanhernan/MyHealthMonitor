# Science Notes

This project should prefer transparent, evidence-informed rules over opaque wellness scores. Features can be useful without pretending to be medical diagnosis.

## Sleep Debt

### Credibility

The sleep debt feature is scientifically credible as a concept: insufficient sleep can accumulate across days and affect attention, mood, metabolic health, safety, and daily functioning.

The current implementation should be treated as a practical heuristic, not a clinically validated sleep debt model.

Supported:

- Tracking repeated short sleep as a risk signal.
- Flagging nights below a minimum threshold.
- Showing that later longer sleep can reduce recent sleep pressure.
- Nudging lower training intensity or earlier bedtime after short sleep.

Not yet supported:

- Claiming that debt is repaid perfectly minute-for-minute.
- Using the debt value as a medical score.
- Treating wearable sleep duration as a precise clinical measurement.
- Ignoring sleep quality, awakenings, circadian timing, illness, alcohol, stress, and training load.

### Current App Rule

- Goal: 7h 30m.
- Green: 7h 30m or more.
- Watch: 6h 30m to 7h 29m.
- Red flag: under 6h 30m.
- Debt: sub-6h30m nights create debt against the 7h30m goal.
- Repayment: later sleep above 7h30m reduces the recent debt.

This rule is intentionally conservative. CDC guidance lists adults 18-60 as needing at least 7 hours, so a 7h30m goal sits within normal adult guidance. The under-6h30m red flag is a product threshold, not a universal clinical cutoff.

### Evidence Standard For Future Changes

Every scoring or recommendation feature should document:

- User-facing claim.
- Data required.
- Rule or model behavior.
- Evidence level.
- Known limitations.
- When to avoid making the recommendation.

### Evidence Notes

- CDC says adults 18-60 should get 7 or more hours of sleep per night and emphasizes that sleep quality matters too.
- NHLBI describes sleep deprivation as not getting enough sleep and sleep deficiency more broadly as inadequate timing, quality, or sleep stages. NHLBI links sleep deficiency with impaired learning, focus, reaction time, mood, safety, and chronic health risks.
- Laboratory sleep restriction studies by Van Dongen, Dinges, and colleagues found cumulative neurobehavioral impairment with repeated restricted sleep opportunities.
- Real-world wearable and interaction studies have found that insufficient sleep can be associated with performance changes lasting multiple days, but these are observational and should not be overused as diagnosis.

Useful sources:

- CDC, About Sleep: https://www.cdc.gov/sleep/about/
- NHLBI, Sleep Deprivation and Deficiency: https://www.nhlbi.nih.gov/health/sleep-deprivation
- Van Dongen HPA, Maislin G, Mullington JM, Dinges DF. The cumulative cost of additional wakefulness. Sleep. 2003.
- Banks S, Dinges DF. Behavioral and physiological consequences of sleep restriction. Journal of Clinical Sleep Medicine. 2007.
- Althoff T, Horvitz E, White RW, Zeitzer J. Harnessing the Web for Population-Scale Physiological Sensing: A Case Study of Sleep and Performance. 2017.
