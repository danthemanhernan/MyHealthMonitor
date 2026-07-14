export type HealthMetric = {
  label: string;
  value: string;
  unit?: string;
  trend: "up" | "down" | "flat";
  trendLabel: string;
  target: string;
  status: "strong" | "watch" | "needs-attention";
};

export type DailySignal = {
  label: string;
  score: number;
  summary: string;
};

export type Nudge = {
  title: string;
  body: string;
  priority: "today" | "this-week";
};

export type DataSource = {
  name: string;
  status: "planned" | "manual" | "connected";
  nextStep: string;
};

export type SleepTrendPoint = {
  date: string;
  sleepMinutes: number;
  sleepScore: number;
  bedtime: string;
  wakeTime: string;
};

export type AiInsight = {
  title: string;
  summary: string;
  evidence: string;
  action: string;
  confidence: "low" | "medium" | "high";
};

export type NutritionDay = {
  date: string;
  calories?: number;
  carbsG?: number;
  fatG?: number;
  proteinG?: number;
  cholesterolMg?: number;
  sodiumMg?: number;
  sugarG?: number;
  fiberG?: number;
};

export type ImportedDailyMetric = {
  date: string;
  steps: number;
  stepSource?: string | null;
  activeEnergyKcal: number;
  restingHeartRate: number | null;
  hrvMs: number | null;
  weightLb: number | null;
  sleepMinutes: number | null;
  bedtime: string | null;
  wakeTime: string | null;
  workoutCount: number;
  workoutMinutes: number;
  nutrition?: NutritionDay;
};

export type ImportedWorkout = {
  date: string;
  type: string;
  durationMinutes: number;
  calories: number;
  source: string;
};

export type ImportedRoute = {
  date: string;
  file: string;
  points: number;
};
