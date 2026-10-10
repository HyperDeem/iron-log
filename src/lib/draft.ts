import { useRef, useState, type Dispatch, type SetStateAction } from "react";

const PREFIX = "iron-log:draft:v1:";

// Write with each change so navigation or a reload cannot discard pending effects.
export function useDraftState<T>(date: string, field: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const key = `${PREFIX}${date}:${field}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });
  const currentValue = useRef(value);
  const update: Dispatch<SetStateAction<T>> = (next) => {
    const resolved = typeof next === "function" ? (next as (previous: T) => T)(currentValue.current) : next;
    currentValue.current = resolved;
    try {
      localStorage.setItem(key, JSON.stringify(resolved));
    } catch {
      // Keep the in-memory draft usable when browser storage is unavailable.
    }
    setValue(resolved);
  };
  return [value, update];
}

export function clearDrafts(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  }
}
