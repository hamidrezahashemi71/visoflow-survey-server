// trackId format: {project}-{language}-{uid}-{type} (e.g. visoflow-ir-abc123-survey).
// The uid may itself contain dashes, so we take the first two and last segments.
export function parseTrackId(trackId: string): {
  project: string;
  language: string;
  type: string;
} {
  const parts = trackId.split("-");
  return {
    project: parts[0] || "unknown",
    language: parts[1] || "unknown",
    type: parts.length > 2 ? (parts[parts.length - 1] ?? "unknown") : "unknown",
  };
}
