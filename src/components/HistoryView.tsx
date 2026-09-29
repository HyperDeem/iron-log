import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePenLine,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { WorkoutSession } from "../types";
import {
  FAILURE_LABELS,
  formatCompactDate,
  formatDateLabel,
  formatNumber,
  getSessionStats,
  groupSets,
  toDateKey,
} from "../lib/workout";

interface HistoryViewProps {
  sessions: WorkoutSession[];
  onEditDate: (date: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onExport: () => void;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function HistoryView({ sessions, onEditDate, onDeleteSession, onExport }: HistoryViewProps) {
  const [selectedDate, setSelectedDate] = useState(sessions[0]?.date ?? toDateKey());
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseDateKey(sessions[0]?.date ?? toDateKey())));
  const [query, setQuery] = useState("");
  const monthKey = toDateKey(visibleMonth).slice(0, 7);
  const sessionCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of sessions) counts.set(session.date, (counts.get(session.date) ?? 0) + 1);
    return counts;
  }, [sessions]);
  const monthSessions = useMemo(
    () => sessions.filter((session) => session.date.startsWith(monthKey)),
    [monthKey, sessions],
  );
  const selectedSession = sessions.find((session) => session.date === selectedDate);
  const filteredSessions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return [];
    return sessions.filter(
      (session) =>
        session.title.toLowerCase().includes(keyword) ||
        session.date.includes(keyword) ||
        session.sets.some((set) => set.exercise.toLowerCase().includes(keyword)),
    );
  }, [query, sessions]);

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setVisibleMonth(startOfMonth(parseDateKey(date)));
  };

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setVisibleMonth(nextMonth);
    const nextMonthKey = toDateKey(nextMonth).slice(0, 7);
    const firstTraining = sessions
      .filter((session) => session.date.startsWith(nextMonthKey))
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    setSelectedDate(firstTraining?.date ?? toDateKey(nextMonth));
  };

  return (
    <main className="view history-view">
      <section className="page-intro">
        <div>
          <span className="eyebrow">PROGRESS</span>
          <h1>训练历史</h1>
        </div>
        <button type="button" className="secondary-button" onClick={onExport} disabled={sessions.length === 0}>
          <Download size={18} />
          导出
        </button>
      </section>

      <section className="training-calendar">
        <header className="training-calendar__header">
          <button type="button" className="icon-button" onClick={() => changeMonth(-1)} aria-label="上个月">
            <ChevronLeft size={18} />
          </button>
          <div>
            <strong>{formatMonthLabel(visibleMonth)}</strong>
            <span>本月训练 {monthSessions.length} 次</span>
          </div>
          <button type="button" className="icon-button" onClick={() => changeMonth(1)} aria-label="下个月">
            <ChevronRight size={18} />
          </button>
        </header>

        <div className="training-calendar__weekdays" aria-hidden="true">
          {WEEKDAYS.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>

        <div className="training-calendar__grid">
          {buildCalendarDays(visibleMonth).map((date, index) => {
            if (!date) return <span key={`blank-${index}`} className="calendar-blank" />;
            const sessionCount = sessionCountByDate.get(date) ?? 0;
            const isSelected = date === selectedDate;
            const isToday = date === toDateKey();
            return (
              <button
                key={date}
                type="button"
                className={[
                  "calendar-day",
                  sessionCount > 0 ? "has-workout" : "",
                  isSelected ? "is-selected" : "",
                  isToday ? "is-today" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => selectDate(date)}
                aria-label={`${formatCompactDate(date)}${sessionCount > 0 ? `，有 ${sessionCount} 次训练` : ""}`}
                aria-pressed={isSelected}
              >
                <span>{Number(date.slice(-2))}</span>
                {sessionCount > 0 && <i />}
              </button>
            );
          })}
        </div>
        <div className="calendar-legend">
          <span>
            <i />
            使劲撸铁！
          </span>
          <span>
            <i className="is-selected" />
            当前查看
          </span>
        </div>
      </section>

      <label className="search-control">
        <span>搜索</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="日期、训练名称或动作"
        />
      </label>

      {query.trim() && (
        <section className="search-results">
          <div className="section-heading">
            <div>
              <span className="eyebrow">RESULTS</span>
              <h2>搜索结果</h2>
            </div>
            <span className="section-count">{filteredSessions.length} 条</span>
          </div>
          {filteredSessions.length === 0 ? (
            <div className="empty-state">
              <span>没有匹配的训练记录</span>
            </div>
          ) : (
            <div className="search-result-list">
              {filteredSessions.map((session) => {
                const stats = getSessionStats(session);
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => selectDate(session.date)}
                    className={session.date === selectedDate ? "is-selected" : ""}
                  >
                    <span>
                      <strong>{session.title || "训练"}</strong>
                      <small>{formatCompactDate(session.date)}</small>
                    </span>
                    <span>
                      {stats.setCount} 组 · {groupSets(session.sets).length} 个动作
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <SelectedDay
        date={selectedDate}
        session={selectedSession}
        onEditDate={onEditDate}
        onDeleteSession={onDeleteSession}
      />
    </main>
  );
}

interface SelectedDayProps {
  date: string;
  session?: WorkoutSession;
  onEditDate: (date: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

function SelectedDay({ date, session, onEditDate, onDeleteSession }: SelectedDayProps) {
  if (!session) {
    return (
      <section className="selected-day">
        <div className="selected-day__heading">
          <span className="eyebrow">SELECTED DAY</span>
          <h2>{formatDateLabel(date, { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</h2>
        </div>
        <div className="empty-state">
          <CalendarDays size={28} />
          <strong>当天没有训练记录</strong>
          <span>点击日历中高亮的日期查看已有记录。</span>
        </div>
      </section>
    );
  }

  const groups = groupSets(session.sets);

  return (
    <section className="selected-day">
      <header className="selected-day__heading">
        <div>
          <span className="eyebrow">SELECTED DAY</span>
          <h2>{formatDateLabel(session.date, { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</h2>
        </div>
      </header>

      <div className="selected-day__groups">
        {groups.map((group) => (
          <section className="history-group" key={group.exercise}>
            <header>
              <strong>{group.exercise}</strong>
              <span>{group.sets.length} 组</span>
            </header>
            <div className="history-set-list">
              {group.sets.map((set, index) => (
                <div key={set.id}>
                  <span>{index + 1}</span>
                  <strong>
                    {formatNumber(set.weight)} kg × {set.reps}
                  </strong>
                  <small>{FAILURE_LABELS[set.failureType]}</small>
                  <em>{set.restSeconds} 秒</em>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {session.notes && <p className="history-notes">{session.notes}</p>}

      <div className="history-session__actions">
        <button type="button" className="text-button" onClick={() => onEditDate(session.date)}>
          <FilePenLine size={16} />
          编辑当天记录
        </button>
        <button
          type="button"
          className="text-button text-button--danger"
          onClick={() => {
            if (window.confirm(`删除 ${formatCompactDate(session.date)} 的训练记录？`)) {
              onDeleteSession(session.id);
            }
          }}
        >
          <Trash2 size={16} />
          删除
        </button>
      </div>
    </section>
  );
}

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(date);
}

function buildCalendarDays(month: Date): Array<string | null> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<string | null> = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toDateKey(new Date(year, monthIndex, day, 12)));
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
