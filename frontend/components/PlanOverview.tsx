"use client";

import {
  Building2,
  ChevronRight,
  Clock,
  FileText,
  HeartHandshake,
  Megaphone,
  Music,
  PartyPopper,
  Printer,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { fireCelebrationConfetti } from "@/lib/confetti";
import type { Plan, Section } from "@/lib/types";
import ExportBriefModal from "./ExportBriefModal";
import FundraisingCalculator from "./FundraisingCalculator";
import MapVisualization from "./MapVisualization";
import { cx, EvidencePill, fmt, NotEnoughData, reasonFor, SignalLine } from "./ui";

const CHANNEL_LABEL: Record<string, string> = { podcast: "Podcast", tv_show: "TV Show" };

const TIER_STYLE: Record<string, string> = {
  "well known": "bg-purple-50 text-purple-800 border border-purple-200",
  established: "bg-purple-50 text-purple-800 border border-purple-200",
  emerging: "bg-blue-50 text-blue-800 border border-blue-200",
};

/** "urn:tag:genre:media" -> "Genre · Media", "urn:entity:movie" -> "Movie". */
function prettyType(type: string) {
  const parts = type.replace(/^urn:(tag|entity):/, "").split(/[:_]/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" · ") || "Taste";
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  aside,
  section,
  children,
}: {
  icon: typeof Building2;
  title: string;
  subtitle: string;
  aside?: React.ReactNode;
  section: Section;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-6 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-amber-800" />
            <h2 className="text-xl font-serif font-bold text-stone-900">{title}</h2>
            {section.status === "thin" && section.items.length > 0 && (
              <span className="text-[10px] font-mono uppercase bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-semibold">Limited Data</span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-1">{subtitle}</p>
        </div>
        {aside}
      </div>
      {section.items.length === 0 ? (
        <div className="pt-6">
          <NotEnoughData title={title} section={section} />
        </div>
      ) : (
        <>
          {section.note && <p className="text-xs text-amber-900 bg-amber-50/70 border border-amber-200/70 rounded-lg px-3 py-2 mt-6">{section.note}</p>}
          {children}
        </>
      )}
    </section>
  );
}

export default function PlanOverview({ plan, onOpenAgentLog }: { plan: Plan; onOpenAgentLog: () => void }) {
  const { sections: s, plan: c, inputs, profile, grounding: g } = plan;
  const venues = s.venues?.items ?? [];
  const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>(c.headline_venue_id ?? venues[0]?.id);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const angles = Object.fromEntries(c.promotion_angles.map((a) => [a.id, a.angle]));

  const verified = g.verified?.length;
  const removed = g.removed.length;
  const dimensions = [
    ...profile.taste_tags.map((t) => ({ id: t.id, category: prettyType(t.type), label: t.name, source: "Qloo taste tag" })),
    ...profile.keyword_tags.map((t) => ({ id: t.id, category: prettyType(t.type), label: t.name, source: "Qloo keyword tag" })),
    ...profile.interests.map((e) => ({ id: e.id, category: prettyType(e.type), label: e.name, source: "Supporter interest · Qloo entity" })),
  ];
  const tagNames = [...profile.taste_tags, ...profile.keyword_tags].map((t) => t.name);
  const thinSections = (Object.entries(s) as [string, Section][]).filter(([, sec]) => sec.items.length === 0);

  return (
    <div className="space-y-12">
      {/* Plan header */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
          <span>
            {inputs.cause.slice(0, 32)}
            {inputs.cause.length > 32 ? "..." : ""}
          </span>
          <span aria-hidden="true">·</span>
          <span>{inputs.city}</span>
          <span aria-hidden="true">·</span>
          <span>{inputs.guests} guests</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-900 font-semibold">{inputs.budget} budget</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6 border-b border-stone-100">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 tracking-tight">{c.event_name}</h1>
            {c.tagline && <p className="text-amber-900 font-serif italic text-base mt-1">{c.tagline}</p>}
            <p className="text-stone-600 text-base sm:text-lg mt-2 leading-relaxed">{c.concept}</p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 no-print">
            <Link
              href={`/pitch/${plan.id}`}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <HeartHandshake className="w-3.5 h-3.5 text-amber-300" />
              <span>Open Sponsor Pitch</span>
            </Link>
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              title="Copy clean markdown event brief"
            >
              <FileText className="w-3.5 h-3.5 text-stone-600" />
              <span>Export Brief</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-stone-600" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() => fireCelebrationConfetti()}
              className="p-2 text-xs font-semibold text-amber-900 bg-amber-100/80 hover:bg-amber-200/90 border border-amber-300 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap"
              title="Celebrate plan with confetti!"
              aria-label="Celebrate"
            >
              <PartyPopper className="w-3.5 h-3.5 text-amber-800" />
            </button>
            <Link href="/#plan-form-section" className="px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-all cursor-pointer whitespace-nowrap">
              New Plan
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-xs text-stone-600">
          {[
            ["Format", c.format || "—"],
            ["Date Window", c.date_window || "—"],
            ["Target Guests", `${inputs.guests} supporters`],
            ["Budget Tier", `${inputs.budget.charAt(0).toUpperCase()}${inputs.budget.slice(1)}`],
          ].map(([k, v], i) => (
            <div key={k}>
              <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-0.5">{k}</div>
              <div className={cx("font-semibold text-sm", i === 3 ? "text-amber-900" : "text-stone-800")}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Why this works */}
      <section className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-800" />
            <h2 className="text-xl font-serif font-bold text-stone-900">Why this works: Supporter Taste DNA</h2>
          </div>
          <div className="text-xs font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded">
            {verified != null ? `${verified} names verified · ${removed} removed` : removed ? `${removed} names removed` : "Every name from Qloo"}
          </div>
        </div>

        <p className="text-stone-700 text-sm sm:text-base leading-relaxed mt-4 max-w-4xl">{c.taste_summary}</p>

        {dimensions.length > 0 && (
          <div className="mt-6 pt-5 border-t border-stone-100">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3 flex items-center justify-between">
              <span>Audience Cultural Dimensions (Qloo signals behind every pick)</span>
              <span className="text-[11px] text-stone-400 font-mono hidden sm:inline">{dimensions.length} signals</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dimensions.map((dim, i) => (
                <div key={`${dim.id}-${i}`}className="bg-stone-50/70 border border-stone-200/90 rounded-xl p-3.5 space-y-1.5 hover:border-amber-400 transition-colors">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-stone-800 truncate">{dim.category}</span>
                    <span className="font-mono font-bold text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded text-[11px] shrink-0">verified</span>
                  </div>
                  <div className="text-xs text-stone-600 font-medium">{dim.label}</div>
                  <div className="text-[11px] text-emerald-700 font-mono pt-1 border-t border-stone-200/60">{dim.source}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-stone-100">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Active Qloo Cultural Taste Tags Used:</div>
          {tagNames.length ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-stone-700 font-mono">
              {tagNames.map((tag, idx) => (
                <span key={`${tag}-${idx}`} className="flex items-center gap-2">
                  <span className="font-semibold text-amber-900">#{tag}</span>
                  {idx < tagNames.length - 1 && <span className="text-stone-300">/</span>}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-stone-500 font-mono">none found</span>
          )}
        </div>

        <div className="mt-6 p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-semibold">Grounding check:</span>
          {verified != null ? (
            <span>
              {verified + removed} names the AI wrote, <b>{verified} verified</b> against Qloo
              {removed > 0 ? (
                <>
                  , <b className="text-rose-700">{removed} removed</b>
                </>
              ) : (
                ", 0 invented"
              )}
              {g.picks != null && <> · all {g.picks} picks come straight from Qloo</>}
            </span>
          ) : (
            <span>{removed === 0 ? "every name in this plan came from Qloo results." : `${removed} unverified name(s) removed.`}</span>
          )}
          {plan.agent_log && (
            <button onClick={onOpenAgentLog} className="no-print ml-auto font-semibold underline underline-offset-2 hover:text-stone-900 cursor-pointer">
              See how the agent decided →
            </button>
          )}
        </div>
      </section>

      <FundraisingCalculator initialGuests={inputs.guests} budget={inputs.budget} />

      {/* Where your supporters are */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-900">Where your supporters are</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Qloo heatmap and neighborhood ranking for your supporters&apos; tastes, with every recommended venue pinned.
          </p>
        </div>
        <MapVisualization
          plan={plan}
          venues={venues}
          neighborhoods={s.neighborhoods?.items ?? []}
          section={s.neighborhoods}
          heat={s.neighborhoods?.heat ?? []}
          selectedVenueId={selectedVenueId}
          onSelectVenue={setSelectedVenueId}
        />
      </section>

      {/* Venues */}
      <SectionCard
        icon={Building2}
        title="Recommended Venues (Where to host)"
        subtitle={`${venues.length} venues matched. Numbers (1–${venues.length}) correspond directly to the interactive map pins above.`}
        aside={<div className="text-xs text-stone-500 font-mono">Ranked by Qloo affinity</div>}
        section={s.venues}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
          {venues.map((venue, i) => {
            const isSelected = selectedVenueId === venue.id;
            const pop = Math.round((venue.evidence.popularity ?? 0) * 100);
            return (
              <div
                key={venue.id}
                onClick={() => setSelectedVenueId(venue.id)}
                className={cx(
                  "p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between",
                  isSelected ? "border-amber-600 bg-amber-50/40 ring-2 ring-amber-500/20 shadow-md" : "border-stone-200 hover:border-amber-400 bg-white shadow-xs",
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cx(
                          "w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 shadow-xs",
                          isSelected ? "bg-amber-600 text-white" : "bg-stone-900 text-white",
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-stone-900 flex flex-wrap items-center gap-2">
                          {venue.name}
                          {c.headline_venue_id === venue.id && (
                            <span className="text-[10px] font-mono uppercase bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-semibold">Top pick</span>
                          )}
                        </h3>
                        {venue.address && <div className="text-[11px] text-stone-500 truncate max-w-xs">{venue.address}</div>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <EvidencePill ev={venue.evidence} />
                    </div>
                  </div>

                  {reasonFor(plan, venue) && <p className="text-xs text-stone-700 leading-relaxed mt-2.5 font-medium">{reasonFor(plan, venue)}</p>}

                  {venue.tags && venue.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {[...new Set(venue.tags)].slice(0, 5).map((a) => (
                        <span key={a}className="text-[10px] text-stone-600 bg-stone-100/90 border border-stone-200/80 px-2 py-0.5 rounded-md">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-stone-100 space-y-2">
                  {venue.evidence.popularity != null && (
                    <>
                      <div className="flex items-center justify-between text-[11px] text-stone-500">
                        <span>Qloo popularity</span>
                        <span className="font-mono text-emerald-700 font-semibold">{fmt(venue.evidence.popularity)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-600 rounded-full" style={{ width: `${pop}%` }} />
                      </div>
                    </>
                  )}
                  <SignalLine ev={venue.evidence} />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Performers */}
      <SectionCard
        icon={Music}
        title="Recommended Performers (Who to book)"
        subtitle={`${s.performers.items.length} acts matching supporter music tastes${s.performers.band ? `, filtered to ${s.performers.band}` : " and your budget"}.`}
        section={s.performers}
      >
        <div className="divide-y divide-stone-100 pt-2">
          {s.performers.items.map((act) => (
            <div key={act.id} className="py-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="text-sm font-bold text-stone-900">{act.name}</h3>
                  {act.tags?.[0] && (
                    <>
                      <span className="text-stone-300">·</span>
                      <span className="text-xs text-stone-500 font-medium">{act.tags[0]}</span>
                    </>
                  )}
                  {act.popularity_tier && act.popularity_tier !== "unknown" && (
                    <>
                      <span className="text-stone-300">·</span>
                      <span className={cx("text-[11px] font-semibold px-2 py-0.5 rounded capitalize", TIER_STYLE[act.popularity_tier] ?? "bg-stone-100 text-stone-700")}>
                        {act.popularity_tier} tier
                      </span>
                    </>
                  )}
                  {c.headline_performer_id === act.id && (
                    <span className="text-[10px] font-mono uppercase bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-semibold">Top pick</span>
                  )}
                </div>
                {reasonFor(plan, act) && <p className="text-xs text-stone-600 leading-relaxed">{reasonFor(plan, act)}</p>}
                <SignalLine ev={act.evidence} />
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                <EvidencePill ev={act.evidence} />
                {act.evidence.basis === "affinity" && act.evidence.popularity != null && (
                  <div className="text-[11px] text-stone-500 font-medium">popularity {fmt(act.evidence.popularity)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Sponsors */}
      <SectionCard
        icon={HeartHandshake}
        title="Sponsors to Approach (Who to ask)"
        subtitle={`${s.sponsors.items.length} businesses and brands whose customers overlap with your supporters' tastes.`}
        aside={<div className="text-xs text-stone-500">Click to generate tailored pitch letter</div>}
        section={s.sponsors}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-6">
          {s.sponsors.items.map((sponsor) => (
            <div
              key={sponsor.id}
              className="bg-stone-50/60 rounded-xl border border-stone-200 p-5 flex flex-col justify-between hover:border-amber-400/80 hover:bg-white transition-all shadow-2xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="text-sm font-bold text-stone-900">{sponsor.name}</h3>
                  <EvidencePill ev={sponsor.evidence} />
                </div>
                <div className="text-[11px] text-amber-900 font-medium mb-2 capitalize">{sponsor.sponsor_type ?? "Local business"}</div>
                {reasonFor(plan, sponsor) && <p className="text-xs text-stone-600 leading-relaxed mb-3">{reasonFor(plan, sponsor)}</p>}
                <div className="text-[11px] text-stone-500 border-t border-stone-200/60 pt-2.5">
                  <span className="font-semibold text-stone-700">Qloo Signal: </span>
                  {sponsor.evidence.signal}
                </div>
              </div>

              <div className="no-print mt-4 pt-3 border-t border-stone-200/80 flex items-center justify-end">
                <Link
                  href={`/pitch/${plan.id}?sponsor=${encodeURIComponent(sponsor.id)}`}
                  className="text-xs font-semibold text-amber-900 hover:text-amber-950 flex items-center gap-1 cursor-pointer group"
                >
                  <span>Pitch this sponsor</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Promotion */}
      <SectionCard
        icon={Megaphone}
        title="Promotion Plan (Where to spread the word)"
        subtitle={`${s.promotion.items.length} podcasts and shows whose audiences overlap with your supporters.`}
        section={s.promotion}
      >
        <div className="divide-y divide-stone-100 pt-2">
          {s.promotion.items.map((channel) => (
            <div key={channel.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-stone-900">{channel.name}</h3>
                  <span className="text-stone-300">·</span>
                  <span className="text-xs text-stone-500">{CHANNEL_LABEL[channel.channel ?? ""] ?? "Media"}</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {angles[channel.id] ||
                    reasonFor(plan, channel) ||
                    "Audience overlaps with your supporters' tastes; pitch a guest spot or listener shout-out."}
                </p>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                <EvidencePill ev={channel.evidence} />
                {channel.evidence.basis === "affinity" && channel.evidence.popularity != null && (
                  <div className="text-[11px] text-stone-500 font-medium">popularity {fmt(channel.evidence.popularity)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Run of show */}
      <section className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-2 pb-6 border-b border-stone-100">
          <Clock className="w-5 h-5 text-amber-800" />
          <h2 className="text-xl font-serif font-bold text-stone-900">Run of Show (On the day)</h2>
        </div>
        {c.run_of_show.length ? (
          <div className="relative pl-6 sm:pl-8 space-y-6 pt-6 before:absolute before:left-2.5 sm:before:left-3 before:top-8 before:bottom-4 before:w-0.5 before:bg-stone-200">
            {c.run_of_show.map((item, idx) => (
              <div key={idx} className="relative group">
                <div className="absolute -left-6 sm:-left-8 top-1 w-3 h-3 rounded-full bg-stone-900 border-2 border-amber-300 group-hover:scale-125 transition-transform" />
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div className="text-xs font-mono font-bold text-amber-900">{item.time}</div>
                  <div className="text-xs text-stone-400 font-medium sm:text-right">Phase {idx + 1}</div>
                </div>
                <h3 className="text-sm font-bold text-stone-900 mt-0.5">{item.title}</h3>
                {item.detail && <p className="text-xs text-stone-600 leading-relaxed mt-1">{item.detail}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-500 pt-6">No run of show was generated.</p>
        )}
      </section>

      {/* Data notes + honest gaps */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-stone-700" />
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">Data Notes & Honest Caveats</h3>
          </div>
          <ul className="space-y-2.5 text-xs text-stone-600">
            {(plan.data_notes.length ? plan.data_notes : ["Every section had enough ranked Qloo data."]).map((note, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-800 font-bold">•</span>
                <span>{note}</span>
              </li>
            ))}
            <li className="flex items-start gap-2 text-stone-500">
              <span className="text-amber-800 font-bold">•</span>
              <span>
                Affinity is Qloo&apos;s 0–1 score of how strongly an item matches the taste signal; popularity is how widely known it
                is. Generated in {plan.meta.seconds}s{plan.meta.models.length ? ` · AI: ${plan.meta.models.join(", ")}` : ""}.
              </span>
            </li>
          </ul>
        </div>

        {removed > 0 ? (
          <div className="bg-stone-50 rounded-2xl border border-dashed border-stone-300 p-6">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-bold text-stone-700">Removed by the Grounding Check</h3>
              <span className="text-[10px] font-mono uppercase bg-rose-100 text-rose-800 px-2 py-0.5 rounded">{removed} removed</span>
            </div>
            <ul className="space-y-1.5 text-xs mt-3">
              {g.removed.map((r, i) => (
                <li key={i}>
                  <s className="text-rose-700 decoration-2 font-semibold">{r.name}</s>
                  <span className="text-stone-500"> · suggested by the AI in {r.field}, not found in the Qloo results</span>
                </li>
              ))}
            </ul>
          </div>
        ) : thinSections.length > 0 ? (
          <NotEnoughData title={thinSections.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)).join(", ")} section={thinSections[0][1]} />
        ) : (
          <div className="bg-stone-50 rounded-2xl border border-dashed border-stone-300 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-bold text-stone-700">Zero Hallucination Protocol</h3>
                <span className="text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">0 invented</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed mt-2">
                Every venue, performer, sponsor, neighborhood and channel above came from a Qloo response. When a section lacks data,{" "}
                <span className="font-semibold text-stone-800">KindLink leaves it empty rather than guess.</span>
              </p>
            </div>
          </div>
        )}
      </section>

      <ExportBriefModal plan={plan} isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
    </div>
  );
}
