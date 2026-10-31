"""Grounding check: the LLM may only *name* entities that came back from Qloo.

Two layers:
1. Marked names. The compose prompt requires every named place/artist/brand/show to be written as
   [[Name]]. Marked names that match a Qloo result are replaced by the canonical name; others are
   replaced with a neutral phrase and logged.
2. Unmarked names. A conservative scan for proper-noun phrases that end in an entity-like word
   ("... Brewery", "... Park", "... Records"). Any such phrase not in the allowed set is removed too.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

GENERIC = "a local partner"
MARK = re.compile(r"\[\[([^\[\]]{1,120})\]\]")

ENTITY_SUFFIXES = {
    "park", "brewery", "brewing", "brewhouse", "cafe", "café", "coffee", "bakery", "bar", "pub", "tavern",
    "lounge", "taproom", "winery", "hall", "theater", "theatre", "center", "centre", "studio", "studios",
    "records", "band", "podcast", "show", "gallery", "museum", "club", "kitchen", "market", "hotel",
    "company", "co", "inc", "llc", "foundation", "garden", "gardens", "arena", "stadium", "ballroom",
    "roasters", "distillery", "cinema", "library", "zoo", "aquarium", "orchestra", "ensemble", "choir",
}
# Words that make a capitalized phrase generic ("Coffee Bar", "Welcome Hall", "Silent Auction Center").
COMMON = {
    "the", "a", "an", "and", "of", "&", "our", "your", "welcome", "main", "vip", "coffee", "wine", "beer",
    "craft", "cocktail", "dessert", "snack", "food", "photo", "kids", "kid", "family", "dog", "dogs",
    "puppy", "pet", "pets", "adoption", "silent", "live", "local", "community", "city", "art", "arts",
    "book", "books", "music", "story", "reading", "youth", "open", "pop", "up", "pop-up", "mobile",
    "outdoor", "indoor", "event", "fundraiser", "sponsor", "sponsors", "donor", "volunteer", "taco",
    "juice", "tea", "hot", "cold", "garden", "rooftop", "lobby", "registration", "check-in", "auction",
    "raffle", "senior", "rescue", "shelter", "literacy", "school", "student", "students", "late", "night",
    "summer", "spring", "fall", "winter", "evening", "morning", "afternoon", "grand", "finale", "closing",
    "opening", "partner", "partners", "neighborhood", "neighbourhood", "nonprofit", "talk", "tv",
    "chat", "radio", "dance", "jazz", "rock", "folk", "indie", "local", "national",
}
# Two or more capitalized words, optionally bridged by "&", "and", "of", "the", "de", "la".
PHRASE = re.compile(r"\b[A-Z][\w'’&.-]*(?:\s+(?:(?:&|and|of|the|de|la)\s+)?[A-Z][\w'’&.-]*){1,5}\b")
# Sentence-initial words that are capitalized for grammar, not as part of a name.
LEAD_WORDS = {
    "join", "visit", "enjoy", "head", "meet", "then", "at", "with", "from", "guests", "toast", "celebrate",
    "featuring", "hosted", "sponsored", "presented", "welcome", "thanks", "thank", "partner", "our", "the",
    "a", "an", "after", "before", "during", "invite", "ask", "contact", "reach", "pitch", "pair", "book",
    "hire", "hold", "host", "start", "end", "finish", "close", "open", "explore", "try", "taste", "sip",
    "grab", "tour", "walk", "stroll", "listen", "watch", "partnering", "local", "and", "or", "plus",
}


def normalize(name: str) -> str:
    s = name.lower().replace("&", " and ").replace("’", "'")
    s = re.sub(r"[^\w\s']", " ", s)
    s = re.sub(r"\b(the)\b", " ", s)
    return " ".join(s.split())


@dataclass
class Grounder:
    allowed: dict[str, str]  # normalized -> canonical
    removed: list[dict[str, str]] = field(default_factory=list)
    verified: set[str] = field(default_factory=set)  # canonical Qloo names the text was checked against

    @classmethod
    def from_names(cls, names: list[str]) -> "Grounder":
        allowed: dict[str, str] = {}
        for n in names:
            if n and n.strip():
                allowed.setdefault(normalize(n), n.strip())
        return cls(allowed=allowed)

    def match(self, name: str) -> str | None:
        n = normalize(name)
        if not n:
            return None
        if n in self.allowed:
            return self.allowed[n]
        # Tolerate small variations: "Mohawk" vs "Mohawk Austin" (one contains the other, >= 5 chars).
        for key, canon in self.allowed.items():
            if len(n) >= 5 and len(key) >= 5 and (n in key or key in n):
                return canon
        return None

    def _log(self, name: str, where: str) -> None:
        self.removed.append({"name": name, "field": where})

    def text(self, value: Any, where: str, *, unwrap_unknown: bool = False) -> str:
        """Ground one text field. unwrap_unknown is for titles the LLM coins itself (the event name):
        an unknown marked phrase is unwrapped rather than removed, and still goes through the scan."""
        if not isinstance(value, str):
            return ""

        def repl(m: re.Match[str]) -> str:
            canon = self.match(m.group(1))
            if canon:
                self.verified.add(canon)
                return canon
            if unwrap_unknown:
                return m.group(1)
            self._log(m.group(1), where)
            return GENERIC

        out = MARK.sub(repl, value)
        out = self._scan_unmarked(out, where)
        return re.sub(r"\s{2,}", " ", out).strip()

    def _scan_unmarked(self, text: str, where: str) -> str:
        def generic(words: list[str]) -> bool:
            return all(w.lower().strip(".,'’") in COMMON or w.lower().strip(".") in ENTITY_SUFFIXES for w in words)

        def repl(m: re.Match[str]) -> str:
            phrase = m.group(0)
            words = phrase.split()
            last = words[-1].lower().strip(".")
            if last not in ENTITY_SUFFIXES:
                return phrase
            canon = self.match(phrase)
            if canon:
                self.verified.add(canon)
                return phrase
            # Allowed names can sit inside a longer capitalized run ("Visit Mohawk Austin Hall").
            for canon in self.allowed.values():
                if canon in phrase:
                    self.verified.add(canon)
                    return phrase
            # A sentence-initial word is capitalized for grammar, not because it is a name.
            start = m.start()
            sentence_start = start == 0 or bool(re.search(r"[.!?:;\n]\s*$", text[:start]))
            lead = ""
            if sentence_start and len(words) > 1 and words[0].lower() in LEAD_WORDS:
                lead, words = words[0] + " ", words[1:]
                canon = self.match(" ".join(words))
                if canon:
                    self.verified.add(canon)
                    return phrase
            if generic(words):
                return phrase
            self._log(" ".join(words), where)
            return lead + GENERIC

        return PHRASE.sub(repl, text)

    def ids(self, values: Any, allowed_ids: set[str], where: str) -> list[str]:
        out = []
        for v in values if isinstance(values, list) else []:
            if isinstance(v, str) and v in allowed_ids:
                out.append(v)
            elif v:
                self._log(str(v), where)
        return out
