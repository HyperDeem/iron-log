import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Dumbbell,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ExercisePreset,
  ExerciseSetTemplate,
  FailureType,
  WorkoutSession,
  WorkoutSet,
} from "../types";
import {
  clamp,
  createWorkoutSet,
  EXERCISE_REST_SECONDS,
  FAILURE_LABELS,
  formatCompactNumber,
  formatDateLabel,
  formatNumber,
  getSessionStats,
  groupSets,
  REST_OPTIONS,
  safeNumber,
} from "../lib/workout";
import { RestTimer } from "./RestTimer";

interface RecordViewProps {
  exerciseOptions: ExercisePreset[];
  activeDate: string;
  session?: WorkoutSession;
  onDateChange: (date: string) => void;
  onAddSets: (date: string, title: string, sets: WorkoutSet[]) => void;
  onSaveExercisePreset: (preset: Omit<ExercisePreset, "updatedAt">) => void;
  onUpdateMeta: (date: string, patch: { title?: string; notes?: string }) => void;
  onUpdateSet: (date: string, setId: string, patch: Partial<WorkoutSet>) => void;
  onDeleteSet: (date: string, setId: string) => void;
  onDeleteGroup: (date: string, exercise: string) => void;
  onToast: (message: string) => void;
}

const REST_CHOICES = [45, ...REST_OPTIONS];

