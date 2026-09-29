"use client";

import { ChevronLeft, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createTracker } from "@/lib/analytics";
import { createTranslator, type Locale, type MessageKey } from "@/lib/i18n";
import { safeImageUrl } from "@/lib/venue/features";
import type { Menu, MenuItem } from "@/lib/venue/types";

const DIETARY_KEYS: Record<string, MessageKey> = {
  vegan: "dietary_vegan",
  vegetarian: "dietary_vegetarian",
  gluten_free: "dietary_gluten_free",
  "gluten-free": "dietary_gluten_free",
};

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function priceFormatter(locale: string, currency: string): (pence: number) => string {
  try {
    const format = new Intl.NumberFormat(locale, { style: "currency", currency });
    return (pence) => format.format(pence / 100);
  } catch {
    return (pence) => (pence / 100).toFixed(2);
  }
}

function matches(item: MenuItem, query: string): boolean {
  if (!query) return true;
  return `${item.name} ${item.description ?? ""}`.toLowerCase().includes(query);
}

interface MenuViewProps {
  venueId: string;
  venueName: string;
  currencyCode: string;
  menus: Menu[];
  locale: Locale;
  source: string;
  backHref: string;
}

export function MenuView({ venueId, venueName, currencyCode, menus, locale, source, backHref }: MenuViewProps) {
  const { t, tf } = useMemo(() => createTranslator(locale), [locale]);
  const track = useMemo(() => createTracker({ venueId, source, page: "menu" }), [venueId, source]);
  const formatPrice = useMemo(() => priceFormatter(locale, currencyCode), [locale, currencyCode]);
  const [menuIndex, setMenuIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const menu = menus[menuIndex] ?? null;
  const sections = useMemo(() => (menu ? [...menu.sections].sort((a, b) => a.sortOrder - b.sortOrder).filter((s) => s.items.length > 0) : []), [menu]);
  const allergens = useMemo(() => [...new Set(sections.flatMap((s) => s.items.flatMap((i) => i.allergens.map((a) => a.toLowerCase()))))].sort(), [sections]);

  useEffect(() => {
    track("menu_viewed", { menus: menus.length });
  }, [track, menus.length]);

  const needle = query.trim().toLowerCase();
  const { visibleSections, hiddenByFilter } = useMemo(() => {
    const isExcluded = (item: MenuItem) => item.allergens.some((a) => excluded.includes(a.toLowerCase()));
    const searched = sections.map((section) => ({ ...section, items: section.items.filter((item) => matches(item, needle)) }));
    return {
      visibleSections: searched.map((section) => ({ ...section, items: section.items.filter((item) => !isExcluded(item)) })).filter((section) => section.items.length > 0),
      hiddenByFilter: searched.reduce((count, section) => count + section.items.filter(isExcluded).length, 0),
    };
  }, [sections, needle, excluded]);

  function toggleAllergen(allergen: string) {
    const next = excluded.includes(allergen) ? excluded.filter((a) => a !== allergen) : [...excluded, allergen];
    setExcluded(next);
    track("menu_allergen_filter_changed", { excluded: next.join(",") });
  }

  function jumpTo(sectionId: string) {
    document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    track("menu_section_jump", { section_id: sectionId });
  }

  return (
    <div className="menu-page">
      <header className="menu-bar">
        <a className="menu-bar-btn" href={backHref} aria-label={t("menu_back")}>
          <ChevronLeft aria-hidden />
        </a>
        <h1>{venueName}</h1>
        {allergens.length > 0 ? (
          <button
            type="button"
            className={`menu-bar-btn${excluded.length ? " active" : ""}`}
            aria-label={t("menu_filter")}
            aria-expanded={filterOpen}
            aria-controls="menu-filter"
            onClick={() => setFilterOpen((open) => !open)}
          >
            <SlidersHorizontal aria-hidden />
            {excluded.length > 0 && <span className="menu-badge">{excluded.length}</span>}
          </button>
        ) : (
          <span className="menu-bar-btn" aria-hidden />
        )}
      </header>

      <main className="page-wrapper menu-body">
        {!menu ? (
          <div className="error-container">
            <div className="error-box">{t("menu_empty")}</div>
          </div>
        ) : (
          <>
            {menus.length > 1 && (
              <div className="menu-chip-row menu-tabs" role="tablist">
                {menus.map((m, i) => (
                  <button key={m.id} type="button" role="tab" aria-selected={i === menuIndex} className="menu-chip" onClick={() => setMenuIndex(i)}>
                    {m.name}
                  </button>
                ))}
              </div>
            )}

            {menu.welcomeText?.trim() && <p className="menu-welcome">{menu.welcomeText.trim()}</p>}

            {filterOpen && allergens.length > 0 && (
              <section id="menu-filter" className="menu-filter">
                <h2>{t("menu_filter_title")}</h2>
                <div className="menu-chip-row wrap">
                  {allergens.map((allergen) => (
                    <button key={allergen} type="button" className="menu-chip" aria-pressed={excluded.includes(allergen)} onClick={() => toggleAllergen(allergen)}>
                      {titleCase(allergen)}
                    </button>
                  ))}
                </div>
                {excluded.length > 0 && (
                  <button type="button" className="menu-link-btn" onClick={() => setExcluded([])}>
                    {t("menu_filter_clear")}
                  </button>
                )}
              </section>
            )}

            <label className="menu-search">
              <Search aria-hidden />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("menu_search")} aria-label={t("menu_search")} />
            </label>

            {sections.length > 1 && !needle && (
              <nav className="menu-chip-row" aria-label={t("menu_sections")}>
                {sections.map((section) => (
                  <button key={section.id} type="button" className="menu-chip" onClick={() => jumpTo(section.id)}>
                    {section.name}
                  </button>
                ))}
              </nav>
            )}

            {hiddenByFilter > 0 && <p className="menu-note">{tf("menu_hidden_count", { count: hiddenByFilter })}</p>}

            {visibleSections.length === 0 ? (
              <p className="menu-note">{t("menu_no_results")}</p>
            ) : (
              visibleSections.map((section) => (
                <section key={section.id} id={`section-${section.id}`} className="menu-section">
                  <h2>{section.name}</h2>
                  <ul>
                    {section.items.map((item) => {
                      const image = safeImageUrl(item.imageUrl);
                      return (
                        <li key={item.id} className={`menu-item${item.isAvailable ? "" : " unavailable"}`}>
                          <div className="menu-item-text">
                            <div className="menu-item-head">
                              <h3>{item.name}</h3>
                              <span className="menu-price">{formatPrice(item.priceInPence)}</span>
                            </div>
                            {item.description && <p className="menu-desc">{item.description}</p>}
                            <div className="menu-tags">
                              {!item.isAvailable && <span className="menu-tag muted">{t("menu_unavailable")}</span>}
                              {item.dietaryTags.map((tag) => (
                                <span key={tag} className="menu-tag diet">
                                  {DIETARY_KEYS[tag.toLowerCase()] ? t(DIETARY_KEYS[tag.toLowerCase()]) : titleCase(tag)}
                                </span>
                              ))}
                              {menu.showCalories && typeof item.calories === "number" && <span className="menu-tag muted">{tf("menu_kcal", { kcal: item.calories })}</span>}
                            </div>
                            {item.allergens.length > 0 && <p className="menu-allergens">{tf("menu_contains", { allergens: item.allergens.map(titleCase).join(", ") })}</p>}
                          </div>
                          {image && (
                            // eslint-disable-next-line @next/next/no-img-element -- merchant image on any host
                            <img className="menu-item-img" src={image} alt="" loading="lazy" />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}

            <p className="menu-note small">{t("menu_allergen_note")}</p>
          </>
        )}
      </main>
    </div>
  );
}
