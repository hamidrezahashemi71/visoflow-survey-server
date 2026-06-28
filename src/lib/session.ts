import type { Attribution } from "../schemas/attribution";

// First-touch attribution columns for a new Session row. Set only on create
// (never overwritten on later /track or /submit calls).
export function attributionCreateData(attribution: Attribution | null | undefined) {
  return {
    campaignAid: attribution?.campaignAid ?? null,
    code: attribution?.code ?? null,
    utmSource: attribution?.utmSource ?? null,
    utmMedium: attribution?.utmMedium ?? null,
    utmCampaign: attribution?.utmCampaign ?? null,
    utmContent: attribution?.utmContent ?? null,
    utmTerm: attribution?.utmTerm ?? null,
    referrer: attribution?.referrer ?? null,
    landingPath: attribution?.landingPath ?? null,
  };
}
