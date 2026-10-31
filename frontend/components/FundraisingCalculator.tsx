"use client";

import { Heart, PartyPopper, TrendingUp } from "lucide-react";
import { useState } from "react";
import { fireCelebrationConfetti } from "@/lib/confetti";
import type { Budget } from "@/lib/types";

// Starting points only; every number is editable because we have no real cost data.
const DEFAULT_COST: Record<Budget, number> = { shoestring: 1000, modest: 3000, generous: 8000 };

function MoneyInput({ label, hint, value, step, onChange }: { label: string; hint: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="bg-white p-3.5 rounded-xl border border-stone-200">
      <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-1">
        {label}
        <div className="relative mt-1">
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs text-stone-400">$</span>
          <input
            type="number"
            min={0}
            step={step}
            value={value}
            onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
            className="w-full pl-6 pr-3 py-1.5 text-xs font-mono font-bold text-stone-900 border border-stone-300 rounded-md focus:outline-none focus:border-amber-800 normal-case tracking-normal"
          />
        </div>
      </label>
      <div className="text-[10px] text-stone-400 mt-1">{hint}</div>
    </div>
  );
}

export default function FundraisingCalculator({ initialGuests, budget }: { initialGuests: number; budget: Budget }) {
  const [ticketPrice, setTicketPrice] = useState(45);
  const [guestCount, setGuestCount] = useState(initialGuests);
  const [sponsorships, setSponsorships] = useState(2500);
  const [merch, setMerch] = useState(800);
  const [cost, setCost] = useState(DEFAULT_COST[budget] ?? 3000);

  const ticketRevenue = ticketPrice * guestCount;
  const grossRevenue = ticketRevenue + sponsorships + merch;
  const net = Math.max(0, grossRevenue - cost);
  const perGuest = guestCount ? net / guestCount : 0;
  const breakEven = ticketPrice ? Math.max(0, Math.ceil((cost - sponsorships - merch) / ticketPrice)) : 0;
  const maxGuests = Math.max(500, initialGuests * 2);

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-stone-50 to-emerald-500/10 rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-800 text-amber-200">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="text-xl font-serif font-bold text-stone-900">Fundraising Yield & Impact Calculator</h3>
          </div>
          <p className="text-xs text-stone-600 mt-1">
            Simulate your expected ticket tiers and local sponsor packages to project net dollars for your mission. All figures
            are your own estimates.
          </p>
        </div>

        <button
          onClick={() => fireCelebrationConfetti()}
          className="no-print px-3.5 py-2 text-xs font-semibold text-amber-950 bg-amber-200 hover:bg-amber-300 border border-amber-300 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs self-start sm:self-center"
        >
          <PartyPopper className="w-3.5 h-3.5 text-amber-900" />
          <span>Celebrate Goal 🎉</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6">
        <div className="lg:col-span-7 space-y-6">
          <div>
            <div className="flex justify-between text-xs font-semibold text-stone-800 mb-1.5">
              <span>Suggested Ticket / Entry Donation</span>
              <span className="font-mono text-amber-900 font-bold text-sm">${ticketPrice} / guest</span>
            </div>
            <input
              type="range"
              min={0}
              max={150}
              step={5}
              value={ticketPrice}
              onChange={(e) => setTicketPrice(Number(e.target.value))}
              className="w-full accent-amber-800 cursor-pointer"
              aria-label="Ticket price"
            />
            <div className="flex justify-between text-[10px] text-stone-400 font-mono mt-1">
              <span>$0 (Free entry)</span>
              <span>$75</span>
              <span>$150 (Patron tier)</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-stone-800 mb-1.5">
              <span>Attendance Estimate</span>
              <span className="font-mono text-stone-900 font-bold text-sm">{guestCount} supporters</span>
            </div>
            <input
              type="range"
              min={10}
              max={maxGuests}
              step={10}
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value))}
              className="w-full accent-amber-800 cursor-pointer"
              aria-label="Attendance"
            />
            <div className="flex justify-between text-[10px] text-stone-400 font-mono mt-1">
              <span>10 intimate</span>
              <span>{initialGuests} planned</span>
              <span>{maxGuests}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <MoneyInput label="Sponsor Contributions" hint="E.g., 2 community sponsors @ $1,250" value={sponsorships} step={250} onChange={setSponsorships} />
            <MoneyInput label="Silent Auction & Merch" hint="T-shirts, tote bags, art prints" value={merch} step={100} onChange={setMerch} />
            <MoneyInput label="Event Costs" hint="Your estimate: venue, talent, supplies" value={cost} step={250} onChange={setCost} />
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col justify-between bg-stone-900 text-white rounded-xl p-6 shadow-md border border-stone-800">
          <div>
            <div className="text-xs uppercase font-mono tracking-wider text-amber-300 font-semibold mb-1">Projected Net Charitable Yield</div>
            <div className="text-3xl sm:text-4xl font-serif font-bold text-white tracking-tight">${net.toLocaleString()}</div>
            <div className="text-xs text-emerald-400 font-mono mt-1 flex flex-wrap items-center gap-1.5">
              <span>Gross Raised: ${grossRevenue.toLocaleString()}</span>
              <span>·</span>
              <span>Cost: -${cost.toLocaleString()}</span>
            </div>

            <div className="mt-5 p-3.5 bg-stone-800/90 border border-stone-700 rounded-lg text-xs leading-relaxed text-amber-100 flex items-start gap-2.5">
              <Heart className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Real Mission Impact:</strong>
                <span>
                  Each guest raises about ${perGuest.toFixed(0)} for your cause.{" "}
                  {breakEven > 0 ? `You break even after ${breakEven} paid tickets.` : "Sponsors and auction already cover your costs."}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
            <span>
              Return on costs: <strong className="text-white font-mono">{(grossRevenue / (cost || 1)).toFixed(1)}x</strong>
            </span>
            <span className="text-emerald-400 font-semibold">Net goes to the cause</span>
          </div>
        </div>
      </div>
    </div>
  );
}
