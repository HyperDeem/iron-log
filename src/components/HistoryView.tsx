import { CalendarDays, ChevronDown, Download, FilePenLine, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { WorkoutSession, WorkoutStats } from "../types";
import {
  FAILURE_LABELS,
  formatCompactDate,
  formatDateLabel,
  formatNumber,
  getOverallStats,
  getSessionStats,
  groupSets,
} from "../lib/workout";

interface HistoryViewProps {
  sessions: WorkoutSession[];
  onEditDate: (date: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onExport: () => void;
}

export function HistoryView({ sessions, onEditDate, onDeleteSession, onExport }: HistoryViewProps) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(sessions[0]?.id ?? null);
  const stats = useMemo(() => getOverallStats(sessions), [sessions]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return sessions;
    return sessions.filter(
      (session) =>
        session.title.toLowerCase().includes(keyword) ||
        session.date.includes(keyword) ||
        session.sets.some((set) => set.exercise.toLowerCase().includes(keyword)),
    );
  }, [query, sessions]);

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

      <StatsSummary stats={stats} />

      <label className="search-control">
        <span>搜索</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="日期、训练名称或动作"
        />
      </label>

      {filtered.length === 0 ? (
        <div className="empty-state empty-state--spacious">
          <CalendarDays size={30} />
          <strong>{sessions.length === 0 ? "还没有训练历史" : "没有匹配的记录"}</strong>
          <span>{sessions.length === 0 ? "完成一次记录后，这里会按日期汇总。" : "换一个关键词再试。"}</span>
        </div>
      ) : (
        <div className="history-list">
          {filtered.map((session) => {
            const sessionStats = getSessionStats(session);
            const isExpanded = expandedId === session.id;
            const groups = groupSets(session.sets);
            return (
              <article className="history-session" key={session.id}>
                <button
                  type="button"
                  className="history-session__summary"
                  onClick={() => setExpandedId(isExpanded ? null : session.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="history-session__date">
                    <strong>{formatDateLabel(session.date, { month: "2-digit", day: "2-digit" })}</strong>
                    <span>{formatCompactDate(session.date)}</span>
                  </div>
                  <div className="history-session__main">
                    <strong>{session.title || "训练"}</strong>
                    <span>
                      {groups.length} 个动作 · {sessionStats.setCount} 组 · {formatNumber(sessionStats.totalVolume, 0)} kg
                    </span>
                  </div>
                  <ChevronDown size={19} className={isExpanded ? "is-open" : ""} />
                </button>

                {isExpanded && (
                  <div className="history-session__details">
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
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

function StatsSummary({ stats }: { stats: WorkoutStats }) {
  return (
    <section className="history-stats" aria-label="累计训练数据">
      <div>
        <span>训练次数</span>
        <strong>{stats.sessionCount}</strong>
      </div>
      <div>
        <span>总组数</span>
        <strong>{stats.setCount}</strong>
      </div>
      <div>
        <span>总容量</span>
        <strong>
          {formatNumber(stats.totalVolume, 0)}
          <small>kg</small>
        </strong>
      </div>
    </section>
  );
}
