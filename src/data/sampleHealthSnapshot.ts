import importedData from "./health-data.json";
import type {
  AiInsight,
  DailySignal,
  DataSource,
  HealthMetric,
  ImportedDailyMetric,
  ImportedRoute,
  ImportedWorkout,
  NutritionDay,
  Nudge,
  SleepTrendPoint,
} from "../types";

const dailyMetrics = importedData.dailyMetrics as ImportedDailyMetric[];
export const importedDailyMetrics = dailyMetrics;
export const importedNutritionDays = importedData.nutritionDays as NutritionDay[];
export const importedWorkouts = importedData.workouts as ImportedWorkout[];
export const importedRoutes = importedData.workoutRoutes as ImportedRoute[];
const latestDate = dailyMetrics.at(-1)?.date ?? "";
const latestSevenDays = dailyMetrics.slice(-7);
const sleepDays = dailyMetrics.filter((day) => day.sleepMinutes != null);
const latestSevenSleepDays = sleepDays.slice(-7);
const latest = latestSevenDays.at(-1) ?? dailyMetrics.at(-1)!;
const previous = dailyMetrics.at(-2) ?? latest;
const latestSleepDay = sleepDays.at(-1);
const previousSleepDay = sleepDays.at(-2);
const latestSleep = latestSleepDay?.sleepMinutes ?? null;
const previousSleep = previousSleepDay?.sleepMinutes ?? null;
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const formatNumber = (value: number) => Math.round(value).toLocaleString("en-US");
const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const durationLabel = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
const deltaLabel = (value: number, unit: string) => `${value >= 0 ? "+" : ""}${formatNumber(value)}${unit}`;
const nutrition = latest.nutrition;
const averageSteps = average(latestSevenDays.map((day) => day.steps));
const averageSleep = average(latestSevenSleepDays.flatMap((day) => day.sleepMinutes == null ? [] : [day.sleepMinutes]));
const averageProtein = average(latestSevenDays.flatMap((day) => day.nutrition?.proteinG == null ? [] : [day.nutrition.proteinG]));

export const healthGoals = {
  weightLb: 150,
  calories: 2000,
  fiberG: 25,
  carbsG: 195,
  fatG: 54,
  proteinG: 170,
  sleepMinutes: 450,
  steps: 8500,
  restingHeartRateBpm: 62,
};

export const dailySignals: DailySignal[] = [
  {
    label: "Sleep",
    score: Math.min(100, Math.round((averageSleep / healthGoals.sleepMinutes) * 100)),
    summary: `${durationLabel(Math.round(averageSleep))} average across the latest seven overnight sleep windows.`,
  },
  {
    label: "Activity",
    score: Math.min(100, Math.round((averageSteps / healthGoals.steps) * 100)),
    summary: `${formatNumber(averageSteps)} average steps, with ${latest.workoutCount} workout${latest.workoutCount === 1 ? "" : "s"} on the latest day.`,
  },
  {
    label: "Nutrition",
    score: nutrition?.proteinG ? Math.min(100, Math.round((averageProtein / healthGoals.proteinG) * 100)) : 0,
    summary: nutrition?.proteinG ? `${nutrition.proteinG}g protein on ${formatDate(latestDate)}; imported from the MyFitnessPal PDF.` : "No nutrition total was available for the latest day.",
  },
];

