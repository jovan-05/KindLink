"use client";

import { AlertOctagon, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import type { Plan } from "@/lib/types";
import { EvidencePill, reasonFor } from "./ui";

const ROWS: { key: "venues" | "performers" | "sponsors" | "promotion"; title: string; subtitle: string }[] = [
  { key: "venues", title: "Venues (Where to host)", subtitle: "Finding a venue that matches supporter habits and budget" },
  { key: "performers", title: "Performers (Who to book)", subtitle: "Talent your supporters actually listen to" },
  { key: "sponsors", title: "Sponsors (Who to ask)", subtitle: "Businesses with genuine customer overlap" },
  { key: "promotion", title: "Promotion (Where to spread the word)", subtitle: "Media your supporters already follow" },
];

export default function GenericVsKindLink({ plan, onOpenPlanTab }: { plan: Plan; onOpenPlanTab: () => void }) {
  const base = plan.baseline;
  const gaps = ROWS.filter(({ key }) => (plan.sections[key]?.items ?? []).length === 0);

  return (
    <div className="space-y-10">
      <div className="bg-stone-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-300 mb-1.5">
          Controlled Experiment & Side-by-Side Audit
        </div>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
          Same inputs. One plan used taste data (Qloo). The other had none.
        </h2>
        <p className="text-stone-300 text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
          On the left, an AI model with no data, as you&apos;d get from a chatbot: its picks are unverified and may not exist, may
          have closed, or may not fit your audience. On the right, KindLink: every pick was ranked by Qloo against your
          supporters&apos; tastes, and the AI could only use those names.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 mb-2">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>Generic AI Plan</span>
          </div>
          {base.status === "ok" ? (
            <>
              <h3 className="text-lg font-serif font-bold text-stone-800">{base.event_name}</h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">{base.concept}</p>
            </>
          ) : (
            <p className="text-xs text-stone-500">{base.note ?? "The generic plan could not be generated."}</p>
          )}
        </div>
        <div className="bg-amber-50/20 rounded-2xl border border-amber-200/80 p-6 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>KindLink (Qloo-Backed)</span>
          </div>
          <h3 className="text-lg font-serif font-bold text-stone-900">{plan.plan.event_name}</h3>
          <p className="text-xs text-stone-600 mt-1 leading-relaxed">{plan.plan.concept}</p>
        </div>
      </div>

      <div className="space-y-6">
        {ROWS.map(({ key, title, subtitle }, idx) => {
          const ours = plan.sections[key]?.items ?? [];
          const theirs = base[key] ?? [];
          return (
            <div key={key} className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
              <div className="bg-stone-50 px-6 py-3.5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-mono text-stone-400 mr-2">0{idx + 1}.</span>
                  <span className="text-sm font-bold text-stone-900 font-serif">{title}</span>
                </div>
                <span className="text-xs text-stone-500">{subtitle}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200">
                <div className="p-6 bg-stone-50/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>Generic AI Output</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold uppercase text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                        no data · unverified
                      </span>
                    </div>
                    {theirs.length ? (
                      <ul className="space-y-3">
                        {theirs.map((b, i) => (
                          <li key={i}>
                            <h4 className="text-sm font-bold text-stone-800 leading-snug">{b.name}</h4>
                            {b.reason && <p className="text-xs text-stone-500 mt-0.5">{b.reason}</p>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-stone-500">No suggestions.</p>
                    )}
                  </div>
                  <div className="mt-6 pt-3 border-t border-stone-200/60 text-[11px] text-stone-400 font-mono flex items-center gap-1">
                    <span>Audit Verdict:</span>
                    <span className="text-rose-700 font-bold">No evidence any of these fit</span>
                  </div>
                </div>

                <div className="p-6 bg-amber-50/20 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>KindLink (Qloo-Backed)</span>
                      </div>
                    </div>
                    {ours.length ? (
                      <ul className="space-y-3">
                        {ours.map((p) => (
                          <li key={p.id}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <h4 className="text-sm font-bold text-stone-900 leading-snug">{p.name}</h4>
                              <EvidencePill ev={p.evidence} className="text-[10px]" />
                            </div>
                            {reasonFor(plan, p) && <p className="text-xs text-stone-600 mt-0.5">{reasonFor(plan, p)}</p>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-amber-900">Not enough data. KindLink leaves this empty rather than guess.</p>
                    )}
                  </div>
                  <div className="mt-6 pt-3 border-t border-amber-200/60 text-[11px] text-emerald-800 font-mono flex items-center justify-between gap-2">
                    <span className="font-medium">Evidence verified against Qloo</span>
                    <span className="font-bold">✓ Ready to execute</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {gaps.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-stone-200 overflow-hidden shadow-xs">
          <div className="bg-stone-100/70 px-6 py-4 border-b border-stone-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-amber-800" />
              <h3 className="text-sm font-bold text-stone-900 font-serif">When the data runs out</h3>
            </div>
            <span className="text-xs font-mono font-bold text-stone-600">Not enough data</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200">
            <div className="p-6 bg-rose-50/20 space-y-3">
              <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" /> Generic AI
              </span>
              <p className="text-xs text-rose-900">
                Fills {gaps.map((g) => g.key).join(", ")} with names anyway, with nothing to show they exist or fit your audience.
              </p>
            </div>
            <div className="p-6 bg-stone-50/80 space-y-3">
              <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" /> KindLink Protocol
              </span>
              <p className="text-xs text-stone-600 leading-relaxed">
                Qloo didn&apos;t return enough ranked results for {gaps.map((g) => g.key).join(", ")}, so KindLink leaves it empty
                rather than guess.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 bg-amber-50/60 rounded-xl border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-stone-900">Ready to explore your complete evidence-backed plan?</h4>
          <p className="text-xs text-stone-600 mt-0.5">
            View the venue map, performer tiers, and the printable sponsor pitch letter.
            {base.model && <> Generic plan model: {base.model}, generated with no Qloo data.</>}
          </p>
        </div>
        <button
          onClick={onOpenPlanTab}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded-lg shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
        >
          <span>Return to &quot;The Plan&quot;</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
