import type { Evidence, Pick, Plan, Section } from "@/lib/types";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export const fmt = (v: number | null | undefined) => (v == null ? "n/a" : v.toFixed(2));

/** The headline Qloo value for a pick (CLAUDE.md rule 3), e.g. "affinity 0.94". */
export function evidenceLabel(ev: Evidence) {
  if (ev.basis === "heatmap") return `heatmap affinity ${fmt(ev.affinity)}`;
  if (ev.basis === "popularity") return `popularity ${fmt(ev.popularity)}`;
  return `affinity ${fmt(ev.affinity)}`;
}

export function reasonFor(plan: Plan, p: Pick) {
  return plan.plan.reasons[p.id] || p.reason || "";
}

export function EvidencePill({ ev, prefix, className }: { ev: Evidence; prefix?: string; className?: string }) {
  const label = evidenceLabel(ev);
  return (
    <span
      title={`Qloo signal: ${ev.signal}`}
      className={cx(
        "inline-block text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded whitespace-nowrap",
        className,
      )}
    >
      {prefix ? `${prefix} ${label.replace(/^affinity /, "")}` : label}
    </span>
  );
}

/** Small mono line with the Qloo signal behind a pick. */
export function SignalLine({ ev }: { ev: Evidence }) {
  return (
    <div className="text-[11px] text-stone-500 font-mono leading-relaxed">
      <span className="text-stone-400">signal:</span> {ev.signal}
      {ev.basis === "affinity" && ev.popularity != null && <> · popularity {fmt(ev.popularity)}</>}
      {ev.quality === "saturated" && <> · affinity maxed, ranked by popularity</>}
    </div>
  );
}

/** Shown instead of a section's content when Qloo returned too little (CLAUDE.md rule 6). */
export function NotEnoughData({ title, section }: { title: string; section?: Section }) {
  return (
    <div className="bg-stone-50 rounded-2xl border border-dashed border-stone-300 p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-stone-700">{title}</h3>
        <span className="text-[10px] font-mono uppercase bg-stone-200/80 text-stone-600 px-2 py-0.5 rounded">
          {section?.status === "failed" ? "Unavailable" : "Not Enough Data"}
        </span>
      </div>
      <p className="text-xs text-stone-600 leading-relaxed mt-2">
        {section?.note || "Qloo didn't return enough ranked results for this section."}{" "}
        <span className="font-semibold text-stone-800">KindLink leaves this empty rather than guess.</span>
      </p>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <div className={cx("rounded-full border-2 border-amber-700 border-t-transparent animate-spin", className)} />;
}
