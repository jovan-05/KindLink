"use client";

import { use } from "react";
import PlanView from "@/components/PlanView";
import { usePlan } from "@/components/usePlan";
import { ErrorState, LoadingState, NotFoundState } from "@/components/UtilityStates";

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, retry] = usePlan(id);
  if (state.status === "loading") return <LoadingState />;
  if (state.status === "missing") return <NotFoundState />;
  if (state.status === "error") return <ErrorState body={state.message} onRetry={retry} />;
  return <PlanView plan={state.plan} />;
}
