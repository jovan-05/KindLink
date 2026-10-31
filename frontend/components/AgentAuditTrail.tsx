"use client";

import { ChevronDown, ChevronUp, Filter, ShieldCheck, Terminal } from "lucide-react";
import { useState } from "react";
import type { Pick, Plan } from "@/lib/types";
import { StepStatusIcon } from "./AgentProgress";
import { cx, fmt } from "./ui";

/** Lines about switching, dropping or removing get an accent so they stand out. */
function DecisionLine({ text }: { text: string }) {
  const pivotal = /^(Switched|Removed|Dropped|Tested .*ignored)/.test(text) || text.includes("Dropped.");
  const good = /^(Kept|Verified|All \d+ picks)/.test(text);
  return (
    <li className={cx("flex items-start gap-2 leading-relaxed", pivotal ? "text-rose-700" : good ? "text-emerald-700" : "text-stone-700")}>
      <span className="text-stone-400 shrink-0">&gt;</span>
      <span>{text}</span>
    </li>
  );
}

export default function AgentAuditTrail({ plan }: { plan: Plan }) {
  const log = plan.agent_log ?? [];
  const [expanded, setExpanded] = useState<string[]>(["tags", "verify"]);

  if (!log.length) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-xs text-sm text-stone-600">
        This plan was created before the agent log was recorded. Run a new plan to see each decision.
      </div>
    );
  }

  const notes = log.flatMap((s) => s.notes);
  const tested = notes.filter((n) => n.startsWith("Tested ")).length;
  const corrections = notes.filter((n) => /^(Switched|Dropped)|Dropped\.$|^Removed/.test(n)).length;
  const g = plan.grounding;

  const allPicks: Pick[] = Object.values(plan.sections).flatMap((s) => s.items);
  const byName = new Map(allPicks.map((p) => [p.name.toLowerCase(), p]));

  const toggle = (id: string) => setExpanded((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-amber-800" />
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">How the agent decided</h2>
          </div>
          <p className="text-stone-600 text-xs sm:text-sm mt-1 max-w-2xl">
            A transparent audit trail of every query, self-correction, and Qloo entity verification. KindLink tests its own
            choices against live Qloo rankings and drops what Qloo can&apos;t back up.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-stone-500">
            <span>{log.length} steps</span>
            {tested > 0 && <span className="text-amber-900">{tested} taste tags tested live</span>}
            {corrections > 0 && <span className="text-amber-900">{corrections} self-corrections</span>}
            {g.verified && <span className="text-emerald-700">{g.verified.length} names verified</span>}
            <span className={g.removed.length ? "text-rose-700" : "text-emerald-700"}>{g.removed.length} removed</span>
            <span>{plan.meta.seconds}s</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded(log.map((s) => s.step))}
            className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors cursor-pointer"
          >
            Expand All
          </button>
          <button
            onClick={() => setExpanded([])}
            className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors cursor-pointer"
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs divide-y divide-stone-100">
        {log.map((step, idx) => {
          const isExpanded = expanded.includes(step.step);
          const isLimited = step.status === "thin";
          const section = plan.sections[step.step as keyof Plan["sections"]];
          const isVerify = step.step === "verify";

          return (
            <div key={step.step} className="transition-colors">
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => toggle(step.step)}
                className="w-full p-4 sm:px-6 sm:py-4.5 flex items-center justify-between gap-4 text-left hover:bg-stone-50/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="shrink-0">
                    <StepStatusIcon status={step.status} index={idx} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-stone-400">{String(idx + 1).padStart(2, "0")}.</span>
                      <h3 className="text-sm font-bold text-stone-900 truncate">{step.label}</h3>
                      {isLimited && (
                        <span className="text-[10px] font-mono uppercase bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-semibold shrink-0">
                          Limited Data Note
                        </span>
                      )}
                    </div>
                    {step.message && <p className="text-xs text-stone-500 mt-0.5 truncate max-w-xl">{step.message}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {step.notes.length > 0 && <span className="text-xs font-mono text-stone-500 font-medium">{step.notes.length} notes</span>}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 pt-2 bg-stone-50/50 border-t border-stone-100 text-xs text-stone-700 space-y-4 font-mono">
                  {step.message && (
                    <div className="p-3 bg-stone-900 text-amber-200 rounded-lg text-xs leading-relaxed overflow-x-auto">&gt; {step.message}</div>
                  )}

                  {section && (
                    <div className="p-3.5 bg-white border border-stone-200 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 font-sans font-bold text-stone-900 text-xs">
                        <Filter className="w-3.5 h-3.5 text-amber-800" />
                        <span>Candidate Funnel:</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                        <span className="text-emerald-700">
                          Kept for Plan: <strong>{section.items.length}</strong>
                        </span>
                        <span>·</span>
                        <span className="text-stone-600">
                          Signal: <strong className="text-stone-900">{section.signal || "n/a"}</strong>
                        </span>
                      </div>
                      {section.note && (
                        <p className="text-[11px] text-stone-600 font-sans mt-1.5 pt-2 border-t border-stone-100 leading-relaxed">
                          <span className="font-semibold text-stone-800">Filter Rationale: </span>
                          {section.note}
                        </p>
                      )}
                    </div>
                  )}

                  {step.notes.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5">Decisions:</div>
                      <ul className="space-y-1 text-[11px]">
                        {step.notes.map((n, j) => (
                          <DecisionLine key={j} text={n} />
                        ))}
                      </ul>
                    </div>
                  )}

                  {isVerify && (g.verified?.length || g.removed.length) ? (
                    <div className="mt-3">
                      <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Qloo Entity Resolution & Verification Status:</span>
                      </div>
                      <div className="overflow-x-auto border border-stone-200 rounded-lg bg-white">
                        <table className="min-w-full divide-y divide-stone-200 text-left text-xs font-mono">
                          <thead className="bg-stone-100/70 text-stone-600">
                            <tr>
                              <th className="px-3.5 py-2 font-semibold">Entity Name</th>
                              <th className="px-3.5 py-2 font-semibold">Qloo Entity ID</th>
                              <th className="px-3.5 py-2 font-semibold">Status</th>
                              <th className="px-3.5 py-2 font-semibold text-right">Affinity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {(g.verified ?? []).map((name) => {
                              const p = byName.get(name.toLowerCase());
                              return (
                                <tr key={`v-${name}`} className="hover:bg-stone-50">
                                  <td className="px-3.5 py-2 font-semibold text-stone-900 font-sans">{name}</td>
                                  <td className="px-3.5 py-2 text-stone-500 text-[11px]">{p?.id ?? "—"}</td>
                                  <td className="px-3.5 py-2">
                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-semibold">✓ Verified</span>
                                  </td>
                                  <td className="px-3.5 py-2 text-right font-bold text-stone-800">{p ? fmt(p.evidence.affinity) : "—"}</td>
                                </tr>
                              );
                            })}
                            {g.removed.map((r, i) => (
                              <tr key={`r-${i}`} className="hover:bg-stone-50">
                                <td className="px-3.5 py-2 font-semibold text-stone-500 font-sans line-through">{r.name}</td>
                                <td className="px-3.5 py-2 text-stone-400 text-[11px]">not in Qloo results ({r.field})</td>
                                <td className="px-3.5 py-2">
                                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[10px] font-semibold">✗ Removed</span>
                                </td>
                                <td className="px-3.5 py-2 text-right text-stone-400">—</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
