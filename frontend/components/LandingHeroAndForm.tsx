"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiError, getPlan, runPlan } from "@/lib/api";
import { fireCelebrationConfetti } from "@/lib/confetti";
import { CITIES, EXAMPLES } from "@/lib/examples";
import type { Budget, Plan, PlanInput, StepEvent } from "@/lib/types";
import AgentProgress from "./AgentProgress";
import { cx, evidenceLabel } from "./ui";

type Example = (typeof EXAMPLES)[number];

const BUDGETS: { value: Budget; label: string; hint: string }[] = [
  { value: "shoestring", label: "Shoestring", hint: "Donated space" },
  { value: "modest", label: "Modest", hint: "Some paid talent" },
  { value: "generous", label: "Generous", hint: "Full venue & acts" },
];

const fieldCls =
  "w-full px-4 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 transition-all text-stone-900 placeholder:text-stone-400";

function validate(cause: string, city: string, guests: number) {
  if (cause.trim().length < 10) return "Please describe your cause in at least a few words.";
  if (cause.length > 500) return "Please keep the cause description under 500 characters.";
  if (city.trim().length < 2) return "Please select a city.";
  if (!Number.isInteger(guests) || guests < 10 || guests > 5000) return "Please enter a guest count between 10 and 5,000.";
  return "";
}

/** Headline stat for a cached example plan, built only from its Qloo evidence. */
function exampleStat(plan: Plan | undefined, ex: Example) {
  if (!plan) return `${ex.input.guests} guests · ${ex.input.budget} budget`;
  const venues = plan.sections.venues?.items ?? [];
  const top = venues.find((v) => v.id === plan.plan.headline_venue_id) ?? venues[0];
  return top ? `Top venue ${evidenceLabel(top.evidence)} · ${ex.input.guests} guests` : `${ex.input.guests} guests`;
}

