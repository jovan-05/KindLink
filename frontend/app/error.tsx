"use client";

import { ErrorState } from "@/components/UtilityStates";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState body="This page hit an unexpected error. Your data is safe; try again." onRetry={reset} />;
}
