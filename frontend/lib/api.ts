// All calls go to /api/* on the same origin; next.config.ts proxies them to the FastAPI backend.
// The browser never sees a backend secret: the Qloo and OpenRouter keys live only in the backend.
import type { Example, Plan, PlanInput, StepEvent } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {}

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal, cache: "no-store" });
  if (res.status === 404) throw new ApiError("not-found");
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export const getPlan = (id: string, signal?: AbortSignal) =>
  getJSON<Plan>(`/api/plan/${encodeURIComponent(id)}`, signal);

export const getExamples = () => getJSON<Example[]>("/api/examples");

export const getMeta = () => getJSON<{ cities: string[]; budgets: string[] }>("/api/meta");

type StreamEvent = StepEvent | { type: "done"; id: string } | { type: "error"; message: string };

/** Starts a plan run and calls onStep for every streamed status line. Resolves with the plan id. */
export async function runPlan(
  input: PlanInput,
  onStep: (e: StepEvent) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${API}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (res.status === 422) throw new ApiError("Please check the form fields and try again.");
  if (!res.ok || !res.body) throw new ApiError(`Could not start the plan (${res.status}).`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line) as StreamEvent;
      if (ev.type === "step") onStep(ev);
      else if (ev.type === "done") return ev.id;
      else if (ev.type === "error") throw new ApiError(ev.message);
    }
  }
  throw new ApiError("The connection closed before the plan finished.");
}
