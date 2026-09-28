import { BarChart3, Database, Dumbbell } from "lucide-react";
import type { AppView } from "../types";

interface BottomNavProps {
  activeView: AppView;
  onChange: (view: AppView) => void;
}

const ITEMS: Array<{ id: AppView; label: string; icon: typeof Dumbbell }> = [
  { id: "record", label: "记录", icon: Dumbbell },
  { id: "history", label: "历史", icon: BarChart3 },
  { id: "data", label: "数据", icon: Database },
];

export function BottomNav({ activeView, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`bottom-nav__item ${activeView === id ? "is-active" : ""}`}
          onClick={() => onChange(id)}
          aria-current={activeView === id ? "page" : undefined}
        >
          <Icon size={21} strokeWidth={2.1} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
