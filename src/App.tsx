import { useState, type CSSProperties, type ReactNode } from "react";
import {
  aiInsights,
  dailySignals,
  dataSources,
  healthGoals,
  importedDailyMetrics,
  importedNutritionDays,
  importedRoutes,
  importedWorkouts,
  metrics,
  nudges,
  sleepTrend,
} from "./data/sampleHealthSnapshot";
import type { NutritionDay } from "./types";

const statusLabels = {
  strong: "On track",
  watch: "Watch",
  "needs-attention": "Action",
};

const sourceLabels = {
  connected: "Connected",
  manual: "Manual",
  planned: "Planned",
};

const confidenceLabels = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

const formatSleepDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
};

const sleepGoalMinutes = healthGoals.sleepMinutes;
const lowSleepThresholdMinutes = 390;

const getSleepStatus = (minutes: number) => {
  if (minutes >= sleepGoalMinutes) {
    return "good";
  }

  if (minutes < lowSleepThresholdMinutes) {
    return "low";
  }

  return "watch";
};

const getSleepStatusLabel = (minutes: number) => {
  if (minutes >= sleepGoalMinutes) {
    return "Goal";
  }

  if (minutes < lowSleepThresholdMinutes) {
    return "Flag";
  }

  return "Watch";
};

type DashboardTab = "overview" | "sleep" | "activity" | "nutrition";

const tabLabels: Array<{ id: DashboardTab; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "Your current scorecard" },
  { id: "sleep", label: "Sleep", description: "Nightly recovery detail" },
  { id: "activity", label: "Activity", description: "Steps and workouts" },
  { id: "nutrition", label: "Nutrition", description: "Calories and macros" },
];

const compactDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const weekdayLabel = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });

const percentOfGoal = (value: number | undefined, goal: number) =>
  value == null ? 0 : Math.min(100, Math.round((value / goal) * 100));

const clockMinutes = (value: string | null, overnight = false) => {
  if (!value) return null;
  const [hour, minute] = value.slice(11, 16).split(":").map(Number);
  const minutes = hour * 60 + minute;
  return overnight && minutes < 12 * 60 ? minutes + 24 * 60 : minutes;
};

