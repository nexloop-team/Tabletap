"use client";

import { ChevronLeft, Info, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BRAND } from "@/config/brand";
import { createTracker } from "@/lib/analytics";
import { createTranslator, type Locale, type MessageKey } from "@/lib/i18n";
import { safeImageUrl } from "@/lib/venue/features";
import type { Menu, MenuItem } from "@/lib/venue/types";

const DIETARY_KEYS: Record<string, MessageKey> = {
  vegan: "dietary_vegan",
  vegetarian: "dietary_vegetarian",
  gluten_free: "dietary_gluten_free",
};

const BADGE_KEYS: Record<NonNullable<MenuItem["badges"]>[number], MessageKey> = {
  popular: "badge_popular",
  new: "badge_new",
  spicy: "badge_spicy",
  chef: "badge_chef",
};

/** Filter chips offered when at least one dish carries the tag, in this order. */
const DIET_FILTERS = ["vegan", "vegetarian", "gluten_free"] as const;

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "Gluten-free", "gluten_free" and "GLUTEN FREE" are the same tag. */
function dietKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/[\s-]+/g, "_");
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

/** Vegan dishes count as vegetarian too. */
function fitsDiets(item: MenuItem, diets: string[]): boolean {
  if (diets.length === 0) return true;
  const tags = item.dietaryTags.map(dietKey);
  return diets.every((diet) => tags.includes(diet) || (diet === "vegetarian" && tags.includes("vegan")));
}

interface MenuViewProps {
  venueId: string;
  venueName: string;
  currencyCode: string;
  menus: Menu[];
  locale: Locale;
  source: string;
  backHref: string;
  /** Pro venues can hide the Tabletap footer line. */
  showPoweredBy: boolean;
}