export const metrics: HealthMetric[] = [
  {
    label: "Sleep",
    value: latestSleep == null ? "--" : durationLabel(latestSleep),
    trend: latestSleep != null && previousSleep != null && latestSleep >= previousSleep ? "up" : "down",
    trendLabel: latestSleep == null || previousSleep == null ? "no prior record" : `${deltaLabel(latestSleep - previousSleep, "m")} vs previous day`,
    target: "7h 30m target",
    status: latestSleep != null && latestSleep >= healthGoals.sleepMinutes ? "strong" : latestSleep != null && latestSleep >= 390 ? "watch" : "needs-attention",
  },
  {
    label: "Resting HR",
    value: latest.restingHeartRate == null ? "--" : String(latest.restingHeartRate),
    unit: latest.restingHeartRate == null ? undefined : "bpm",
    trend: latest.restingHeartRate != null && previous.restingHeartRate != null && latest.restingHeartRate < previous.restingHeartRate ? "down" : "flat",
    trendLabel: latest.restingHeartRate == null ? "no record" : "Apple Health daily average",
    target: `under ${healthGoals.restingHeartRateBpm} bpm`,
    status: latest.restingHeartRate != null && latest.restingHeartRate < healthGoals.restingHeartRateBpm ? "strong" : "watch",
  },
  {
    label: "Steps",
    value: formatNumber(latest.steps),
    trend: latest.steps >= previous.steps ? "up" : "down",
    trendLabel: `${deltaLabel(latest.steps - previous.steps, "")} vs previous day`,
    target: `${formatNumber(healthGoals.steps)} daily goal`,
    status: latest.steps >= healthGoals.steps ? "strong" : "watch",
  },
  {
    label: "Weight",
    value: latest.weightLb == null ? "--" : latest.weightLb.toFixed(1),
    unit: latest.weightLb == null ? undefined : "lb",
    trend: latest.weightLb != null && previous.weightLb != null && latest.weightLb < previous.weightLb ? "down" : "flat",
    trendLabel: latest.weightLb == null ? "no record" : "latest Apple Health sample",
    target: `${healthGoals.weightLb} lb goal`,
    status: latest.weightLb != null && latest.weightLb <= healthGoals.weightLb ? "strong" : "watch",
  },
  {
    label: "Protein",
    value: nutrition?.proteinG == null ? "--" : String(nutrition.proteinG),
    unit: nutrition?.proteinG == null ? undefined : "g",
    trend: "flat",
    trendLabel: nutrition?.proteinG == null ? "no nutrition total" : `${deltaLabel(nutrition.proteinG - healthGoals.proteinG, "g")} vs goal`,
    target: `${healthGoals.proteinG}g daily goal`,
    status: nutrition?.proteinG != null && nutrition.proteinG >= healthGoals.proteinG ? "strong" : "watch",
  },
  {
    label: "Calories",
    value: nutrition?.calories == null ? "--" : formatNumber(nutrition.calories),
    unit: nutrition?.calories == null ? undefined : "cal",
    trend: "flat",
    trendLabel: nutrition?.calories == null ? "no nutrition total" : `${nutrition.carbsG ?? "--"}g carbs / ${nutrition.fatG ?? "--"}g fat`,
    target: `${formatNumber(healthGoals.calories)} cal goal`,
    status: nutrition?.calories != null && Math.abs(nutrition.calories - healthGoals.calories) <= 200 ? "strong" : "watch",
  },
  {
    label: "Carbs",
    value: nutrition?.carbsG == null ? "--" : String(nutrition.carbsG),
    unit: nutrition?.carbsG == null ? undefined : "g",
    trend: "flat",
    trendLabel: nutrition?.carbsG == null ? "no nutrition total" : `${deltaLabel(nutrition.carbsG - healthGoals.carbsG, "g")} vs goal`,
    target: `${healthGoals.carbsG}g daily goal`,
    status: nutrition?.carbsG != null && nutrition.carbsG <= healthGoals.carbsG ? "strong" : "watch",
  },
  {
    label: "Fat",
    value: nutrition?.fatG == null ? "--" : String(nutrition.fatG),
    unit: nutrition?.fatG == null ? undefined : "g",
    trend: "flat",
    trendLabel: nutrition?.fatG == null ? "no nutrition total" : `${deltaLabel(nutrition.fatG - healthGoals.fatG, "g")} vs goal`,
    target: `${healthGoals.fatG}g daily goal`,
    status: nutrition?.fatG != null && nutrition.fatG <= healthGoals.fatG ? "strong" : "watch",
  },
  {
    label: "Fiber",
    value: nutrition?.fiberG == null ? "--" : String(nutrition.fiberG),
    unit: nutrition?.fiberG == null ? undefined : "g",
    trend: "flat",
    trendLabel: nutrition?.fiberG == null ? "no nutrition total" : `${deltaLabel(nutrition.fiberG - healthGoals.fiberG, "g")} vs goal`,
    target: `${healthGoals.fiberG}g daily goal`,
    status: nutrition?.fiberG != null && nutrition.fiberG >= healthGoals.fiberG ? "strong" : "watch",
  },
];

