import type { PlanInput } from "./types";

// Keep in sync with backend/app/examples.py (ids must match the pre-cached plans).
// Display copy only; event names, taglines and scores on the landing page come from the cached plans.
export const EXAMPLES: {
  id: string;
  title: string;
  city: string;
  blurb: string;
  subtitle: string;
  badge: string;
  image: string;
  input: PlanInput;
}[] = [
  {
    id: "example-austin-senior-dogs",
    title: "Senior-dog rescue",
    city: "Austin, TX",
    blurb: "Austin, TX · 150 guests",
    subtitle: "Senior-dog rescue · Austin, TX",
    badge: "Animal Rescue Foster Network",
    image: "/images/hero_community_event_1793395991363.jpg",
    input: {
      cause: "Animal rescue shelter that rehomes senior dogs",
      city: "Austin",
      guests: 150,
      budget: "modest",
      month: "March",
      interests: ["Marley & Me"],
    },
  },
  {
    id: "example-chicago-literacy",
    title: "Children's literacy",
    city: "Chicago, IL",
    blurb: "Chicago, IL · 120 guests",
    subtitle: "Children's literacy nonprofit · Chicago, IL",
    badge: "Youth Education & Reading Equity",
    image: "/images/chicago_literacy_event_1793396871937.jpg",
    input: {
      cause: "Children's literacy nonprofit that runs free reading programs and gives books to kids",
      city: "Chicago",
      guests: 120,
      budget: "shoestring",
      month: "May",
      interests: ["Where the Wild Things Are"],
    },
  },
  {
    id: "example-nyc-youth-music",
    title: "Free music school",
    city: "New York, NY",
    blurb: "New York, NY · 200 guests",
    subtitle: "Free youth music school · New York, NY",
    badge: "Youth Instrumental Mentorship",
    image: "/images/philly_music_event_1793396885424.jpg",
    input: {
      cause: "Free after-school music school teaching instruments to young people",
      city: "New York",
      guests: 200,
      budget: "generous",
      month: "October",
      interests: ["School of Rock"],
    },
  },
];

export const CITIES = [
  "Austin", "Atlanta", "Boston", "Chicago", "Dallas", "Denver", "Houston", "Los Angeles", "Miami",
  "Minneapolis", "Nashville", "New Orleans", "New York", "Philadelphia", "Phoenix", "Portland",
  "San Diego", "San Francisco", "Seattle", "Washington",
];
