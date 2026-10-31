"use client";

import { ArrowLeft, Check, Link2, Printer, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fireCelebrationConfetti } from "@/lib/confetti";
import type { Plan } from "@/lib/types";
import { EvidencePill, evidenceLabel, reasonFor } from "./ui";

const DEFAULT_BENEFITS = ["Logo on event materials", "On-stage thank-you", "Sampling or booth space"];

export default function SponsorPitchLetter({ plan }: { plan: Plan }) {
  const sponsors = plan.sections.sponsors?.items ?? [];
  const [sponsorId, setSponsorId] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("sponsor");
    if (fromUrl && (plan.sections.sponsors?.items ?? []).some((s) => s.id === fromUrl)) setSponsorId(fromUrl);
  }, [plan]);

  const sponsor = sponsors.find((s) => s.id === sponsorId);
  const c = plan.plan;
  const p = c.sponsor_pitch;
  const venues = plan.sections.venues?.items ?? [];
  const venue = venues.find((v) => v.id === c.headline_venue_id) ?? venues[0];
  const tags = [...plan.profile.taste_tags, ...plan.profile.keyword_tags].map((t) => t.name);
  const hoods = plan.sections.neighborhoods?.items ?? [];

  function choose(id: string) {
    setSponsorId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("sponsor", id);
    else url.searchParams.delete("sponsor");
    window.history.replaceState(null, "", url);
  }

  function handleCopyLink() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      fireCelebrationConfetti();
      setTimeout(() => setCopiedLink(false), 2200);
    });
  }

  const ref = (sponsor?.name ?? c.event_name).replace(/[^a-zA-Z]/g, "").slice(0, 6).toUpperCase();

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="no-print bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/plan/${plan.id}`}
            className="text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Plan</span>
          </Link>

          {sponsors.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="sponsor" className="text-xs font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                Address this pitch to:
              </label>
              <select
                id="sponsor"
                value={sponsorId}
                onChange={(e) => choose(e.target.value)}
                className="text-xs font-semibold text-stone-900 bg-stone-50 border border-stone-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 cursor-pointer max-w-[16rem]"
              >
                <option value="">Any sponsor</option>
                {sponsors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.sponsor_type ?? "local business"})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Link Copied!</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 text-stone-500" />
                <span>Copy Link</span>
              </>
            )}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>Print Letter</span>
          </button>
        </div>
      </div>

      <div className="print-page bg-white rounded-2xl border border-stone-200/90 shadow-lg p-8 sm:p-14 text-stone-800 space-y-8 font-sans relative overflow-hidden">
        <div className="absolute top-8 right-8 pointer-events-none opacity-[0.06] flex flex-col items-center select-none">
          <ShieldCheck className="w-36 h-36 text-amber-900" />
        </div>

        <div className="border-b-2 border-stone-900 pb-6 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
            <div>
              <div className="text-xs font-mono font-bold tracking-widest uppercase text-amber-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Verified Taste Data Proposal · {plan.inputs.city}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 tracking-tight mt-1.5">{c.event_name}</h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Organized for: <strong className="text-stone-700">{plan.inputs.cause}</strong>
              </p>
            </div>

            <div className="text-xs text-stone-500 font-mono sm:text-right bg-stone-50 border border-stone-200 p-2.5 rounded-lg shrink-0">
              <div>
                Ref: <strong className="text-stone-800">SPONSOR-{ref}</strong>
              </div>
              {sponsor && (
                <div>
                  Qloo: <strong className="text-emerald-800">{evidenceLabel(sponsor.evidence)}</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 text-sm sm:text-base leading-relaxed text-stone-700">
          {p.subject && <p className="text-xs text-stone-500 font-mono">Re: {p.subject}</p>}
          <p className="font-semibold text-stone-900 text-base">{sponsor ? `Dear ${sponsor.name} Community Team,` : "Dear Partner,"}</p>
          <p>{p.opening}</p>
        </div>

        <div className="bg-stone-50/80 rounded-xl border border-stone-200 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-800" />
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider font-mono">
              Why our audience is your audience (Verified Taste Evidence)
            </h2>
          </div>

          {p.audience && <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">{p.audience}</p>}

          <div className="space-y-3.5 text-xs sm:text-sm">
            {sponsor && (
              <div className="flex items-start gap-3">
                <EvidencePill ev={sponsor.evidence} className="shrink-0" />
                <div>
                  <strong className="text-stone-900">Direct Customer Overlap: </strong>
                  <span>{reasonFor(plan, sponsor) || `${sponsor.name} ranks highly with our supporters' taste profile in Qloo.`}</span>
                </div>
              </div>
            )}
            {tags.length > 0 && (
              <div className="flex items-start gap-3">
                <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                  {tags.length} tags
                </span>
                <div>
                  <strong className="text-stone-900">Shared Values & Lifestyle: </strong>
                  <span>Our supporters&apos; Qloo taste profile: {tags.join(", ")}.</span>
                </div>
              </div>
            )}
            {hoods.length > 0 && (
              <div className="flex items-start gap-3">
                <EvidencePill ev={hoods[0].evidence} className="shrink-0" />
                <div>
                  <strong className="text-stone-900">Local Neighborhood Synergy: </strong>
                  <span>Supporter hotspots: {hoods.map((h) => h.name).join(", ")}.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-y border-stone-200 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          {[
            ["Date Window", c.date_window || "To be confirmed"],
            ["Venue", venue?.name ?? "To be confirmed"],
            ["Expected Guests", `${plan.inputs.guests} local supporters`],
            ["Event Format", c.format || "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-stone-400 font-semibold uppercase text-[10px] tracking-wider">{k}</div>
              <div className="font-bold text-stone-900 mt-0.5">{v}</div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider font-mono">What your sponsorship includes</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-stone-700">
            {(p.benefits.length ? p.benefits : DEFAULT_BENEFITS).map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-800 font-bold">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider font-mono">The event</h2>
          <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">{c.concept}</p>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-6 text-stone-900">
          <h3 className="font-serif font-bold text-base sm:text-lg text-amber-950">Can we count on you to partner with us?</h3>
          <p className="text-xs sm:text-sm text-stone-700 mt-1 leading-relaxed">{p.ask || "Could we set up a 15-minute call next week?"}</p>
          <div className="mt-4 pt-3 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="font-semibold text-stone-800">Contact us: ______________________________</div>
            <div className="text-stone-500 font-mono">Tel: ____________________</div>
          </div>
        </div>

        <div className="pt-6 border-t border-stone-200 text-center text-xs text-stone-500 font-mono flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>Audience data from Qloo taste insights: aggregate interests only, no personal data. Planned with KindLink.</span>
        </div>
      </div>
    </div>
  );
}
