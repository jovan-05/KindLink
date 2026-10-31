"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const onLanding = pathname === "/";
  const pitchMatch = pathname.match(/^\/pitch\/([^/]+)/);

  // On the landing page scroll to the section; elsewhere go home first, then scroll.
  function goTo(id: string) {
    if (onLanding) scrollToId(id);
    else {
      router.push(`/#${id}`);
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-stone-50/95 backdrop-blur-md border-b border-stone-200/80 transition-colors no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-stone-900 font-sans hover:text-amber-800 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
          >
            <span className="w-7 h-7 rounded-md bg-stone-900 text-amber-300 flex items-center justify-center font-serif text-base font-semibold shadow-xs">
              K
            </span>
            <span>KindLink</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
          <button onClick={() => goTo("plan-form-section")} className="hover:text-stone-900 transition-colors whitespace-nowrap cursor-pointer">
            Plan Fundraiser
          </button>
          <button onClick={() => goTo("how-it-works-section")} className="hover:text-stone-900 transition-colors whitespace-nowrap cursor-pointer">
            How It Works
          </button>
          <a
            href="https://www.qloo.com/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-stone-900 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
          >
            <span>Qloo Taste Intelligence</span>
          </a>
          <button onClick={() => goTo("try-examples-section")} className="hover:text-stone-900 transition-colors whitespace-nowrap cursor-pointer">
            Examples
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {onLanding ? (
            <button
              onClick={() => scrollToId("plan-form-section")}
              className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 rounded-lg hover:bg-stone-800 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer shadow-xs"
            >
              Plan Your Fundraiser
            </button>
          ) : pitchMatch ? (
            <Link
              href={`/plan/${pitchMatch[1]}`}
              className="px-4 py-2 text-xs font-semibold text-stone-900 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Plan</span>
            </Link>
          ) : (
            <Link
              href="/#plan-form-section"
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-800 rounded-lg hover:bg-amber-900 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer shadow-xs"
            >
              New Plan
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
