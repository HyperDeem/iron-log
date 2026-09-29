import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatDuration } from "../lib/workout";

interface RestTimerProps {
  duration: number;
  startSignal: number;
  label: string;
}

export function RestTimer({ duration, startSignal, label }: RestTimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const endAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      setRemaining(duration);
    }
  }, [duration]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      const next = Math.max(0, Math.ceil(((endAtRef.current ?? Date.now()) - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        setIsRunning(false);
        navigator.vibrate?.([150, 80, 150]);
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (startSignal === 0) return;
    setRemaining(duration);
    endAtRef.current = Date.now() + duration * 1000;
    setIsRunning(true);
    // The duration is changed together with the start signal after adding sets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal]);

  const toggle = () => {
    if (isRunning) {
      setIsRunning(false);
      return;
    }

    const next = remaining > 0 ? remaining : duration;
    setRemaining(next);
    endAtRef.current = Date.now() + next * 1000;
    setIsRunning(true);
  };

  const reset = () => {
    setRemaining(duration);
    setIsRunning(false);
    endAtRef.current = null;
  };

  const progress = duration > 0 ? (remaining / duration) * 100 : 0;

  return (
    <section className={`rest-timer ${isRunning ? "is-running" : ""}`} aria-label={`${label}计时`}>
      <div className="rest-timer__bar" style={{ "--progress": `${progress}%` } as React.CSSProperties} />
      <div className="rest-timer__content">
        <div className="rest-timer__label">
          <Timer size={18} />
          <span>{label}</span>
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