export function MenuView({ venueId, venueName, currencyCode, menus, locale, source, backHref, showPoweredBy }: MenuViewProps) {
  const { t, tf } = useMemo(() => createTranslator(locale), [locale]);
  const track = useMemo(() => createTracker({ venueId, source, page: "menu" }), [venueId, source]);
  const formatPrice = useMemo(() => priceFormatter(locale, currencyCode), [locale, currencyCode]);
  const [menuIndex, setMenuIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [openExplainer, setOpenExplainer] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const menu = menus[menuIndex] ?? null;
  const sections = useMemo(() => (menu ? [...menu.sections].sort((a, b) => a.sortOrder - b.sortOrder).filter((s) => s.items.length > 0) : []), [menu]);
  const allergens = useMemo(() => [...new Set(sections.flatMap((s) => s.items.flatMap((i) => i.allergens.map((a) => a.toLowerCase()))))].sort(), [sections]);
  const dietOptions = useMemo(() => {
    const present = new Set(sections.flatMap((s) => s.items.flatMap((i) => i.dietaryTags.map(dietKey))));
    return DIET_FILTERS.filter((diet) => present.has(diet) || (diet === "vegetarian" && present.has("vegan")));
  }, [sections]);

  useEffect(() => {
    track("menu_viewed", { menus: menus.length });
  }, [track, menus.length]);

  const needle = query.trim().toLowerCase();

  const { visibleSections, hiddenByFilter } = useMemo(() => {
    const isFiltered = (item: MenuItem) => item.allergens.some((a) => excluded.includes(a.toLowerCase())) || !fitsDiets(item, diets);
    const searched = sections.map((section) => ({ ...section, items: section.items.filter((item) => matches(item, needle)) }));
    return {
      visibleSections: searched.map((section) => ({ ...section, items: section.items.filter((item) => !isFiltered(item)) })).filter((section) => section.items.length > 0),
      hiddenByFilter: searched.reduce((count, section) => count + section.items.filter(isFiltered).length, 0),
    };
  }, [sections, needle, excluded, diets]);

  /** Available specials that pass the filters, in menu order. */
  const specials = useMemo(
    () => sections.flatMap((s) => s.items).filter((item) => item.featured && item.isAvailable && !item.allergens.some((a) => excluded.includes(a.toLowerCase())) && fitsDiets(item, diets)),
    [sections, excluded, diets],
  );

  // Highlight the section chip for whichever section is at the top of the screen.
  useEffect(() => {
    const elements = visibleSections.map((s) => document.getElementById(`section-${s.id}`)).filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveSection(top.target.id.replace(/^section-/, ""));
      },
      { rootMargin: "-64px 0px -65% 0px" },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visibleSections]);

  function toggleAllergen(allergen: string) {
    const next = excluded.includes(allergen) ? excluded.filter((a) => a !== allergen) : [...excluded, allergen];
    setExcluded(next);
    track("menu_allergen_filter_changed", { excluded: next.join(",") });
  }

  function toggleDiet(diet: string) {
    const next = diets.includes(diet) ? diets.filter((d) => d !== diet) : [...diets, diet];
    setDiets(next);
    track("menu_diet_filter_changed", { diets: next.join(",") });
  }

  function jumpToItem(itemId: string) {
    document.getElementById(`item-${itemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    track("menu_special_tapped", { item_id: itemId });
  }

  function jumpTo(sectionId: string) {
    document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(sectionId);
    track("menu_section_jump", { section_id: sectionId });
  }

  const current = activeSection ?? visibleSections[0]?.id ?? null;

  return (
    <div className="menu-page">
      <main className="page-wrapper menu-body">
        <a className="menu-back" href={backHref}>
          <ChevronLeft aria-hidden />
          <span>{venueName}</span>
          <span className="visually-hidden">{t("menu_back")}</span>
        </a>

        {!menu ? (
          <div className="error-container">
            <div className="error-box">{t("menu_empty")}</div>
          </div>
        ) : (
          <>
            <header className="menu-head">
              <h1>{menus.length > 1 ? menu.name : t("menu_title")}</h1>
              {menu.welcomeText?.trim() && <p className="menu-welcome">{menu.welcomeText.trim()}</p>}
            </header>

            {menus.length > 1 && (
              <div className="menu-chip-row menu-tabs" role="tablist">
                {menus.map((m, i) => (
                  <button key={m.id} type="button" role="tab" aria-selected={i === menuIndex} className="menu-chip" onClick={() => setMenuIndex(i)}>
                    {m.name}
                  </button>
                ))}
              </div>
            )}

            <label className="menu-search">
              <Search aria-hidden />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("menu_search")} aria-label={t("menu_search")} />
            </label>

            {visibleSections.length > 1 && (
              <nav className="menu-jump" aria-label={t("menu_sections")}>
                {visibleSections.map((section) => (
                  <button key={section.id} type="button" className="menu-chip" aria-current={section.id === current ? "true" : undefined} onClick={() => jumpTo(section.id)}>
                    {section.name}
                  </button>
                ))}
              </nav>
            )}

            {(allergens.length > 0 || dietOptions.length > 0) && (
              <div className="menu-filters">
                {allergens.length > 0 && (
                  <button type="button" className="menu-pill" aria-expanded={filterOpen} aria-controls="menu-filter" onClick={() => setFilterOpen((open) => !open)}>
                    <SlidersHorizontal aria-hidden />
                    {excluded.length > 0 ? tf("menu_filter_count", { count: excluded.length }) : t("menu_filter")}
                  </button>
                )}
                {excluded.map((allergen) => (
                  <button key={allergen} type="button" className="menu-pill on" aria-label={tf("menu_filter_remove", { allergen: titleCase(allergen) })} onClick={() => toggleAllergen(allergen)}>
                    {tf("menu_no_allergen", { allergen: allergen })}
                    <X aria-hidden />
                  </button>
                ))}
                {dietOptions.map((diet) => (
                  <button key={diet} type="button" className={`menu-pill${diets.includes(diet) ? " on" : ""}`} aria-pressed={diets.includes(diet)} onClick={() => toggleDiet(diet)}>
                    {t(DIETARY_KEYS[diet])}
                  </button>
                ))}
              </div>
            )}

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

            {specials.length > 0 && !needle && (
              <section className="menu-specials" aria-label={t("menu_specials")}>
                <h2>{t("menu_specials")}</h2>
                <div className="menu-specials-row">
                  {specials.map((item) => {
                    const image = safeImageUrl(item.imageUrl);
                    return (
                      <button key={item.id} type="button" className="menu-special" onClick={() => jumpToItem(item.id)}>
                        <span className="menu-special-photo">
                          {/* eslint-disable-next-line @next/next/no-img-element -- merchant image on any host */}
                          {image && <img src={image} alt="" loading="lazy" />}
                        </span>
                        <span className="menu-special-text">
                          <span className="menu-special-name">{item.name}</span>
                          <span className="menu-special-price">{formatPrice(item.priceInPence)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
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
                      const explainer = item.explainer?.trim();
                      const explained = openExplainer === item.id;
                      const hasTags = !item.isAvailable || (item.badges ?? []).length > 0 || item.dietaryTags.length > 0 || (menu.showCalories && typeof item.calories === "number");
                      return (
                        <li key={item.id} id={`item-${item.id}`} className={`menu-item${item.isAvailable ? "" : " unavailable"}`}>
                          {image && (
                            // eslint-disable-next-line @next/next/no-img-element -- merchant image on any host
                            <img className="menu-item-img" src={image} alt="" loading="lazy" />
                          )}
                          <div className="menu-item-text">
                            <div className="menu-item-head">
                              <h3>{item.name}</h3>
                              <span className="menu-price">{formatPrice(item.priceInPence)}</span>
                            </div>
                            {item.description && <p className="menu-desc">{item.description}</p>}
                            {hasTags && (
                              <div className="menu-tags">
                                {!item.isAvailable && <span className="menu-tag sold-out">{t("menu_unavailable")}</span>}
                                {(item.badges ?? []).map((badge) => (
                                  <span key={badge} className="menu-tag badge">
                                    {t(BADGE_KEYS[badge])}
                                  </span>
                                ))}
                                {item.dietaryTags.map((tag) => (
                                  <span key={tag} className="menu-tag diet">
                                    {DIETARY_KEYS[dietKey(tag)] ? t(DIETARY_KEYS[dietKey(tag)]) : titleCase(tag)}
                                  </span>
                                ))}
                                {menu.showCalories && typeof item.calories === "number" && <span className="menu-tag diet">{tf("menu_kcal", { kcal: item.calories })}</span>}
                              </div>
                            )}
                            {item.allergens.length > 0 && <p className="menu-allergens">{tf("menu_contains", { allergens: item.allergens.map(titleCase).join(", ") })}</p>}
                            {explainer && (
                              <>
                                <button
                                  type="button"
                                  className="menu-info-btn"
                                  aria-expanded={explained}
                                  aria-controls={`explainer-${item.id}`}
                                  onClick={() => {
                                    setOpenExplainer(explained ? null : item.id);
                                    if (!explained) track("menu_explainer_opened", { item_id: item.id });
                                  }}
                                >
                                  <Info aria-hidden />
                                  {t("menu_whats_this")}
                                </button>
                                {explained && (
                                  <div id={`explainer-${item.id}`} className="menu-explainer">
                                    <p>{explainer}</p>
                                    <p className="menu-explainer-note">{t("menu_explainer_allergens")}</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}

            <p className="menu-note small">
              {t("menu_allergen_note")}
              {showPoweredBy && (
                <>
                  <br />
                  {tf("powered_by", { brand: BRAND.name })}
                </>
              )}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
