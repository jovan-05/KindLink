// Mirrors the plan JSON produced by backend/app/agent/pipeline.py.

export type Budget = "shoestring" | "modest" | "generous";

export interface PlanInput {
  cause: string;
  city: string;
  guests: number;
  budget: Budget;
  month?: string | null;
  interests: string[];
}

export interface Evidence {
  signal: string;
  affinity: number | null;
  popularity: number | null;
  basis: "affinity" | "popularity" | "heatmap";
  quality: string;
  explain: string[];
}

export interface Pick {
  id: string;
  name: string;
  kind?: string;
  address?: string | null;
  neighborhood?: string | null;
  lat?: number | null;
  lon?: number | null;
  image?: string | null;
  website?: string | null;
  description?: string | null;
  tags?: string[];
  popularity_tier?: string;
  evidence: Evidence;
  reason?: string;
  sponsor_type?: "local business" | "brand";
  channel?: "podcast" | "tv_show";
}

export interface Section {
  status: "ok" | "thin" | "failed";
  items: Pick[];
  note: string;
  quality: string;
  signal: string;
  band?: string;
  heat?: [number, number, number][];
}

export interface Tag {
  id: string;
  name: string;
  type: string;
}

export interface RunOfShowItem {
  time: string;
  title: string;
  detail: string;
}

export interface ComposedPlan {
  event_name: string;
  tagline: string;
  concept: string;
  format: string;
  date_window: string;
  taste_summary: string;
  headline_venue_id: string | null;
  headline_performer_id: string | null;
  reasons: Record<string, string>;
  run_of_show: RunOfShowItem[];
  promotion_angles: { id: string; angle: string }[];
  sponsor_pitch: {
    subject: string;
    opening: string;
    audience: string;
    benefits: string[];
    ask: string;
  };
}

export interface BaselineItem {
  name: string;
  reason: string;
}

export interface Baseline {
  status: "ok" | "failed";
  note?: string;
  model?: string;
  event_name?: string;
  concept?: string;
  venues: BaselineItem[];
  performers: BaselineItem[];
  sponsors: BaselineItem[];
  promotion: BaselineItem[];
}

export type SectionName = "venues" | "performers" | "sponsors" | "neighborhoods" | "promotion";

export interface Plan {
  id: string;
  created_at: string;
  inputs: PlanInput;
  profile: {
    keywords: string[];
    taste_tags: Tag[];
    keyword_tags: Tag[];
    org_tags: Tag[];
    interests: { id: string; name: string; type: string }[];
    unresolved_interests: string[];
  };
  sections: Record<SectionName, Section>;
  plan: ComposedPlan;
  baseline: Baseline;
  grounding: Grounding;
  agent_log?: AgentLogEntry[];
  data_notes: string[];
  meta: { seconds: number; models: string[]; llm_fallbacks: string[] };
}

export interface Grounding {
  /** Older stored plans had `checked: true` and no counts. */
  checked: number | boolean;
  verified?: string[];
  removed: { name: string; field: string }[];
  picks?: number;
}

export interface AgentLogEntry {
  step: string;
  label: string;
  status: "running" | "done" | "thin" | "failed";
  message: string;
  notes: string[];
}

export interface StepEvent extends AgentLogEntry {
  type: "step";
}

export interface Example {
  id: string;
  key: string;
  title: string;
  city_label: string;
  input: PlanInput;
  ready: boolean;
}
