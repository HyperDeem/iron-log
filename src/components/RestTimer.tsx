import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDraftState } from "../lib/draft";
import { formatDuration } from "../lib/workout";

interface RestTimerProps {
  date: string;
  duration: number;
  startSignal: number;
  label: string;
}

interface TimerDraft {
  duration: number;
  label: string;
  remaining: number;
  endAt: number | null;
}

export function RestTimer({ date, duration, startSignal, label }: RestTimerProps) {
  const [timer, setTimer] = useDraftState<TimerDraft>(date, "timer", {
    duration, label, remaining: duration, endAt: null,
  });
  const [, tick] = useState(0);
  const lastSignal = useRef(startSignal);
  const isRunning = timer.endAt !== null && timer.endAt > Date.now();
  const remaining = timer.endAt === null
    ? timer.remaining
    : Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));

  useEffect(() => {
    if (timer.endAt === null) return;
    const update = () => {
      if (timer.endAt! <= Date.now()) {
        setTimer((current) => ({ ...current, remaining: 0, endAt: null }));
        navigator.vibrate?.([150, 80, 150]);
      } else {
        tick((value) => value + 1);
      }
    };
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [timer.endAt]);

  useEffect(() => {
    if (lastSignal.current !== startSignal) {
      lastSignal.current = startSignal;
      setTimer({ duration, label, remaining: duration, endAt: Date.now() + duration * 1000 });
      return;
    }
    // Plan changes must not relabel or reset an existing rest period.
    if (timer.endAt === null && timer.remaining === timer.duration) {
      setTimer({ duration, label, remaining: duration, endAt: null });
    }
  }, [startSignal, duration, label]);

  const toggle = () => {
    if (isRunning) {
      setTimer({ ...timer, remaining, endAt: null });
      return;
    }
    const next = remaining > 0 ? remaining : duration;
    setTimer({
      duration: remaining > 0 ? timer.duration : duration,
      label: remaining > 0 ? timer.label : label,
      remaining: next,
      endAt: Date.now() + next * 1000,
    });
  };

  const reset = () => {
    setTimer({ duration, label, remaining: duration, endAt: null });
  };

  const progress = timer.duration > 0 ? (remaining / timer.duration) * 100 : 0;

  return (
    <section className={`rest-timer ${isRunning ? "is-running" : ""}`} aria-label={`${timer.label}计时`}>
      <div className="rest-timer__bar" style={{ "--progress": `${progress}%` } as React.CSSProperties} />
      <div className="rest-timer__content">
        <div className="rest-timer__label">
          <Timer size={18} />
          <span>{timer.label}</span>
        </div>
        <strong>{formatDuration(remaining)}</strong>
        <div className="rest-timer__actions">
          <button type="button" className="icon-button" onClick={toggle} aria-label={isRunning ? "暂停" : "开始"}>
            {isRunning ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" className="icon-button" onClick={reset} aria-label="重置">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
