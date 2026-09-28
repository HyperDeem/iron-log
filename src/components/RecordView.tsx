import {
  CalendarDays,
  Check,
  ChevronDown,
  Dumbbell,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FailureType, WorkoutSession, WorkoutSet } from "../types";
import {
  buildWorkoutSets,
  clamp,
  FAILURE_LABELS,
  formatCompactNumber,
  formatDateLabel,
  formatNumber,
  getRecentExerciseNames,
  getSessionStats,
  groupSets,
  REST_OPTIONS,
  safeNumber,
} from "../lib/workout";
import { RestTimer } from "./RestTimer";

interface RecordViewProps {
  sessions: WorkoutSession[];
  activeDate: string;
  session?: WorkoutSession;
  onDateChange: (date: string) => void;
  onAddSets: (date: string, title: string, sets: WorkoutSet[]) => void;
  onUpdateMeta: (date: string, patch: { title?: string; notes?: string }) => void;
  onUpdateSet: (date: string, setId: string, patch: Partial<WorkoutSet>) => void;
  onDeleteSet: (date: string, setId: string) => void;
  onDeleteGroup: (date: string, exercise: string) => void;
  onToast: (message: string) => void;
}

const REST_CHOICES = [45, ...REST_OPTIONS];

export function RecordView({
  sessions,
  activeDate,
  session,
  onDateChange,
  onAddSets,
  onUpdateMeta,
  onUpdateSet,
  onDeleteSet,
  onDeleteGroup,
  onToast,
}: RecordViewProps) {
  const [title, setTitle] = useState(session?.title ?? "训练");
  const [notes, setNotes] = useState(session?.notes ?? "");
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState(40);
  const [reps, setReps] = useState(10);
  const [setCount, setSetCount] = useState(4);
  const [failureType, setFailureType] = useState<FailureType>("set");
  const [restSeconds, setRestSeconds] = useState(90);
  const [timerSignal, setTimerSignal] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const recentExercises = useMemo(() => getRecentExerciseNames(sessions), [sessions]);
  const stats = session ? getSessionStats(session) : { sessionCount: 0, setCount: 0, totalVolume: 0, totalReps: 0 };
  const groups = useMemo(() => groupSets(session?.sets ?? []), [session?.sets]);

  useEffect(() => {
    setTitle(session?.title ?? "训练");
    setNotes(session?.notes ?? "");
    setExercise("");
  }, [activeDate, session?.id]);

  const handleAdd = () => {
    const cleanExercise = exercise.trim();
    if (!cleanExercise) {
      onToast("先填写训练项目");
      return;
    }

    const sets = buildWorkoutSets(
      cleanExercise,
      Math.max(0, weight),
      Math.max(1, Math.round(reps)),
      clamp(Math.round(setCount), 1, 20),
      failureType,
      restSeconds,
    );
    onAddSets(activeDate, title, sets);
    onToast(`已添加 ${sets.length} 组 ${cleanExercise}`);
    setTimerSignal((value) => value + 1);
    setShowNotes(false);
  };

  return (
    <main className="view record-view">
      <section className="date-strip">
        <label className="date-control">
          <CalendarDays size={18} />
          <span>{formatDateLabel(activeDate, { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</span>
          <input
            type="date"
            value={activeDate}
            onChange={(event) => onDateChange(event.target.value)}
            aria-label="选择训练日期"
          />
        </label>
        <input
          className="session-title-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => session && onUpdateMeta(activeDate, { title })}
          maxLength={30}
          placeholder="训练名称"
          aria-label="训练名称"
        />
      </section>

      <section className="stats-band" aria-label="今日数据">
        <div>
          <span>动作</span>
          <strong>{groups.length}</strong>
        </div>
        <div>
          <span>组数</span>
          <strong>{stats.setCount}</strong>
        </div>
        <div>
          <span>总容量</span>
          <strong>
            {formatCompactNumber(stats.totalVolume)}
            <small>kg</small>
          </strong>
        </div>
        <div>
          <span>总次数</span>
          <strong>{stats.totalReps}</strong>
        </div>
      </section>

      <section className="entry-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">QUICK SET</span>
            <h2>添加训练</h2>
          </div>
          <Dumbbell size={22} />
        </div>

        <label className="field">
          <span>训练项目</span>
          <input
            value={exercise}
            onChange={(event) => setExercise(event.target.value)}
            placeholder="例如：深蹲"
            autoComplete="off"
          />
        </label>

        <div className="exercise-chips" aria-label="最近动作">
          {recentExercises.slice(0, 7).map((name) => (
            <button key={name} type="button" className="chip" onClick={() => setExercise(name)}>
              {name}
            </button>
          ))}
        </div>

        <div className="stepper-grid">
          <NumberStepper
            label="使用重量"
            value={weight}
            unit="kg"
            step={2.5}
            minimum={0}
            maximum={1000}
            onChange={setWeight}
          />
          <NumberStepper
            label="每组次数"
            value={reps}
            unit="次"
            step={1}
            minimum={1}
            maximum={100}
            onChange={setReps}
          />
          <NumberStepper
            label="本次组数"
            value={setCount}
            unit="组"
            step={1}
            minimum={1}
            maximum={20}
            onChange={setSetCount}
          />
        </div>

        <div className="field">
          <span>力竭方式</span>
          <div className="segmented-control">
            {(["set", "exercise"] as FailureType[]).map((value) => (
              <button
                key={value}
                type="button"
                className={failureType === value ? "is-active" : ""}
                onClick={() => setFailureType(value)}
                aria-pressed={failureType === value}
              >
                {failureType === value && <Check size={15} />}
                {FAILURE_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>组间休息</span>
          <div className="rest-options">
            {REST_CHOICES.map((seconds) => (
              <button
                key={seconds}
                type="button"
                className={restSeconds === seconds ? "is-active" : ""}
                onClick={() => setRestSeconds(seconds)}
                aria-pressed={restSeconds === seconds}
              >
                {seconds < 60 ? `${seconds}秒` : `${seconds / 60}分`}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="primary-button" onClick={handleAdd}>
          <Plus size={20} />
          添加 {clamp(Math.round(setCount), 1, 20)} 组
        </button>

        <button type="button" className="notes-toggle" onClick={() => setShowNotes((value) => !value)}>
          <span>训练备注</span>
          <ChevronDown size={17} className={showNotes ? "is-open" : ""} />
        </button>
        {showNotes && (
          <textarea
            className="notes-input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => session && onUpdateMeta(activeDate, { notes })}
            placeholder="今天的状态、疼痛或计划调整"
            rows={3}
          />
        )}
      </section>

      <RestTimer duration={restSeconds} startSignal={timerSignal} />

      <section className="sets-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TODAY</span>
            <h2>当天明细</h2>
          </div>
          <span className="section-count">{stats.setCount} 组</span>
        </div>

        {groups.length === 0 ? (
          <div className="empty-state">
            <Dumbbell size={28} />
            <strong>这一天还没有训练记录</strong>
            <span>从上面填写一个动作，记录会立即保存在本机。</span>
          </div>
        ) : (
          <div className="exercise-groups">
            {groups.map((group) => {
              const volume = group.sets.reduce((total, set) => total + set.weight * set.reps, 0);
              return (
                <section className="exercise-group" key={group.exercise}>
                  <header className="exercise-group__header">
                    <div>
                      <h3>{group.exercise}</h3>
                      <span>
                        {group.sets.length} 组 · {formatNumber(volume, 0)} kg
                      </span>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`删除全部${group.exercise}记录`}
                      onClick={() => {
                        if (window.confirm(`删除“${group.exercise}”的全部记录？`)) {
                          onDeleteGroup(activeDate, group.exercise);
                        }
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </header>

                  <div className="set-list">
                    {group.sets.map((set, index) => (
                      <SetRow
                        key={set.id}
                        index={index}
                        set={set}
                        onUpdate={(patch) => onUpdateSet(activeDate, set.id, patch)}
                        onDelete={() => onDeleteSet(activeDate, set.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

interface NumberStepperProps {
  label: string;
  value: number;
  unit: string;
  step: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
}

function NumberStepper({
  label,
  value,
  unit,
  step,
  minimum,
  maximum,
  onChange,
}: NumberStepperProps) {
  const change = (next: number) => onChange(clamp(Number(next.toFixed(2)), minimum, maximum));

  return (
    <div className="number-stepper">
      <span>
        {label} · {unit}
      </span>
      <div className="number-stepper__control">
        <button type="button" onClick={() => change(value - step)} aria-label={`${label}减少${step}`}>
          <Minus size={17} />
        </button>
        <label>
          <input
            type="number"
            inputMode="decimal"
            value={value}
            min={minimum}
            max={maximum}
            step={step}
            onChange={(event) => change(safeNumber(event.target.value, value))}
            aria-label={label}
          />
        </label>
        <button type="button" onClick={() => change(value + step)} aria-label={`${label}增加${step}`}>
          <Plus size={17} />
        </button>
      </div>
    </div>
  );
}

interface SetRowProps {
  index: number;
  set: WorkoutSet;
  onUpdate: (patch: Partial<WorkoutSet>) => void;
  onDelete: () => void;
}

function SetRow({ index, set, onUpdate, onDelete }: SetRowProps) {
  return (
    <div className="set-row">
      <div className="set-row__top">
        <strong>第 {index + 1} 组</strong>
        <button
          type="button"
          className={`failure-pill ${set.failureType === "exercise" ? "is-exercise" : ""}`}
          onClick={() => onUpdate({ failureType: set.failureType === "set" ? "exercise" : "set" })}
        >
          {FAILURE_LABELS[set.failureType]}
        </button>
        <button type="button" className="icon-button icon-button--small" onClick={onDelete} aria-label="删除这一组">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="set-row__fields">
        <label>
          <span>重量</span>
          <div>
            <input
              type="number"
              inputMode="decimal"
              value={set.weight}
              min={0}
              step={2.5}
              onChange={(event) => onUpdate({ weight: Math.max(0, safeNumber(event.target.value, set.weight)) })}
            />
            <small>kg</small>
          </div>
        </label>
        <label>
          <span>次数</span>
          <div>
            <input
              type="number"
              inputMode="numeric"
              value={set.reps}
              min={1}
              step={1}
              onChange={(event) =>
                onUpdate({ reps: Math.max(1, Math.round(safeNumber(event.target.value, set.reps))) })
              }
            />
            <small>次</small>
          </div>
        </label>
        <label>
          <span>休息</span>
          <div>
            <select
              value={set.restSeconds}
              onChange={(event) => onUpdate({ restSeconds: Number(event.target.value) })}
              aria-label="组间休息"
            >
              {[...new Set([45, ...REST_CHOICES, set.restSeconds])]
                .sort((a, b) => a - b)
                .map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds < 60 ? `${seconds}秒` : `${seconds / 60}分`}
                  </option>
                ))}
            </select>
          </div>
        </label>
      </div>
    </div>
  );
}