export default function LandingHeroAndForm() {
  const router = useRouter();
  const [activePreviewId, setActivePreviewId] = useState(EXAMPLES[0].id);
  const [examplePlans, setExamplePlans] = useState<Record<string, Plan>>({});

  const [cause, setCause] = useState(
    "An Austin foster network dedicated to rescuing, hospice care, and rehoming senior dogs (8+ years old) from municipal shelters.",
  );
  const [city, setCity] = useState("Austin");
  const [guests, setGuests] = useState<number>(150);
  const [month, setMonth] = useState("March");
  const [budget, setBudget] = useState<Budget>("modest");
  const [interestInput, setInterestInput] = useState("");
  const [interests, setInterests] = useState<string[]>(["indie folk", "craft beer", "Marley & Me"]);
  const [errorMsg, setErrorMsg] = useState("");

  const [running, setRunning] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<string, StepEvent>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [readyId, setReadyId] = useState<string | null>(null);
  const [openingExample, setOpeningExample] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // The example plans are pre-cached on the backend; load them so the previews show real plan data.
  useEffect(() => {
    const ctrl = new AbortController();
    EXAMPLES.forEach((ex) =>
      getPlan(ex.id, ctrl.signal)
        .then((p) => setExamplePlans((m) => ({ ...m, [ex.id]: p })))
        .catch(() => undefined),
    );
    return () => ctrl.abort();
  }, []);

  const activeEx = EXAMPLES.find((e) => e.id === activePreviewId) ?? EXAMPLES[0];
  const activePlan = examplePlans[activeEx.id];

  async function start(input: PlanInput, label: string) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSteps({});
    setFailure(null);
    setReadyId(null);
    setReplaying(false);
    setRunning(label);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const id = await runPlan(input, (ev) => setSteps((s) => ({ ...s, [ev.step]: ev })), ctrl.signal);
      setReadyId(id);
      fireCelebrationConfetti();
      // Leave the finished agent log (incl. the grounding check) on screen for a moment.
      await new Promise((r) => setTimeout(r, 1800));
      if (!ctrl.signal.aborted) router.push(`/plan/${id}`);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setFailure(err instanceof ApiError ? err.message : "We couldn't reach the planner. Please try again in a moment.");
    }
  }

  /** Plays back a cached plan's recorded agent log step by step, then opens the plan. */
  async function replay(plan: Plan, label: string) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSteps({});
    setFailure(null);
    setReadyId(null);
    setReplaying(true);
    setRunning(label);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (const entry of plan.agent_log ?? []) {
      if (ctrl.signal.aborted) return;
      setSteps((s) => ({ ...s, [entry.step]: { ...entry, type: "step", status: "running" } }));
      await wait(550);
      if (ctrl.signal.aborted) return;
      setSteps((s) => ({ ...s, [entry.step]: { ...entry, type: "step" } }));
      await wait(150);
    }
    if (ctrl.signal.aborted) return;
    setReadyId(plan.id);
    fireCelebrationConfetti();
    await wait(1200);
    if (!ctrl.signal.aborted) router.push(`/plan/${plan.id}`);
  }

  async function openExample(ex: Example) {
    if (running || openingExample) return;
    setActivePreviewId(ex.id);
    setOpeningExample(ex.id);
    let plan = examplePlans[ex.id];
    try {
      plan ??= await getPlan(ex.id); // pre-cached on the backend
    } catch {
      setOpeningExample(null);
      start(ex.input, `${ex.input.cause} · ${ex.city}`);
      return;
    }
    setOpeningExample(null);
    if (plan.agent_log?.length) replay(plan, `${ex.input.cause} · ${ex.city}`);
    else router.push(`/plan/${ex.id}`);
  }

  function cancelRun() {
    abortRef.current?.abort();
    setRunning(null);
    setFailure(null);
    setReadyId(null);
    setOpeningExample(null);
  }

  function addInterest(e: React.KeyboardEvent | React.MouseEvent) {
    if ("key" in e && e.key !== "Enter") return;
    e.preventDefault();
    const trimmed = interestInput.trim().slice(0, 60);
    if (trimmed && interests.length < 5 && !interests.includes(trimmed)) {
      setInterests([...interests, trimmed]);
      setInterestInput("");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate(cause, city, guests);
    setErrorMsg(err);
    if (err) return;
    start(
      { cause: cause.trim(), city: city.trim(), guests, budget, month: month.trim() || null, interests },
      `${cause.trim().slice(0, 48)}${cause.trim().length > 48 ? "..." : ""} · ${city.trim()}`,
    );
  }

  if (running) {
    return (
      <AgentProgress
        causeContext={running}
        replay={replaying}
        steps={steps}
        readyId={readyId}
        failure={failure}
        onCancel={cancelRun}
        onViewPlan={() => readyId && router.push(`/plan/${readyId}`)}
      />
    );
  }

  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden pt-10 sm:pt-16 pb-16 border-b border-stone-200/80 bg-gradient-to-b from-stone-50 via-amber-50/20 to-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-950 bg-amber-100/70 border border-amber-300/80 px-3 py-1 rounded-md">
                <ShieldCheck className="w-4 h-4 text-amber-800" />
                <span>Qloo Cultural & Taste Intelligence Engine</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold font-serif tracking-tight text-stone-900 leading-[1.08] text-balance">
                Design the fundraiser your supporters{" "}
                <span className="italic font-normal text-amber-900 underline decoration-amber-400/50 decoration-wavy decoration-2">
                  actually
                </span>{" "}
                want to attend.
              </h1>

              <p className="text-base sm:text-lg text-stone-600 leading-relaxed max-w-2xl">
                No more stiff hotel ballrooms or awkward silence. KindLink proves every choice with real taste data: venues
                people love, performers they listen to, and sponsors with genuine customer overlap. 100% evidence-backed.
              </p>

              <div id="try-examples-section" className="pt-2 scroll-mt-24">
                <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span>Try an example (hover to preview · click to load)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onMouseEnter={() => setActivePreviewId(ex.id)}
                      onFocus={() => setActivePreviewId(ex.id)}
                      onClick={() => openExample(ex)}
                      disabled={!!openingExample}
                      className={cx(
                        "p-3 text-xs rounded-xl border text-left transition-all cursor-pointer disabled:cursor-wait",
                        activePreviewId === ex.id
                          ? "bg-white border-amber-600 ring-2 ring-amber-500/20 shadow-md"
                          : "bg-white/80 hover:bg-white border-stone-200",
                      )}
                    >
                      <div className="font-bold text-stone-900 truncate">{ex.title}</div>
                      <div className="text-stone-500 text-[11px] mt-0.5">{ex.blurb}</div>
                      <div className="text-amber-900 font-semibold text-[10px] mt-1.5 flex items-center gap-1">
                        <span className="truncate">
                          {openingExample === ex.id ? "Opening plan…" : examplePlans[ex.id]?.plan.event_name ?? "Open the plan"}
                        </span>
                        <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-stone-600 pt-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="font-medium text-stone-800">
                  <strong>Zero guesswork:</strong> &quot;Nothing is invented. Every venue, artist, and sponsor comes from real
                  data.&quot;
                </span>
              </div>
            </div>

            {/* Editorial hero anchor with live preview */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-stone-300/80 bg-stone-950 aspect-4/3 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={activeEx.image}
                  src={activeEx.image}
                  alt={activeEx.title}
                  className="w-full h-full object-cover brightness-[0.88] contrast-[1.05] transition-all duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/30 to-transparent pointer-events-none" />

                <div className="absolute top-4 left-4 bg-stone-950/80 backdrop-blur-md border border-stone-700 text-amber-300 text-[11px] font-semibold px-3 py-1 rounded-md">
                  {activeEx.badge}
                </div>

                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="text-xs uppercase tracking-wider text-amber-300 font-mono font-semibold mb-1">{activeEx.subtitle}</div>
                  <div className="text-xl sm:text-2xl font-serif font-bold leading-tight">
                    {activePlan?.plan.event_name ?? activeEx.title}
                  </div>
                  <p className="text-xs text-stone-300 mt-1 line-clamp-1">{activePlan?.plan.tagline || activeEx.input.cause}</p>

                  <div className="mt-3 pt-2.5 border-t border-stone-700/80 flex items-center justify-between gap-3 text-xs">
                    <span className="text-emerald-400 font-mono font-semibold truncate">{exampleStat(activePlan, activeEx)}</span>
                    <button
                      type="button"
                      onClick={() => openExample(activeEx)}
                      className="text-white hover:text-amber-300 font-semibold underline text-xs cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <span>Explore this event</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form */}
      <section id="plan-form-section" className="py-16 bg-stone-100/60 border-b border-stone-200 scroll-mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-10">
            <div className="border-b border-stone-100 pb-6 mb-8">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">Plan your fundraiser</h2>
              <p className="text-stone-600 text-sm mt-1">
                Tell us about your cause and community. Our Qloo agent analyzes local taste signals to tailor venues, talent, and
                sponsors.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-800 flex items-center gap-2" role="alert">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={submit} noValidate className="space-y-6">
              <div>
                <label htmlFor="cause" className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5">
                  Cause Description <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="cause"
                  rows={3}
                  maxLength={500}
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                  placeholder="e.g., An Austin foster network for senior dogs (8+ yrs) needing hospice care and loving homes."
                  className={cx(fieldCls, "resize-y")}
                  required
                />
                <div className="text-[11px] text-stone-500 mt-1">Describe what your nonprofit does and who you serve.</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="city" className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5">
                    City <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className={cx(fieldCls, "cursor-pointer appearance-none")} required>
                      {CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-stone-500">▼</div>
                  </div>
                </div>

                <div>
                  <label htmlFor="guests" className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5">
                    Expected Guests <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="guests"
                      type="number"
                      min={10}
                      max={5000}
                      value={guests || ""}
                      onChange={(e) => setGuests(parseInt(e.target.value) || 0)}
                      className={fieldCls}
                      required
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-stone-400 text-xs">attendees</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="month" className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5">
                    Preferred Month or Season <span className="text-stone-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    id="month"
                    type="text"
                    maxLength={20}
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    placeholder="e.g., March or Spring evening"
                    className={fieldCls}
                  />
                </div>

                <fieldset>
                  <legend className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5">
                    Budget Tier <span className="text-rose-600">*</span>
                  </legend>
                  <div className="grid grid-cols-3 gap-2">
                    {BUDGETS.map((b) => (
                      <button
                        key={b.value}
                        type="button"
                        aria-pressed={budget === b.value}
                        onClick={() => setBudget(b.value)}
                        className={cx(
                          "px-2.5 py-2 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer",
                          budget === b.value
                            ? "bg-stone-900 text-white border-stone-900 shadow-xs"
                            : "bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100",
                        )}
                      >
                        <div className="font-semibold">{b.label}</div>
                        <div className="text-[10px] opacity-75 truncate">{b.hint}</div>
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div>
                <label htmlFor="interest" className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1">
                  Supporter Interests <span className="text-stone-400 font-normal lowercase">(optional, up to 5)</span>
                </label>
                <p className="text-xs text-stone-500 mb-2">
                  General interests of your supporters as a group. Don&apos;t enter names or personal details.
                </p>

                <div className="flex gap-2 mb-2">
                  <input
                    id="interest"
                    type="text"
                    maxLength={60}
                    value={interestInput}
                    onChange={(e) => setInterestInput(e.target.value)}
                    onKeyDown={addInterest}
                    placeholder="e.g. craft beer, bluegrass, outdoor yards, pottery"
                    className={cx(fieldCls, "flex-1 py-2")}
                  />
                  <button
                    type="button"
                    onClick={addInterest}
                    disabled={interests.length >= 5 || !interestInput.trim()}
                    className="px-4 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {interests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {interests.map((interest) => (
                      <span
                        key={interest}
                        className="inline-flex items-center gap-1.5 text-xs text-stone-700 bg-stone-100 border border-stone-200/80 px-2.5 py-1 rounded-md"
                      >
                        <span>{interest}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${interest}`}
                          onClick={() => setInterests(interests.filter((i) => i !== interest))}
                          className="text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-stone-500 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span>Runs through 11 verification steps in about 30–60 seconds.</span>
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-8 py-3 text-sm font-semibold text-white bg-amber-800 hover:bg-amber-900 active:scale-[0.98] rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Design my event</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works-section" className="py-20 border-b border-stone-200 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2">Audience-First Architecture</div>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900">How KindLink works</h2>
            <p className="text-stone-600 text-base mt-2">
              Traditional event planners guess or reuse the same stale ballrooms. We cross-reference your cause with verified
              local taste data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                n: "01",
                title: "We read your cause and find what your supporters love.",
                body: "We turn your cause into Qloo taste tags. Are your supporters acoustic listeners, craft beer lovers, or library regulars?",
                code: "urn:tag:taste:affinity_graph",
              },
              {
                n: "02",
                title: "We scout venues, performers, sponsors and neighborhoods.",
                body: "Qloo ranks real local places, artists, brands, neighborhoods and media by affinity with those tastes, and the agent tests its own choices.",
                code: "qloo.insights(venues, performers)",
              },
              {
                n: "03",
                title: "You get a plan where every pick shows its evidence.",
                body: "Every recommendation carries its Qloo signal and score. The AI may only name what Qloo returned. If there's not enough data, we say so instead of guessing.",
                code: "affinity: 0.94 · verified_qloo",
              },
            ].map((s) => (
              <div key={s.n} className="bg-white rounded-xl border border-stone-200 p-8 relative flex flex-col justify-between">
                <div>
                  <div className="text-3xl font-serif font-bold text-amber-800/40 mb-4">{s.n}</div>
                  <h3 className="text-lg font-bold text-stone-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-stone-600 leading-relaxed">{s.body}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-stone-100 text-xs text-stone-500 font-mono">{s.code}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-amber-50/70 border border-amber-200/80 rounded-xl max-w-3xl mx-auto flex items-center justify-center gap-4 text-center">
            <ShieldCheck className="w-6 h-6 text-amber-800 shrink-0 hidden sm:block" />
            <div className="text-sm font-medium text-stone-800">
              <span className="font-semibold text-amber-900">A strict rule:</span> &quot;Nothing is invented. Every name comes from
              real data.&quot; When taste signals are insufficient, we leave sections empty rather than hallucinate.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
