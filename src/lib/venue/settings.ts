import { z } from "zod";

/**
 * Owner-only venue settings, stored in `venues.settings`. Unlike the venue
 * config these never reach the guest page.
 */

export const venueSettingsSchema = z.object({
  stampPolicy: z.object({
    /** Minimum minutes between stamp visits for one card; staff can override. */
    cooldownMinutes: z.number().int().min(0).max(24 * 60),
  }),
  automations: z.object({
    /** Service email when a stamp unlocks a reward. */
    rewardReady: z.boolean(),
    birthday: z.object({ enabled: z.boolean(), offer: z.string().trim().max(200) }),
    winBack: z.object({ enabled: z.boolean(), days: z.number().int().min(7).max(365), offer: z.string().trim().max(200) }),
  }),
});

export type VenueSettings = z.output<typeof venueSettingsSchema>;

export const DEFAULT_SETTINGS: VenueSettings = {
  stampPolicy: { cooldownMinutes: 30 },
  automations: {
    rewardReady: true,
    birthday: { enabled: false, offer: "A free coffee on us this week" },
    winBack: { enabled: false, days: 30, offer: "Come back this week for a free pastry with any drink" },
  },
};

/** Saved settings over the defaults, section by section, so new fields get sensible values. */
export function resolveSettings(raw: unknown): VenueSettings {
  const saved = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof VenueSettings, Record<string, unknown>>>;
  const merged = {
    stampPolicy: { ...DEFAULT_SETTINGS.stampPolicy, ...saved.stampPolicy },
    automations: {
      ...DEFAULT_SETTINGS.automations,
      ...saved.automations,
      birthday: { ...DEFAULT_SETTINGS.automations.birthday, ...(saved.automations?.birthday as object | undefined) },
      winBack: { ...DEFAULT_SETTINGS.automations.winBack, ...(saved.automations?.winBack as object | undefined) },
    },
  };
  const result = venueSettingsSchema.safeParse(merged);
  return result.success ? result.data : DEFAULT_SETTINGS;
}

export const venueSettingsPatch = venueSettingsSchema.partial();
export type VenueSettingsPatch = z.input<typeof venueSettingsPatch>;
