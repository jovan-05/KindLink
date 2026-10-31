"use client";

import { use } from "react";
import SponsorPitchLetter from "@/components/SponsorPitchLetter";
import { usePlan } from "@/components/usePlan";
import { ErrorState, LoadingState, NotFoundState } from "@/components/UtilityStates";

export default function PitchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, retry] = usePlan(id);
  if (state.status === "loading") return <LoadingState label="Loading pitch…" />;
  if (state.status === "missing") return <NotFoundState title="Pitch not found" body="This plan may have expired." />;
  if (state.status === "error") return <ErrorState body={state.message} onRetry={retry} />;
  return <SponsorPitchLetter plan={state.plan} />;
}