export function RecordView({
  activeDate,
  session,
  exerciseOptions,
  onDateChange,
  onAddSets,
  onSaveExercisePreset,
  onUpdateMeta,
  onUpdateSet,
  onDeleteSet,
  onDeleteGroup,
  onToast,
}: RecordViewProps) {
  const [title, setTitle] = useState(session?.title ?? "训练");
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState(40);
  const [reps, setReps] = useState(12);
  const [setCount, setSetCount] = useState(4);
  const [failureType, setFailureType] = useState<FailureType>("exercise");
  const [restSeconds, setRestSeconds] = useState(90);
  const [setTemplates, setSetTemplates] = useState<ExerciseSetTemplate[]>([]);
  const [previousReminder, setPreviousReminder] = useState("");
  const [nextNoteDraft, setNextNoteDraft] = useState("");
  const [completedSets, setCompletedSets] = useState(0);
  const [timerSignal, setTimerSignal] = useState(0);
  const [exerciseFocusSignal, setExerciseFocusSignal] = useState(0);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const stats = session ? getSessionStats(session) : { sessionCount: 0, setCount: 0, totalVolume: 0, totalReps: 0 };
  const groups = useMemo(() => groupSets(session?.sets ?? []), [session?.sets]);
  const plannedSetCount = clamp(Math.round(setCount), 1, 20);
  const isExerciseComplete = completedSets >= plannedSetCount;
  const timerDuration = isExerciseComplete ? EXERCISE_REST_SECONDS : restSeconds;
  const timerLabel = isExerciseComplete ? "动作间休息" : "组间休息";

  useEffect(() => {
    setTitle(session?.title ?? "训练");
    setExercise("");
    setSetTemplates([]);
    setPreviousReminder("");
    setNextNoteDraft("");
    setCompletedSets(0);
    setExpandedGroup(null);
  }, [activeDate]);

  const currentPreset = (noteOverride?: string): Omit<ExercisePreset, "updatedAt"> => {
    const templates = ensureSetTemplates(setTemplates, plannedSetCount, { weight, reps });
    const reminder =
      noteOverride ??
      (completedSets === 0 && previousReminder && !nextNoteDraft ? previousReminder : nextNoteDraft.trim());
    return {
      name: exercise.trim(),
      setCount: plannedSetCount,
      failureType,
      restSeconds,
      weight: Math.max(0, weight),
      reps: Math.max(1, Math.round(reps)),
      sets: templates,
      nextNote: reminder,
    };
  };

  const handleExerciseNameChange = (name: string) => {
    setExercise(name);
    setSetTemplates([]);
    setPreviousReminder("");
    setNextNoteDraft("");
    setCompletedSets(0);
  };

  const handleExerciseBlur = () => {
    if (exercise.trim()) onSaveExercisePreset(currentPreset());
  };

  const applyExercisePreset = (preset: ExercisePreset) => {
    const templates = ensureSetTemplates(preset.sets, preset.setCount, {
      weight: preset.weight,
      reps: preset.reps,
    });
    const firstTemplate = templates[0] ?? { weight: preset.weight, reps: preset.reps };
    setExercise(preset.name);
    setSetCount(clamp(Math.round(preset.setCount), 1, 20));
    setFailureType(preset.failureType);
    setRestSeconds(preset.restSeconds);
    setSetTemplates(templates);
    setWeight(Math.max(0, firstTemplate.weight));
    setReps(Math.max(1, Math.round(firstTemplate.reps)));
    setPreviousReminder(preset.nextNote);
    setNextNoteDraft("");
    setCompletedSets(0);
    setShowNotes(false);
  };

  const handleAddSet = () => {
    const cleanExercise = exercise.trim();
    if (!cleanExercise) {
      onToast("先选择或输入训练项目");
      return;
    }
    if (isExerciseComplete) {
      onToast("本动作已达到目标组数");
      return;
    }

    const nextCompleted = completedSets + 1;
    const isLastSet = nextCompleted >= plannedSetCount;
    const updatedTemplates = ensureSetTemplates(setTemplates, plannedSetCount, { weight, reps });
    updatedTemplates[completedSets] = {
      weight: Math.max(0, weight),
      reps: Math.max(1, Math.round(reps)),
    };
    const currentSet = createWorkoutSet(
      cleanExercise,
      Math.max(0, weight),
      Math.max(1, Math.round(reps)),
      failureType,
      isLastSet ? EXERCISE_REST_SECONDS : restSeconds,
    );

    onAddSets(activeDate, title, [currentSet]);
    onSaveExercisePreset({
      ...currentPreset(nextNoteDraft.trim()),
      sets: updatedTemplates,
    });
    setSetTemplates(updatedTemplates);
    if (completedSets === 0) setPreviousReminder("");
    setCompletedSets(nextCompleted);
    setTimerSignal((value) => value + 1);
    setShowNotes(false);

    if (!isLastSet) {
      const nextTemplate = updatedTemplates[nextCompleted] ?? {
        weight: Math.max(0, weight),
        reps: Math.max(1, Math.round(reps)),
      };
      setWeight(Math.max(0, nextTemplate.weight));
      setReps(Math.max(1, Math.round(nextTemplate.reps)));
    }

    if (isLastSet) {
      onToast(`已完成 ${nextCompleted}/${plannedSetCount} 组，开始 5 分钟动作间休息`);
    } else {
      onToast(`已记录第 ${nextCompleted} 组，开始组间休息`);
    }
  };

  const moveToNextExercise = () => {
    setExercise("");
    setSetTemplates([]);
    setPreviousReminder("");
    setNextNoteDraft("");
    setCompletedSets(0);
    setShowNotes(false);
    setExerciseFocusSignal((value) => value + 1);
    onToast("请选择下个动作");
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
            <span className="eyebrow">EXERCISE PLAN</span>
            <h2>动作计划</h2>
          </div>
          <Dumbbell size={22} />
        </div>

        <label className="field">
          <span>训练项目</span>
          <ExerciseCombobox
            value={exercise}
            options={exerciseOptions}
            focusSignal={exerciseFocusSignal}
            onChange={handleExerciseNameChange}
            onSelect={applyExercisePreset}
            onBlur={handleExerciseBlur}
          />
        </label>

        <div className="plan-section">
          <div className="plan-set-count-row">
            <span />
            <div className="plan-stepper">
              <NumberStepper
                label="本次组数"
                value={plannedSetCount}
                unit="组"
                step={1}
                minimum={1}
                maximum={20}
                onChange={(value) => {
                  setSetCount(value);
                  setSetTemplates((current) =>
                    ensureSetTemplates(current, clamp(Math.round(value), 1, 20), { weight, reps }),
                  );
                  if (completedSets > value) setCompletedSets(0);
                }}
              />
            </div>
            <span className="plan-progress">
              {completedSets}/{plannedSetCount} 组
            </span>
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
                  {formatRestLabel(seconds)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="current-set-section">
          <div className="subsection-heading">
            <span className="current-set-heading">
              <strong>本次这一组</strong>
              {previousReminder && completedSets === 0 && (
                <em>上次说{formatReminder(previousReminder)}！</em>
              )}
            </span>
            <span className={`set-number ${isExerciseComplete ? "is-complete" : ""}`}>
              {isExerciseComplete ? "已完成" : `第 ${completedSets + 1} 组`}
            </span>
          </div>

          <div className="stepper-grid stepper-grid--two">
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
              label="这一组次数"
              value={reps}
              unit="次"
              step={1}
              minimum={1}
              maximum={100}
              onChange={setReps}
            />
          </div>

          <div className="set-progress" aria-label={`已完成 ${completedSets} 组，共 ${plannedSetCount} 组`}>
            {Array.from({ length: plannedSetCount }, (_, index) => (
              <span
                key={index}
                className={index < completedSets ? "is-done" : index === completedSets ? "is-current" : ""}
              />
            ))}
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={handleAddSet}
            disabled={isExerciseComplete}
          >
            <Plus size={20} />
            {isExerciseComplete ? "本动作已完成" : `添加第 ${completedSets + 1} 组`}
          </button>

          {isExerciseComplete && (
            <button type="button" className="next-exercise-button" onClick={moveToNextExercise}>
              下个动作
              <ArrowRight size={16} />
            </button>
          )}
        </div>

        <button type="button" className="notes-toggle" onClick={() => setShowNotes((value) => !value)}>
          <span>
            训练备注
            {nextNoteDraft && <em>{nextNoteDraft}</em>}
          </span>
          <ChevronDown size={17} className={showNotes ? "is-open" : ""} />
        </button>
        {showNotes && (
          <>
            <div className="note-shortcuts">
              <button
                type="button"
                onClick={() => {
                  setNextNoteDraft("下次加重");
                  onSaveExercisePreset(currentPreset("下次加重"));
                }}
              >
                下次加重
              </button>
            </div>
            <textarea
              className="notes-input"
              value={nextNoteDraft}
              onChange={(event) => setNextNoteDraft(event.target.value)}
              onBlur={() => onSaveExercisePreset(currentPreset())}
              placeholder="这个动作下次的提醒"
              rows={3}
            />
          </>
        )}
      </section>

      <RestTimer
        duration={timerDuration}
        startSignal={timerSignal}
        label={timerLabel}
      />

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
            <span>从上面完成一组后，记录会立即保存在本机。</span>
          </div>
        ) : (
          <div className="exercise-groups">
            {groups.map((group) => {
              const volume = group.sets.reduce((total, set) => total + set.weight * set.reps, 0);
              const uniqueWeights = [...new Set(group.sets.map((set) => set.weight))];
              const weightLabel =
                uniqueWeights.length === 1
                  ? `${formatNumber(uniqueWeights[0])}kg`
                  : `${uniqueWeights.map((weight) => formatNumber(weight)).join("/")}kg`;
              const repsLabel = group.sets.map((set) => set.reps).join("/");
              const isExpanded = expandedGroup === group.exercise;
              return (
                <section className="exercise-group" key={group.exercise}>
                  <header className="exercise-group__header">
                    <button
                      type="button"
                      className="exercise-group__summary"
                      onClick={() => setExpandedGroup(isExpanded ? null : group.exercise)}
                      aria-expanded={isExpanded}
                    >
                      <span className="exercise-group__title">
                        <strong>{group.exercise}</strong>
                        <small>
                          {group.sets.length} 组 · {formatNumber(volume, 0)} kg
                        </small>
                      </span>
                      <span className="exercise-group__thumbnail">
                        <span>重量 {weightLabel}</span>
                        <span>次数 {repsLabel}</span>
                      </span>
                      <ChevronDown size={18} className={isExpanded ? "is-open" : ""} />
                    </button>
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

                  {isExpanded && (
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
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

interface ExerciseComboboxProps {
  value: string;
  options: ExercisePreset[];
  focusSignal: number;
  onChange: (value: string) => void;
  onSelect: (preset: ExercisePreset) => void;
  onBlur: () => void;
}

function ExerciseCombobox({
  value,
  options,
  focusSignal,
  onChange,
  onSelect,
  onBlur,
}: ExerciseComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options
    .filter((option) => !normalizedQuery || option.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 8);

  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, []);

  useEffect(() => {
    if (focusSignal === 0) return;
    setQuery("");
    setIsOpen(true);
    inputRef.current?.focus();
    wrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusSignal]);

  return (
    <div className="exercise-combobox" ref={wrapperRef}>
      <div className="exercise-combobox__control">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="exercise-options"
          value={value}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(event.target.value);
          }}
          onFocus={() => {
            setQuery("");
            setIsOpen(true);
          }}
          onBlur={onBlur}
          placeholder="例如：哑铃卧推"
          autoComplete="off"
        />
        <button
          type="button"
          aria-label="展开训练项目列表"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            setQuery("");
            setIsOpen((current) => !current);
          }}
        >
          <ChevronDown size={18} className={isOpen ? "is-open" : ""} />
        </button>
      </div>

      {isOpen && (
        <div className="exercise-combobox__menu" id="exercise-options" role="listbox">
          {filteredOptions.length === 0 ? (
            <div className="exercise-combobox__empty">输入新名称并完成一组后会自动记住</div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.name}
                type="button"
                role="option"
                aria-selected={option.name === value}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(option);
                  setQuery("");
                  setIsOpen(false);
                }}
              >
                <span>
                  <strong>{option.name}</strong>
                  <small>
                    {option.setCount}组 · {formatNumber(option.weight)}kg × {option.reps} ·{" "}
                    {formatRestLabel(option.restSeconds)} · {FAILURE_LABELS[option.failureType]}
                  </small>
                </span>
                {option.name === value && <Check size={17} />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
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
              {[...new Set([45, ...REST_CHOICES, EXERCISE_REST_SECONDS, set.restSeconds])]
                .sort((a, b) => a - b)
                .map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {formatRestLabel(seconds)}
                  </option>
                ))}
            </select>
          </div>
        </label>
      </div>
    </div>
  );
}

function formatRestLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds % 60 === 0) return `${seconds / 60}分`;
  if (seconds % 60 === 30) return `${Math.floor(seconds / 60)}.5分`;
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
}

function ensureSetTemplates(
  templates: ExerciseSetTemplate[],
  setCount: number,
  fallback: ExerciseSetTemplate,
): ExerciseSetTemplate[] {
  const count = clamp(Math.round(setCount), 1, 20);
  const next = templates.slice(0, count).map((template) => ({ ...template }));
  while (next.length < count) {
    next.push({ ...(next.at(-1) ?? fallback) });
  }
  return next;
}

function formatReminder(note: string): string {
  const trimmed = note.trim();
  return trimmed.startsWith("下次") ? trimmed.replace(/^下次/, "这次") : trimmed;
}
