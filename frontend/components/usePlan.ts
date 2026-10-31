"use client";

import { useEffect, useState } from "react";
import { ApiError, getPlan } from "@/lib/api";
import type { Plan } from "@/lib/types";

export type PlanState = { status: "loading" } | { status: "ok"; plan: Plan } | { status: "missing" } | { status: "error"; message: string };

export function usePlan(id: string): [PlanState, () => void] {
  const [state, setState] = useState<PlanState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: "loading" });
    getPlan(id, ctrl.signal)
      .then((plan) => setState({ status: "ok", plan }))
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof ApiError && err.message === "not-found") setState({ status: "missing" });
        else setState({ status: "error", message: "We couldn't load this plan. Is the backend running?" });
      });
    return () => ctrl.abort();
  }, [id, attempt]);
  return [state, () => setAttempt((a) => a + 1)];
}
