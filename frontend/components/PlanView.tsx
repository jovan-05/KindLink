"use client";

import { History, Scale, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { Plan } from "@/lib/types";
import AgentAuditTrail from "./AgentAuditTrail";
import GenericVsKindLink from "./GenericVsKindLink";
import PlanOverview from "./PlanOverview";
import { cx } from "./ui";

type Tab = "plan" | "compare" | "agent";
const TABS: { key: Tab; label: string; icon: typeof Sparkles }[] = [
  { key: "plan", label: "The Plan", icon: Sparkles },
  { key: "compare", label: "Generic AI Plan vs KindLink", icon: Scale },
  { key: "agent", label: "How the Agent Decided", icon: History },
];

export default function PlanView({ plan }: { plan: Plan }) {
  const [tab, setTab] = useState<Tab>("plan");

  // #compare / #agent deep-link to those tabs.
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.slice(1);
      if (h === "compare" || h === "agent") setTab(h);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  function switchTab(next: Tab) {
    setTab(next);
    window.history.replaceState(null, "", next === "plan" ? window.location.pathname : `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="mb-8 border-b border-stone-200 no-print">
        <div role="tablist" className="flex flex-wrap items-center gap-1 sm:gap-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => switchTab(key)}
              className={cx(
                "px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2",
                tab === key ? "border-amber-800 text-stone-900 font-bold bg-white/40" : "border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300",
              )}
            >
              <Icon className={cx("w-4 h-4", tab === key ? "text-amber-800" : "text-stone-400")} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "plan" && <PlanOverview plan={plan} onOpenAgentLog={() => switchTab("agent")} />}
      {tab === "compare" && <GenericVsKindLink plan={plan} onOpenPlanTab={() => switchTab("plan")} />}
      {tab === "agent" && <AgentAuditTrail plan={plan} />}
    </div>
  );
}
