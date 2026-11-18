import type { ReactNode } from "react";
import { classify } from "./bp";

export function StageChip({ sys, dia }: { sys: number; dia: number }) {
  const s = classify(sys, dia);
  return (
    <span className="chip" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

export function Seg<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