const averageValue = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const meanAbsoluteDeviation = (values: number[], mean: number) => averageValue(values.map((value) => Math.abs(value - mean)));
const formatVariation = (minutes: number) => `${Math.round(minutes)} min`;
const formatClock = (minutes: number) => {
  const normalized = Math.round(minutes) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

function TabNavigation({ activeTab, onChange }: { activeTab: DashboardTab; onChange: (tab: DashboardTab) => void }) {
  return (
    <nav className="tab-navigation" aria-label="Health detail views">
      {tabLabels.map((tab) => (
        <button
          className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
          key={tab.id}
          type="button"
          aria-current={activeTab === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          <strong>{tab.label}</strong>
          <span>{tab.description}</span>
        </button>
      ))}
    </nav>
  );
}

function DetailHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="detail-header">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}

function DataTable({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <caption className="sr-only">{label}</caption>
        {children}
      </table>
    </div>
  );
}

function SleepDetail() {
  const recentSleep = importedDailyMetrics.filter((day) => day.sleepMinutes != null).slice(-14).reverse();
  const averageSleep = Math.round(recentSleep.reduce((sum, day) => sum + (day.sleepMinutes ?? 0), 0) / Math.max(1, recentSleep.length));
  const underGoal = recentSleep.filter((day) => (day.sleepMinutes ?? 0) < healthGoals.sleepMinutes).length;
  const bedtimeValues = recentSleep.flatMap((day) => { const value = clockMinutes(day.bedtime, true); return value == null ? [] : [value]; });
  const wakeValues = recentSleep.flatMap((day) => { const value = clockMinutes(day.wakeTime, true); return value == null ? [] : [value]; });
  const averageBedtime = averageValue(bedtimeValues);
  const averageWakeTime = averageValue(wakeValues);
  const bedtimeVariation = meanAbsoluteDeviation(bedtimeValues, averageBedtime);
  const wakeVariation = meanAbsoluteDeviation(wakeValues, averageWakeTime);
  const scheduleVariation = (bedtimeVariation + wakeVariation) / 2;
  const scheduleScore = Math.max(0, Math.min(100, Math.round(100 - scheduleVariation * 2)));
  const scheduleStatus = scheduleScore >= 80 ? "good" : scheduleScore >= 60 ? "watch" : "low";

  return (
    <section className="detail-view">
      <DetailHeader eyebrow="Sleep detail" title="What is contributing to your sleep score?" copy="Each row is one overnight window grouped from 8:00 PM through 11:00 AM the next day." />
      <div className="detail-stat-grid">
        <article className="detail-stat"><span>14-night average</span><strong>{formatSleepDuration(averageSleep)}</strong><small>Goal: {formatSleepDuration(healthGoals.sleepMinutes)}</small></article>
        <article className="detail-stat"><span>Below goal</span><strong>{underGoal} nights</strong><small>Of the latest {recentSleep.length} imported nights</small></article>
        <article className="detail-stat"><span>Latest window</span><strong>{recentSleep[0]?.sleepMinutes == null ? "--" : formatSleepDuration(recentSleep[0].sleepMinutes)}</strong><small>{recentSleep[0] ? compactDate(recentSleep[0].date) : "No record"}</small></article>
        <article className={`detail-stat schedule-stat ${scheduleStatus}`}><span>Schedule consistency</span><strong>{scheduleScore}/100</strong><small>Bedtime ±{formatVariation(bedtimeVariation)} · wake ±{formatVariation(wakeVariation)}</small></article>
      </div>
      <article className="detail-panel consistency-panel">
        <div className="section-heading"><div><h2>Sleep and wake timing</h2><p>Dots show each imported night; the line marks the average time. A tighter cluster means a more consistent schedule.</p></div><span>{formatClock(averageBedtime)} / {formatClock(averageWakeTime)} average</span></div>
        <div className="timing-chart" aria-label="Bedtime and wake time consistency chart">
          <div className="timing-axis"><span>8 PM</span><span>11 PM</span><span>2 AM</span><span>5 AM</span><span>8 AM</span><span>11 AM</span></div>
          <div className="timing-row"><strong>Bedtime</strong><div className="timing-track"><span className="timing-average" style={{ left: `${((averageBedtime - 1200) / 900) * 100}%` }} /><span className="timing-average-label" style={{ left: `${((averageBedtime - 1200) / 900) * 100}%` }}>{formatClock(averageBedtime)}</span>{bedtimeValues.map((value, index) => { const night = recentSleep[index]; const tooltip = `${weekdayLabel(night?.date ?? "")} night, ${compactDate(night?.date ?? "")}: ${formatSleepDuration(night?.sleepMinutes ?? 0)} · bedtime ${formatClock(value)}`; return <span className="timing-dot bedtime-dot" key={`bed-${night?.date ?? index}`} style={{ left: `${((value - 1200) / 900) * 100}%` }} title={tooltip} aria-label={tooltip} data-tooltip={tooltip} tabIndex={0} />; })}</div></div>
          <div className="timing-row"><strong>Wake</strong><div className="timing-track"><span className="timing-average" style={{ left: `${((averageWakeTime - 1200) / 900) * 100}%` }} /><span className="timing-average-label" style={{ left: `${((averageWakeTime - 1200) / 900) * 100}%` }}>{formatClock(averageWakeTime)}</span>{wakeValues.map((value, index) => { const night = recentSleep[index]; const tooltip = `${weekdayLabel(night?.date ?? "")} night, ${compactDate(night?.date ?? "")}: ${formatSleepDuration(night?.sleepMinutes ?? 0)} · wake ${formatClock(value)}`; return <span className="timing-dot wake-dot" key={`wake-${night?.date ?? index}`} style={{ left: `${((value - 1200) / 900) * 100}%` }} title={tooltip} aria-label={tooltip} data-tooltip={tooltip} tabIndex={0} />; })}</div></div>
        </div>
        <p className="consistency-note">Consistency score uses mean absolute variation in bedtime and wake time across the latest 14 imported nights. It is a practical dashboard heuristic, not a clinical measure.</p>
      </article>
      <article className="detail-panel">
        <div className="section-heading"><div><h2>Nightly windows</h2><p>Imported Apple Health sleep duration, bedtime, and wake time.</p></div><span>Raw + derived</span></div>
        <DataTable label="Recent sleep windows">
          <thead><tr><th>Date</th><th>Night</th><th>Duration</th><th>Bedtime</th><th>Wake time</th><th>Status</th></tr></thead>
          <tbody>{recentSleep.map((day) => <tr key={day.date}><td>{compactDate(day.date)}</td><td>{weekdayLabel(day.date)} night</td><td><strong>{formatSleepDuration(day.sleepMinutes ?? 0)}</strong></td><td>{day.bedtime?.slice(11, 16) ?? "--"}</td><td>{day.wakeTime?.slice(11, 16) ?? "--"}</td><td><span className={`table-status ${day.sleepMinutes != null && day.sleepMinutes >= healthGoals.sleepMinutes ? "good" : day.sleepMinutes != null && day.sleepMinutes < 390 ? "low" : "watch"}`}>{day.sleepMinutes != null && day.sleepMinutes >= healthGoals.sleepMinutes ? "Goal" : day.sleepMinutes != null && day.sleepMinutes < 390 ? "Flag" : "Watch"}</span></td></tr>)}</tbody>
        </DataTable>
      </article>
    </section>
  );
}

function ActivityDetail() {
  const recentDays = importedDailyMetrics.slice(-14).reverse();
  const recentWorkouts = importedWorkouts.slice(-10).reverse();
  const averageSteps = Math.round(recentDays.reduce((sum, day) => sum + day.steps, 0) / Math.max(1, recentDays.length));
  const workoutMinutes = recentDays.reduce((sum, day) => sum + day.workoutMinutes, 0);

  return (
    <section className="detail-view">
      <DetailHeader eyebrow="Activity detail" title="What is contributing to your activity score?" copy="Activity scoring currently emphasizes steps; workouts and route coverage are shown separately so they do not disappear into one number." />
      <div className="detail-stat-grid">
        <article className="detail-stat"><span>14-day steps</span><strong>{averageSteps.toLocaleString()}</strong><small>Average per day · goal {healthGoals.steps.toLocaleString()}</small></article>
        <article className="detail-stat"><span>Workout minutes</span><strong>{Math.round(workoutMinutes)}</strong><small>Across the latest 14 imported days</small></article>
        <article className="detail-stat"><span>Route files</span><strong>{importedRoutes.length}</strong><small>GPX summaries retained in the current window</small></article>
      </div>
      <article className="detail-panel">
        <div className="section-heading"><div><h2>Daily activity</h2><p>Apple Health daily totals and workout duration.</p></div><span>Latest 14 days</span></div>
        <DataTable label="Recent daily activity">
          <thead><tr><th>Date</th><th>Steps</th><th>Active energy</th><th>Workout time</th><th>Workouts</th><th>Workout day</th></tr></thead>
          <tbody>{recentDays.map((day) => <tr key={day.date}><td>{compactDate(day.date)}</td><td><strong>{day.steps.toLocaleString()}</strong></td><td>{day.activeEnergyKcal.toLocaleString()} kcal</td><td>{Math.round(day.workoutMinutes)} min</td><td>{day.workoutCount}</td><td>{day.workoutCount > 0 ? <span className="workout-indicator">✓ Workout</span> : <span className="no-workout">—</span>}</td></tr>)}</tbody>
        </DataTable>
      </article>
      <article className="detail-panel">
        <div className="section-heading"><div><h2>Recent workouts</h2><p>Workout type and duration from Apple Health.</p></div><span>{recentWorkouts.length} shown</span></div>
        <DataTable label="Recent workouts">
          <thead><tr><th>Date</th><th>Type</th><th>Duration</th><th>Source</th></tr></thead>
          <tbody>{recentWorkouts.map((workout, index) => <tr key={`${workout.date}-${workout.type}-${index}`}><td>{compactDate(workout.date)}</td><td>{workout.type.replace(/([a-z])([A-Z])/g, "$1 $2")}</td><td>{Math.round(workout.durationMinutes)} min</td><td>{workout.source || "Apple Health"}</td></tr>)}</tbody>
        </DataTable>
      </article>
    </section>
  );
}

function MacroBar({ label, value, goal, unit = "g" }: { label: string; value: number | undefined; goal: number; unit?: string }) {
  return <div className="macro-row"><div className="macro-label"><strong>{label}</strong><span>{value == null ? "--" : `${value}${unit}`} / {goal}{unit}</span></div><div className="macro-track"><span style={{ width: `${percentOfGoal(value, goal)}%` }} /></div></div>;
}

function NutritionDetail() {
  const days = importedNutritionDays.filter((day) => day.calories != null).slice(-14).reverse();
  const weightDays = importedDailyMetrics.slice(-14);
  const weightValues = weightDays.flatMap((day) => day.weightLb == null ? [] : [day.weightLb]);
  const chartMin = Math.floor(Math.min(healthGoals.weightLb, ...weightValues, healthGoals.weightLb) - 2);
  const chartMax = Math.ceil(Math.max(healthGoals.weightLb, ...weightValues, healthGoals.weightLb) + 2);
  const chartRange = Math.max(1, chartMax - chartMin);
  const weightX = (index: number) => 42 + (index / Math.max(1, weightDays.length - 1)) * 636;
  const weightY = (value: number) => 22 + ((chartMax - value) / chartRange) * 188;
  const goalY = weightY(healthGoals.weightLb);
  const heatmapDays = importedDailyMetrics.slice(-10);
  const heatmapMetrics: Array<{ label: string; goal: number; unit: string; direction?: "max"; getValue: (nutrition: NutritionDay | undefined) => number | undefined }> = [
    { label: "Calories", goal: healthGoals.calories, unit: "cal", getValue: (nutrition) => nutrition?.calories },
    { label: "Protein", goal: healthGoals.proteinG, unit: "g", getValue: (nutrition) => nutrition?.proteinG },
    { label: "Carbs", goal: healthGoals.carbsG, unit: "g", getValue: (nutrition) => nutrition?.carbsG },
    { label: "Fat", goal: healthGoals.fatG, unit: "g", direction: "max", getValue: (nutrition) => nutrition?.fatG },
    { label: "Fiber", goal: healthGoals.fiberG, unit: "g", getValue: (nutrition) => nutrition?.fiberG },
  ];
  const heatmapStatus = (value: number | undefined, goal: number, direction?: "max") => {
    if (value == null) return "missing";
    if (direction === "max" && value <= goal) return "target";
    const difference = Math.abs(value - goal) / goal;
    return difference <= 0.1 ? "target" : difference <= 0.2 ? "off" : "way-off";
  };
  const latestNutrition = days[0];
  const averageCalories = Math.round(days.reduce((sum, day) => sum + (day.calories ?? 0), 0) / Math.max(1, days.length));
  const averageProtein = Math.round(days.reduce((sum, day) => sum + (day.proteinG ?? 0), 0) / Math.max(1, days.length));

  return (
    <section className="detail-view">
      <DetailHeader eyebrow="Nutrition detail" title="What is contributing to your nutrition score?" copy="These daily totals came from the one-time MyFitnessPal PDF extraction. Missing or exercise-only days remain visible as missing nutrition data." />
      <div className="detail-stat-grid">
        <article className="detail-stat"><span>Average calories</span><strong>{averageCalories.toLocaleString()}</strong><small>Goal: {healthGoals.calories.toLocaleString()} calories</small></article>
        <article className="detail-stat"><span>Average protein</span><strong>{averageProtein}g</strong><small>Goal: {healthGoals.proteinG}g</small></article>
        <article className="detail-stat"><span>Latest logged day</span><strong>{latestNutrition ? compactDate(latestNutrition.date) : "--"}</strong><small>PDF-derived totals · CSV recommended next time</small></article>
      </div>
      <article className="detail-panel weight-timeline-panel">
        <div className="section-heading"><div><h2>14-day weight timeline</h2><p>Apple Health weight samples with your goal shown as a horizontal reference line.</p></div><span>Goal: {healthGoals.weightLb} lb</span></div>
        <div className="weight-chart-wrap">
          <svg className="weight-chart" viewBox="0 0 700 250" role="img" aria-label={`Weight timeline for the last 14 days with a ${healthGoals.weightLb} pound goal line`} preserveAspectRatio="none">
            <line className="weight-grid-line" x1="42" x2="678" y1={weightY(chartMax)} y2={weightY(chartMax)} />
            <line className="weight-grid-line" x1="42" x2="678" y1={weightY(chartMin)} y2={weightY(chartMin)} />
            <line className="weight-goal-line" x1="42" x2="678" y1={goalY} y2={goalY} />
            <text className="weight-goal-label" x="678" y={goalY - 7} textAnchor="end">Goal: {healthGoals.weightLb} lb</text>
            <text className="weight-axis-label" x="35" y={weightY(chartMax) + 4} textAnchor="end">{chartMax}</text>
            <text className="weight-axis-label" x="35" y={weightY(chartMin) + 4} textAnchor="end">{chartMin}</text>
            {weightDays.map((day, index) => {
              const next = weightDays[index + 1];
              if (day.weightLb == null || next?.weightLb == null) return null;
              return <line className="weight-trend-line" key={`weight-line-${day.date}`} x1={weightX(index)} x2={weightX(index + 1)} y1={weightY(day.weightLb)} y2={weightY(next.weightLb)} />;
            })}
            {weightDays.map((day, index) => day.weightLb == null ? null : <circle className="weight-point" key={`weight-point-${day.date}`} cx={weightX(index)} cy={weightY(day.weightLb)} r="5"><title>{`${weekdayLabel(day.date)} ${compactDate(day.date)}: ${day.weightLb.toFixed(1)} lb`}</title></circle>)}
          </svg>
          <div className="weight-date-labels">{weightDays.map((day) => <span key={day.date}>{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}<small>{compactDate(day.date)}</small></span>)}</div>
        </div>
        <p className="timeline-note">Dots are actual Apple Health samples. Missing days are left as gaps; the dashed line is your 150 lb goal.</p>
      </article>
      <article className="detail-panel nutrition-heatmap-panel">
        <div className="section-heading"><div><h2>10-day nutrition heatmap</h2><p>Colors compare each logged total with its goal. Gray means no nutrition total was available for that calendar day.</p></div><span>Calendar days</span></div>
        <div className="heatmap-legend" aria-label="Heatmap legend"><span><i className="heatmap-swatch target" />On target</span><span><i className="heatmap-swatch off" />Off by 20%</span><span><i className="heatmap-swatch way-off" />Way off</span><span><i className="heatmap-swatch missing" />Missing</span></div>
        <div className="nutrition-heatmap-wrap">
          <div className="nutrition-heatmap" role="grid" aria-label="Nutrition goal heatmap for the last ten days">
            <div className="heatmap-corner" />
            {heatmapDays.map((day) => <div className="heatmap-date" key={`date-${day.date}`} role="columnheader"><strong>{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}</strong><span>{compactDate(day.date)}</span></div>)}
            {heatmapMetrics.map((metric) => <div className="heatmap-row" key={metric.label} role="row"><div className="heatmap-label" role="rowheader"><strong>{metric.label}</strong><span>Goal: {metric.goal.toLocaleString()}{metric.unit}{metric.direction === "max" ? " max" : ""}</span></div>{heatmapDays.map((day) => { const value = metric.getValue(day.nutrition); const status = heatmapStatus(value, metric.goal, metric.direction); const statusLabel = status === "target" ? metric.direction === "max" ? "at or under goal" : "on target" : status === "off" ? "off by 20%" : "way off"; const tooltip = value == null ? `${metric.label} on ${compactDate(day.date)}: no logged total` : `${metric.label} on ${new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" })}: ${value}${metric.unit} vs ${metric.goal}${metric.unit} goal (${statusLabel})`; return <span className={`heatmap-cell ${status}`} key={`${metric.label}-${day.date}`} role="gridcell" title={tooltip} aria-label={tooltip} data-tooltip={tooltip} tabIndex={0}>{value == null ? "—" : value}</span>; })}</div>)}
          </div>
        </div>
      </article>
      <article className="detail-panel">
        <div className="section-heading"><div><h2>Latest macro balance</h2><p>{latestNutrition ? `MyFitnessPal totals for ${compactDate(latestNutrition.date)}.` : "No nutrition total available."}</p></div><span>Goal comparison</span></div>
        <div className="macro-list"><MacroBar label="Protein" value={latestNutrition?.proteinG} goal={healthGoals.proteinG} /><MacroBar label="Carbs" value={latestNutrition?.carbsG} goal={healthGoals.carbsG} /><MacroBar label="Fat" value={latestNutrition?.fatG} goal={healthGoals.fatG} /><MacroBar label="Fiber" value={latestNutrition?.fiberG} goal={healthGoals.fiberG} /></div>
      </article>
      <article className="detail-panel">
        <div className="section-heading"><div><h2>Daily nutrition</h2><p>Calories and macros available from the PDF totals.</p></div><span>Latest 14 logged days</span></div>
        <DataTable label="Recent daily nutrition">
          <thead><tr><th>Date</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Fiber</th></tr></thead>
          <tbody>{days.map((day) => <tr key={day.date}><td>{compactDate(day.date)}</td><td><strong>{day.calories?.toLocaleString()}</strong></td><td>{day.proteinG ?? "--"}g</td><td>{day.carbsG ?? "--"}g</td><td>{day.fatG ?? "--"}g</td><td>{day.fiberG ?? "--"}g</td></tr>)}</tbody>
        </DataTable>
      </article>
    </section>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const averageSleepMinutes = Math.round(
    sleepTrend.reduce((total, point) => total + point.sleepMinutes, 0) / sleepTrend.length,
  );
  const sleepDebt = sleepTrend.reduce(
    (debt, point) => {
      const isLowSleepDay = point.sleepMinutes < lowSleepThresholdMinutes;
      const deficit = isLowSleepDay ? sleepGoalMinutes - point.sleepMinutes : 0;
      const repayment = point.sleepMinutes > sleepGoalMinutes ? point.sleepMinutes - sleepGoalMinutes : 0;

      return Math.max(0, debt + deficit - repayment);
    },
    0,
  );
  const lowSleepDays = sleepTrend.filter((point) => point.sleepMinutes < lowSleepThresholdMinutes);
  const sleepDebtLabel =
    sleepDebt > 0
      ? `${formatSleepDuration(sleepDebt)} sleep debt`
      : lowSleepDays.length > 0
        ? "Short sleep recovered"
        : "No flagged sleep debt";

  return (
    <main className="app-shell">
      <section className="dashboard-header" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Personal health cockpit</p>
          <h1 id="page-title">Daily Health Scorecard</h1>
          <p className="header-copy">
            Sleep, nutrition, and activity are the primary signals. The app should explain what moved,
            why it matters, and what to adjust next.
          </p>
        </div>
        <div className="focus-panel" aria-label="Today focus">
          <span className="focus-label">Today&apos;s focus</span>
          <strong>Sleep</strong>
          <span className="focus-caption">{sleepDebtLabel}</span>
        </div>
      </section>

      <TabNavigation activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "sleep" ? <SleepDetail /> : null}
      {activeTab === "activity" ? <ActivityDetail /> : null}
      {activeTab === "nutrition" ? <NutritionDetail /> : null}

      {activeTab === "overview" ? (
        <>

      <section className="signal-grid" aria-label="Daily health score categories">
        {dailySignals.map((signal) => (
          <article className="signal-card" key={signal.label}>
            <div className="signal-ring" style={{ "--score": `${signal.score}%` } as CSSProperties}>
              <span>{signal.score}</span>
            </div>
            <div>
              <h2>{signal.label}</h2>
              <p>{signal.summary}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="sleep-insight-grid" aria-label="Sleep and AI insights">
        <article className="sleep-panel">
          <div className="section-heading">
            <div>
              <h2>Sleep Trend</h2>
              <p>Seven overnight windows from Apple Health</p>
            </div>
            <span>{formatSleepDuration(averageSleepMinutes)} avg</span>
          </div>
          <div className="sleep-chart" role="list" aria-label="Sleep duration by day">
            {sleepTrend.map((point) => {
              const height = Math.max(24, Math.round((point.sleepMinutes / 540) * 100));
              const sleepStatus = getSleepStatus(point.sleepMinutes);

              return (
                <div className={`sleep-day ${sleepStatus}`} key={point.date} role="listitem">
                  <div className="sleep-bar-wrap">
                    <div
                      className="sleep-bar"
                      style={{ "--bar-height": `${height}%` } as CSSProperties}
                      aria-label={`${point.date}: ${formatSleepDuration(point.sleepMinutes)}, ${getSleepStatusLabel(point.sleepMinutes)}`}
                    />
                  </div>
                  <strong>{point.date}</strong>
                  <span>{formatSleepDuration(point.sleepMinutes)}</span>
                  <small>{getSleepStatusLabel(point.sleepMinutes)}</small>
                </div>
              );
            })}
          </div>
          <div className="sleep-details">
            <span>Target: {formatSleepDuration(sleepGoalMinutes)}</span>
            <span>Red flag: under {formatSleepDuration(lowSleepThresholdMinutes)}</span>
            <span>Best: {formatSleepDuration(Math.max(...sleepTrend.map((point) => point.sleepMinutes)))}</span>
            <span>{sleepDebtLabel}</span>
          </div>
          {sleepDebt > 0 ? (
            <p className="sleep-debt-alert">
              Sleep debt remains after catch-up sleep. Keep tonight lower intensity or create a longer sleep
              window before stacking hard training days.
            </p>
          ) : null}
        </article>

        <article className="ai-panel">
          <div className="section-heading">
            <div>
              <h2>AI-Assisted Insights</h2>
              <p>Draft recommendations from visible trends</p>
            </div>
            <span>Local rules</span>
          </div>
          <div className="insight-list">
            {aiInsights.map((insight) => (
              <section className="insight-item" key={insight.title}>
                <div className="insight-heading">
                  <h3>{insight.title}</h3>
                  <span>{confidenceLabels[insight.confidence]}</span>
                </div>
                <p>{insight.summary}</p>
                <dl>
                  <div>
                    <dt>Evidence</dt>
                    <dd>{insight.evidence}</dd>
                  </div>
                  <div>
                    <dt>Next action</dt>
                    <dd>{insight.action}</dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid">
        <div className="metrics-section">
          <div className="section-heading">
            <h2>Core Metrics</h2>
            <span>Imported + derived</span>
          </div>
          <div className="metrics-grid">
            {metrics.map((metric) => (
              <article className={`metric-card ${metric.status}`} key={metric.label}>
                <div className="metric-topline">
                  <h3>{metric.label}</h3>
                  <span>{statusLabels[metric.status]}</span>
                </div>
                <div className="metric-value">
                  <strong>{metric.value}</strong>
                  {metric.unit ? <span>{metric.unit}</span> : null}
                </div>
                <p>{metric.trendLabel}</p>
                <small>{metric.target}</small>
              </article>
            ))}
          </div>
        </div>

        <aside className="side-column" aria-label="Guidance">
          <section className="nudge-panel">
            <div className="section-heading">
              <h2>Nudges</h2>
              <span>3 active</span>
            </div>
            <div className="nudge-list">
              {nudges.map((nudge) => (
                <article className="nudge-item" key={nudge.title}>
                  <span>{nudge.priority === "today" ? "Today" : "This week"}</span>
                  <h3>{nudge.title}</h3>
                  <p>{nudge.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="source-panel">
            <div className="section-heading">
              <h2>Sources</h2>
              <span>Import plan</span>
            </div>
            <div className="source-list">
              {dataSources.map((source) => (
                <article className="source-row" key={source.name}>
                  <div>
                    <h3>{source.name}</h3>
                    <p>{source.nextStep}</p>
                  </div>
                  <span className={`source-pill ${source.status}`}>{sourceLabels[source.status]}</span>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
        </>
      ) : null}
    </main>
  );
}

export default App;
