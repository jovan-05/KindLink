"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import type { AgentLogEntry } from "@/lib/types";
import { cx } from "./ui";

export const STEP_ORDER: { step: string; label: string }[] = [
  { step: "understand", label: "Understanding your cause" },
  { step: "tags", label: "Finding and testing taste tags" },
  { step: "interests", label: "Matching supporter interests" },
  { step: "venues", label: "Scouting venues" },
  { step: "performers", label: "Finding performers" },
  { step: "sponsors", label: "Spotting local sponsors" },
  { step: "neighborhoods", label: "Mapping supporter neighborhoods" },
  { step: "promotion", label: "Planning promotion channels" },
  { step: "compose", label: "Writing your event plan" },
  { step: "verify", label: "Checking every name against Qloo" },
  { step: "baseline", label: "Drafting a generic AI plan for comparison" },
];

export function StepStatusIcon({ status, index }: { status?: AgentLogEntry["status"]; index: number }) {
  if (status === "done") return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
  if (status === "thin") return <AlertTriangle className="w-5 h-5 text-amber-600" />;
  if (status === "failed") return <XCircle className="w-5 h-5 text-rose-600" />;
  if (status === "running") return <div className="w-5 h-5 rounded-full border-2 border-amber-700 border-t-transparent animate-spin" />;
  return (
    <div className="w-5 h-5 rounded-full border border-stone-300 flex items-center justify-center text-[10px] text-stone-400 font-mono">
      {index + 1}
    </div>
  );
}

export default function AgentProgress({
  causeContext,
  replay = false,
  steps,
  readyId,
  failure,
  onCancel,
  onViewPlan,
}: {
  causeContext: string;
  /** True when playing back a cached example's recorded run rather than a live one. */
  replay?: boolean;
  steps: Record<string, AgentLogEntry>;
  readyId: string | null;
  failure: string | null;
  onCancel: () => void;
  onViewPlan: () => void;
}) {
  const completedCount = STEP_ORDER.filter(({ step }) => steps[step] && steps[step].status !== "running").length;
  const progressPercent = readyId ? 100 : Math.min(100, Math.round((completedCount / STEP_ORDER.length) * 100));

  return (
    <div className="min-h-[80vh] py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-100">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Qloo Cultural Taste Agent · {replay ? "Replaying Recorded Run" : "Live Execution"}
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
              Building your evidence-backed fundraiser
            </h1>
            <p className="text-stone-600 text-sm mt-1">
              Analyzing: <span className="font-medium text-stone-800">{causeContext}</span>
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-stone-600 mb-2">
            <span className="font-medium">
              Overall Progress: <span className="text-stone-900 font-bold">{progressPercent}%</span> ({completedCount} of{" "}
              {STEP_ORDER.length} steps completed)
            </span>
            <span className="text-stone-500 font-medium">Usually under a minute</span>
          </div>
          <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-700 transition-all duration-300 ease-out" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-stone-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-700"></span>
              Live taste graph correlation running against the Qloo Insights API
            </span>
          </div>
        </div>
      </div>

      {failure && (
        <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">That didn&apos;t work</div>
            <div className="mt-0.5">{failure}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs divide-y divide-stone-100" aria-live="polite">
        {STEP_ORDER.map(({ step, label }, idx) => {
          const s = steps[step];
          const status = s?.status;
          const isDone = status === "done";
          const isRunningStep = status === "running";
          const isLimited = status === "thin";
          const isFailed = status === "failed";
          const isWaiting = !s;

          return (
            <div
              key={step}
              className={cx(
                "p-4 sm:px-6 sm:py-4.5 transition-colors flex items-start gap-4",
                isRunningStep ? "bg-amber-50/50" : isLimited ? "bg-amber-50/20" : isFailed ? "bg-rose-50/30" : isDone ? "bg-white" : "bg-stone-50/40 opacity-70",
              )}
            >
              <div className="mt-0.5 shrink-0">
                <StepStatusIcon status={status} index={idx} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-stone-400">Step {String(idx + 1).padStart(2, "0")}</span>
                    <span className="text-stone-300">·</span>
                    <h3
                      className={cx(
                        "text-sm font-semibold",
                        isRunningStep ? "text-stone-900 font-bold" : isWaiting ? "text-stone-500" : "text-stone-800",
                      )}
                    >
                      {label}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {isDone && <span className="text-emerald-700 font-medium">Done</span>}
                    {isLimited && (
                      <span className="text-amber-800 font-medium bg-amber-100/70 px-2 py-0.5 rounded text-[11px]">Limited Data</span>
                    )}
                    {isFailed && (
                      <span className="text-rose-800 font-medium bg-rose-100/70 px-2 py-0.5 rounded text-[11px]">Unavailable</span>
                    )}
                    {isRunningStep && <span className="text-amber-800 font-medium animate-pulse">Running...</span>}
                    {isWaiting && <span className="text-stone-400">Waiting</span>}
                  </div>
                </div>

                {!isWaiting && s.message && (
                  <p
                    className={cx(
                      "text-xs mt-1.5 leading-relaxed",
                      isLimited ? "text-amber-900 font-medium" : isRunningStep ? "text-stone-700" : "text-stone-600",
                    )}
                  >
                    {s.message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button onClick={onCancel} className="text-xs font-medium text-stone-500 hover:text-stone-800 cursor-pointer">
          {failure ? "Return to form" : "Cancel and return to form"}
        </button>

        {readyId ? (
          <button
            onClick={onViewPlan}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <span>View Generated Plan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : !failure ? (
          <div className="text-xs text-stone-400 flex items-center gap-2">
            <span>Checking against verified taste records...</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