export const sleepTrend: SleepTrendPoint[] = latestSevenSleepDays.map((day) => ({
  date: new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
  sleepMinutes: day.sleepMinutes ?? 0,
  sleepScore: day.sleepMinutes == null ? 0 : Math.min(100, Math.round((day.sleepMinutes / healthGoals.sleepMinutes) * 100)),
  bedtime: day.bedtime ? new Date(day.bedtime.replace(" ", "T")).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "--",
  wakeTime: day.wakeTime ? new Date(day.wakeTime.replace(" ", "T")).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "--",
}));

export const nudges: Nudge[] = [
  {
    title: latestSleep == null || latestSleep < 390 ? "Protect tonight's sleep window" : "Keep sleep timing steady",
    body: latestSleep == null || latestSleep < 390 ? "The latest overnight sleep window was below the 6h30m flag threshold. Favor an earlier wind-down before adding training load." : "The latest overnight sleep window is near goal; keep bedtime consistent to protect the current trend.",
    priority: "today",
  },
  {
    title: latest.steps < healthGoals.steps ? "Add a short walk" : "Hold the activity baseline",
    body: latest.steps < healthGoals.steps ? "A brief walk would close the gap to the daily step target." : "Steps are above the current daily target; consistency matters more than adding volume today.",
    priority: "today",
  },
  {
    title: nutrition?.proteinG != null && nutrition.proteinG < healthGoals.proteinG ? "Plan one protein anchor" : "Keep the nutrition routine",
    body: nutrition?.proteinG != null && nutrition.proteinG < healthGoals.proteinG ? "Add a planned protein serving earlier in the day rather than relying on a late catch-up meal." : "The latest imported nutrition total is at or near the protein target.",
    priority: "this-week",
  },
];

export const dataSources: DataSource[] = [
  { name: "Apple Watch / Apple Health", status: "connected", nextStep: `${importedData.dailyMetrics.length.toLocaleString()} daily records normalized from the XML export.` },
  { name: "Bluetooth scale", status: "connected", nextStep: "Weight samples were included through Apple Health." },
  { name: "MyFitnessPal", status: "manual", nextStep: `${importedData.nutritionDays.length} PDF daily totals imported; use CSV next time.` },
  { name: "Workout routes", status: "connected", nextStep: `${importedData.workoutRoutes.length} GPX route summaries indexed without embedding track points.` },
];

export const aiInsights: AiInsight[] = [
  {
    title: "Recent sleep is the clearest lever",
    summary: "The imported Apple Watch window contains one clearly short night and several nights below the 7h30m goal.",
    evidence: `${latestSevenSleepDays.filter((day) => day.sleepMinutes != null && day.sleepMinutes < 390).length} of the latest ${latestSevenSleepDays.length} sleep windows fell below 6h30m; latest record was ${durationLabel(latestSleep ?? 0)}.`,
    action: "Protect an earlier bedtime before increasing training volume.",
    confidence: "medium",
  },
  {
    title: "Protein is visible in the imported nutrition data",
    summary: "The PDF totals provide enough signal for a practical macro nudge, but not the confidence of a structured CSV import.",
    evidence: `${nutrition?.proteinG ?? "No"}g protein on ${formatDate(latestDate)} against a ${healthGoals.proteinG}g goal.`,
    action: "Use one planned protein anchor earlier in the day when the total is short.",
    confidence: "medium",
  },
  {
    title: "The dashboard is now powered by real local data",
    summary: "Apple Health records, workouts, GPX route summaries, and MyFitnessPal daily totals are available in one normalized JSON fixture.",
    evidence: `${importedData.workouts.length} workouts and ${importedData.workoutRoutes.length} route files were parsed from the raw export.`,
    action: "Use this snapshot to test the UI before adding a recurring CSV importer.",
    confidence: "high",
  },
];
