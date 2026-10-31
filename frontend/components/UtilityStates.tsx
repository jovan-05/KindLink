"use client";

import { AlertCircle, ArrowRight, FileQuestion, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";

export function LoadingState({ label = "Loading plan…" }: { label?: string }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-16">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-6 shadow-xs">
        <Loader2 className="w-8 h-8 text-amber-800 animate-spin" />
      </div>
      <h2 className="text-2xl font-serif font-bold text-stone-900">{label}</h2>
      <p className="text-stone-600 text-sm mt-2 max-w-md">
        Retrieving the verified Qloo taste affinities, venues and neighborhoods for this plan.
      </p>
      <div className="mt-6 text-xs text-stone-400 font-mono">Connecting to Qloo Cultural Graph Engine</div>
    </div>
  );
}

export function NotFoundState({ title = "Plan not found", body }: { title?: string; body?: string }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-16">
      <div className="w-16 h-16 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center mb-6 shadow-xs">
        <FileQuestion className="w-8 h-8 text-stone-600" />
      </div>
      <h2 className="text-2xl font-serif font-bold text-stone-900">{title}</h2>
      <p className="text-stone-600 text-sm mt-2 max-w-md">
        {body ??
          "This plan may have expired. Plans are kept while the server runs unless a database is configured."}
      </p>
      <div className="mt-8">
        <Link
          href="/#plan-form-section"
          className="px-6 py-2.5 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-2"
        >
          <span>Plan a new event</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function ErrorState({ body, onRetry }: { body?: string; onRetry?: () => void }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-16">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-6 shadow-xs">
        <AlertCircle className="w-8 h-8 text-rose-600" />
      </div>
      <h2 className="text-2xl font-serif font-bold text-stone-900">Something went wrong</h2>
      <p className="text-stone-600 text-sm mt-2 max-w-md">
        {body ?? "We couldn't reach the planner. Your data is safe; try again in a moment."}
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
            <span>Try again</span>
          </button>
        )}
        <Link
          href="/#plan-form-section"
          className="px-5 py-2.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-all cursor-pointer"
        >
          Plan a new event
        </Link>
      </div>
    </div>
  );
}
