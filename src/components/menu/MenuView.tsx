"use client";

import { ChefHat, ChevronLeft, Flame, Info, Leaf, Search, SlidersHorizontal, Sparkles, Sprout, Star, WheatOff, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LanguageSwitch } from "@/components/landing/LanguageSwitch";
import { VenueHeader } from "@/components/landing/VenueHeader";
import { createTracker } from "@/lib/analytics";
import { createTranslator, type Locale, type MessageKey } from "@/lib/i18n";
import { computeTheme } from "@/lib/theme";
import { safeImageUrl } from "@/lib/venue/features";
import type { Menu, MenuItem, VenueBranding } from "@/lib/venue/types";
import { DishSheet } from "./DishSheet";

type Badge = NonNullable<MenuItem["badges"]>[number];

const BADGES: Record<Badge, { key: MessageKey; icon: LucideIcon }> = {
  popular: { key: "badge_popular", icon: Star },
  new: { key: "badge_new", icon: Sparkles },
  spicy: { key: "badge_spicy", icon: Flame },
  chef: { key: "badge_chef", icon: ChefHat },
};

const DIETS: Record<string, { key: MessageKey; icon: LucideIcon }> = {
  vegan: { key: "dietary_vegan", icon: Leaf },
  vegetarian: { key: "dietary_vegetarian", icon: Sprout },
  gluten_free: { key: "dietary_gluten_free", icon: WheatOff },
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
  branding: VenueBranding;
  currencyCode: string;
  menus: Menu[];
  locale: Locale;
  source: string;
  backHref: string;
}

