"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import type { VenueConfig } from "@/lib/venue/schema";

/**
 * Local draft of some top-level sections of a venue's config. Saving sends
 * just those sections; the server merges and validates the whole config.
 */
export function useVenueDraft<T extends Partial<VenueConfig>>(venueId: string, initial: T) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setError(null);
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await dashboardApi.updateVenue(venueId, { config: draft });
      setSaved(draft);
      setVersion((v) => v + 1);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [venueId, draft, router]);

  const reset = useCallback(() => {
    setDraft(saved);
    setError(null);
  }, [saved]);

  /** `version` bumps after each save, so a preview iframe keyed on it reloads. */
  return { draft, setDraft, update, dirty, saving, error, save, reset, version };
}
