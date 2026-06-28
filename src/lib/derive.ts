import type { Answers } from "../schemas/submit";

// Maps the curated Submission columns to the frontend questionKeys they come
// from. These keys are ASSUMPTIONS based on the survey design — adjust them here
// (one place) to match the real frontend questionKeys when wiring up.
const QUESTION_KEYS = {
  region: "region",
  staffCount: "staffCount",
  weeklyVolume: "weeklyVolume",
  avgPrice: "avgPrice",
  noShows: "noShows",
  deposit: "deposit",
  triedSoftware: "triedSoftware",
  services: "services",
  pilotInterest: "pilotInterest",
  role: "role",
} as const;

// For a select the meaningful answer is the chosen option (`aid`); for an input
// it's the typed `value`. Prefer a non-empty value, else fall back to aid.
function pick(answers: Answers, key: string): string | null {
  const answer = answers[key];
  if (!answer) return null;
  const value = answer.value;
  if (value !== undefined && value !== null && String(value).trim() !== "") {
    return String(value);
  }
  return answer.aid ?? null;
}

// Services may be a multi-select. We accept a comma/pipe-separated value (or a
// single aid) and split into a clean string[].
function pickServices(answers: Answers): string[] {
  const raw = pick(answers, QUESTION_KEYS.services);
  if (!raw) return [];
  return raw
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export type CuratedColumns = {
  region: string | null;
  staffCount: string | null;
  weeklyVolume: string | null;
  avgPrice: string | null;
  noShows: string | null;
  deposit: string | null;
  triedSoftware: string | null;
  services: string[];
  pilotInterest: string | null;
  role: string | null;
};

// Extracts the denormalized market-validation columns from the full answers map.
export function deriveCuratedColumns(answers: Answers): CuratedColumns {
  return {
    region: pick(answers, QUESTION_KEYS.region),
    staffCount: pick(answers, QUESTION_KEYS.staffCount),
    weeklyVolume: pick(answers, QUESTION_KEYS.weeklyVolume),
    avgPrice: pick(answers, QUESTION_KEYS.avgPrice),
    noShows: pick(answers, QUESTION_KEYS.noShows),
    deposit: pick(answers, QUESTION_KEYS.deposit),
    triedSoftware: pick(answers, QUESTION_KEYS.triedSoftware),
    services: pickServices(answers),
    pilotInterest: pick(answers, QUESTION_KEYS.pilotInterest),
    role: pick(answers, QUESTION_KEYS.role),
  };
}