export function MenuView({ venueId, venueName, branding, currencyCode, menus, locale, source, backHref }: MenuViewProps) {
  const { t, tf } = useMemo(() => createTranslator(locale), [locale]);
  const track = useMemo(() => createTracker({ venueId, source, page: "menu" }), [venueId, source]);
  const formatPrice = useMemo(() => priceFormatter(locale, currencyCode), [locale, currencyCode]);
  const style = useMemo(() => computeTheme(branding).style, [branding]);
  const hasCover = !!safeImageUrl(branding.coverImageUrl);
  const [menuIndex, setMenuIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [openDish, setOpenDish] = useState<MenuItem | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const closeDish = useCallback(() => setOpenDish(null), []);

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

  /** Today's specials, or the most popular dishes when nothing is marked special. Both respect the filters. */
  const highlights = useMemo(() => {
    const allowed = (item: MenuItem) => item.isAvailable && !item.allergens.some((a) => excluded.includes(a.toLowerCase())) && fitsDiets(item, diets);
    const all = sections.flatMap((s) => s.items).filter(allowed);
    const specials = all.filter((item) => item.featured);
    if (specials.length > 0) return { title: t("menu_specials"), items: specials };
    return { title: t("menu_popular"), items: all.filter((item) => item.badges?.includes("popular")) };
  }, [sections, excluded, diets, t]);

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

  function showDish(item: MenuItem, from: string) {
    setOpenDish(item);
    track("menu_item_opened", { item_id: item.id, from, has_explainer: !!item.explainer?.trim() });
  }

  function jumpTo(sectionId: string) {
    document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(sectionId);
    track("menu_section_jump", { section_id: sectionId });
  }

  /** Badges, dietary tags and kcal for a dish, in the card colours. */
  function tagList(item: MenuItem) {
    const showKcal = !!menu?.showCalories && typeof item.calories === "number";
    if (!(item.badges ?? []).length && !item.dietaryTags.length && !showKcal) return null;
    return (
      <span className="menu-tags">
        {(item.badges ?? []).map((badge) => {
          const { key, icon: Icon } = BADGES[badge];
          return (
            <span key={badge} className={`menu-tag badge ${badge}`}>
              <Icon aria-hidden />
              {t(key)}
            </span>
          );
        })}
        {item.dietaryTags.map((tag) => {
          const diet = DIETS[dietKey(tag)];
          const Icon = diet?.icon;
          return (
            <span key={tag} className={`menu-tag diet ${dietKey(tag)}`}>
              {Icon && <Icon aria-hidden />}
              {diet ? t(diet.key) : titleCase(tag)}
            </span>
          );
        })}
        {showKcal && <span className="menu-tag kcal">{tf("menu_kcal", { kcal: item.calories as number })}</span>}
      </span>
    );
  }

  const current = activeSection ?? visibleSections[0]?.id ?? null;

  return (
    <div className="menu-page landing" data-style={style ?? undefined} data-layout={menu?.layout ?? "list"} data-header={branding.headerStyle ?? "cover"} data-shape={branding.buttonShape ?? "rounded"}>
      <main className="page-wrapper menu-body">
        <VenueHeader
          branding={branding}
          name={venueName}
          tagline={false}
          overlay={
            <a className={`menu-back${hasCover ? " on-cover" : ""}`} href={backHref}>
              <ChevronLeft aria-hidden />
              <span>{t("menu_back")}</span>
            </a>
          }
        />

        {!menu ? (
          <div className="menu-empty">
            <h2>{t("menu_title")}</h2>
            <p>{t("menu_empty")}</p>
          </div>
        ) : (
          <>
            <div className="menu-head">
              <h2 className="menu-title">{menus.length > 1 ? menu.name : t("menu_title")}</h2>
              {menu.welcomeText?.trim() && <p className="menu-welcome">{menu.welcomeText.trim()}</p>}
            </div>

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
                    {tf("menu_no_allergen", { allergen })}
                    <X aria-hidden />
                  </button>
                ))}
                {dietOptions.map((diet) => (
                  <button key={diet} type="button" className={`menu-pill${diets.includes(diet) ? " on" : ""}`} aria-pressed={diets.includes(diet)} onClick={() => toggleDiet(diet)}>
                    {t(DIETS[diet].key)}
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

            {highlights.items.length > 0 && !needle && (
              <section className="menu-specials" aria-label={highlights.title}>
                <h2>{highlights.title}</h2>
                <div className="menu-specials-row">
                  {highlights.items.map((item) => {
                    const image = safeImageUrl(item.imageUrl);
                    return (
                      <button key={item.id} type="button" className="menu-special" onClick={() => showDish(item, "highlights")}>
                        <span className={`menu-special-photo${image ? "" : " placeholder"}`} aria-hidden>
                          {/* eslint-disable-next-line @next/next/no-img-element -- merchant image on any host */}
                          {image ? <img src={image} alt="" loading="lazy" /> : item.name.trim().charAt(0)}
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
                  <div className="menu-section-head">
                    <h2>{section.name}</h2>
                    <span>{section.items.length === 1 ? t("menu_items_one") : tf("menu_items", { count: section.items.length })}</span>
                  </div>
                  {section.description?.trim() && <p className="menu-section-desc">{section.description.trim()}</p>}
                  <ul className="menu-list">
                    {section.items.map((item) => {
                      const image = safeImageUrl(item.imageUrl);
                      return (
                        <li key={item.id} id={`item-${item.id}`} className={`menu-item${item.isAvailable ? "" : " unavailable"}`}>
                          <button type="button" className="menu-item-open" aria-haspopup="dialog" onClick={() => showDish(item, "list")}>
                            <span className="menu-item-text">
                              <span className="menu-item-head">
                                <span className="menu-item-name">{item.name}</span>
                                {/* The classic layout prints the price on the name line, with dotted leaders. */}
                                <span className="menu-leader" aria-hidden />
                                <span className="menu-price head-price">{formatPrice(item.priceInPence)}</span>
                              </span>
                              {item.description && <span className="menu-desc">{item.description}</span>}
                              <span className="menu-item-foot">
                                <span className="menu-price foot-price">{formatPrice(item.priceInPence)}</span>
                                {!item.isAvailable && <span className="menu-tag sold-out">{t("menu_unavailable")}</span>}
                              </span>
                              {tagList(item)}
                              {item.allergens.length > 0 && <span className="menu-allergens">{tf("menu_contains", { allergens: item.allergens.map(titleCase).join(", ") })}</span>}
                              {item.explainer?.trim() && (
                                <span className="menu-whats">
                                  <Info aria-hidden /> {t("menu_whats_this")}
                                </span>
                              )}
                            </span>
                            {/* eslint-disable-next-line @next/next/no-img-element -- merchant image on any host */}
                            {image && <img className="menu-item-thumb" src={image} alt="" loading="lazy" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}

            <LanguageSwitch locale={locale} />
            <p className="menu-note small">
              {t("menu_allergen_note")}
            </p>
          </>
        )}
      </main>

      <DishSheet
        item={openDish}
        price={openDish ? formatPrice(openDish.priceInPence) : ""}
        tags={openDish ? tagList(openDish) : null}
        details={openDish && openDish.allergens.length > 0 ? [tf("menu_contains", { allergens: openDish.allergens.map(titleCase).join(", ") })] : []}
        labels={{ close: t("close"), whatsThis: t("menu_whats_this"), explainerNote: t("menu_explainer_allergens"), soldOut: t("menu_unavailable") }}
        onClose={closeDish}
      />
    </div>
  );
}
