"use client";

import { ArrowDown, ArrowUp, ChevronDown, GripVertical, List, Loader2, Plus, ScrollText, Sparkles, Trash2, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useLivePreview } from "@/lib/live-preview";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { ALLERGENS, DIETARY_TAGS, LINK_LABEL_TOKENS, MENU_BADGES, type VenueConfig } from "@/lib/venue/schema";
import type { MenuLayout } from "@/lib/venue/types";
import { useConfirm } from "./confirm";
import { MenuAiTools } from "./MenuAiTools";
import { Card, Field, ImageField, newClientId, SaveBar, SwitchRow, TextField } from "./ui";
import { EditorPanel, EditorTabs, PreviewPane, useEditorTab, type EditorTab } from "./EditorFrame";
import { MobilePreview } from "./MobilePreview";
import { moveTo, useDragReorder } from "./useDragReorder";
import { useVenueDraft } from "./useVenueDraft";

const BADGE_LABELS: Record<(typeof MENU_BADGES)[number], string> = { popular: "Popular", new: "New", spicy: "Spicy", chef: "Chef's pick" };

type Menu = VenueConfig["menus"][number];
type Section = Menu["sections"][number];
type Item = Section["items"][number];

const DIETARY_LABELS: Record<(typeof DIETARY_TAGS)[number], string> = { vegan: "Vegan", vegetarian: "Vegetarian", gluten_free: "Gluten-free" };
const BUTTON_LABELS: Record<(typeof LINK_LABEL_TOKENS)[number], string> = {
  view_menu: "View menu",
  view_price_list: "View price list",
  our_services: "Our services",
  book_now: "Book now",
  visit_website: "Visit website",
  order_online: "Order online",
};

const MENU_LAYOUTS: { value: MenuLayout; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "list", label: "List", hint: "A card per dish, photo beside it", icon: List },
  { value: "classic", label: "Classic", hint: "Like a printed menu", icon: ScrollText },
];

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function MenuEditor({
  venueId,
  menus,
  currencyCode,
  ai,
  importLimits,
  previewUrl,
}: {
  venueId: string;
  /** The hosted menu as guests see it, in preview mode. */
  previewUrl: string;
  menus: VenueConfig["menus"];
  currencyCode: string;
  /** "off": AI isn't configured on this server. */
  ai: "on" | "off";
  importLimits: { maxImages: number; pdf: boolean };
}) {
  const editor = useVenueDraft<{ menus: VenueConfig["menus"] }>(venueId, { menus });
  const ask = useConfirm();
  const list = editor.draft.menus;
  const [selected, setSelected] = useState(0);
  // Imported items whose allergens came from the AI, until the owner opens them.
  const [toCheck, setToCheck] = useState<Set<string>>(() => new Set());
  const menu = list[Math.min(selected, list.length - 1)];
  const money = new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode });
  const external = menu ? menu.externalUrl !== null && menu.externalUrl !== undefined : false;
  const tabs: EditorTab[] = [
    { id: "dishes", label: "Dishes" },
    { id: "settings", label: "Settings" },
    ...(ai !== "off" && !external ? [{ id: "import", label: "Import" }] : []),
  ];
  const [tab, setTab] = useEditorTab(tabs);

  // The preview frame shows the draft, opened on the menu being edited.
  const previewDraft = useMemo(() => ({ menus: list, menuId: menu?.id ?? null }), [list, menu?.id]);
  useLivePreview(previewDraft);

  const setMenus = (next: VenueConfig["menus"]) => editor.update("menus", next);
  const setMenu = (patch: Partial<Menu>) => setMenus(list.map((m) => (m === menu ? { ...m, ...patch } : m)));
  const setSections = (sections: Section[]) => setMenu({ sections: sections.map((s, i) => ({ ...s, sortOrder: i })) });

  function addMenu() {
    setMenus([...list, { id: newClientId("menu"), name: `Menu ${list.length + 1}`, sections: [] }]);
    setSelected(list.length);
  }

  async function removeMenu() {
    if (!menu) return;
    if (!(await ask({ title: `Delete “${menu.name}”?`, body: "Every section and item on this menu goes too. Nothing is saved until you press Save changes.", confirmLabel: "Delete menu", danger: true }))) return;
    setMenus(list.filter((m) => m !== menu));
    setSelected(0);
  }

  const dishCount = menu?.sections.reduce((n, s) => n + s.items.length, 0) ?? 0;

  return (
    <div className="editor-grid">
      <div>
        <MobilePreview src={previewUrl} label="Preview your menu" dirty={editor.dirty} />
        <div className="menu-switcher" role="group" aria-label="Menus">
          {list.map((m, index) => (
            <button key={m.id} type="button" className="chip" aria-pressed={m === menu} onClick={() => setSelected(index)}>
              {m.name || "Untitled"}
            </button>
          ))}
          <button type="button" className="chip chip-add" onClick={addMenu} disabled={list.length >= 10}>
            <Plus aria-hidden /> New menu
          </button>
        </div>

        {!menu ? (
          <Card>
            <div className="empty">
              <p>No menus yet.</p>
              <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={addMenu}>
                <Plus aria-hidden /> Create a menu
              </button>
            </div>
          </Card>
        ) : (
          <>
            <EditorTabs tabs={tabs} active={tab} onSelect={setTab} label="Menu settings" />

            {tab === "dishes" && (
              <EditorPanel id="dishes">
                {external ? (
                  <Card title="This menu is a link" description="Guests who tap it go straight to your own menu page, so there are no dishes to edit here.">
                    <div className="inline">
                      <button type="button" className="btn" onClick={() => setTab("settings")}>
                        Change the link
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setMenu({ externalUrl: null })}>
                        Host the menu here instead
                      </button>
                    </div>
                  </Card>
                ) : (
                  <>
                    {toCheck.size > 0 && (
                      <div className="notice notice-warn">
                        {toCheck.size} imported dish{toCheck.size === 1 ? " has" : "es have"} AI-suggested allergens. Open each one marked “Check allergens” and confirm before saving.
                      </div>
                    )}
                    <MenuSections
                      venueId={venueId}
                      ai={ai === "on"}
                      sections={menu.sections}
                      money={money}
                      toCheck={toCheck}
                      onChecked={(itemId) =>
                        setToCheck((current) => {
                          if (!current.has(itemId)) return current;
                          const next = new Set(current);
                          next.delete(itemId);
                          return next;
                        })
                      }
                      onChange={setSections}
                      onRemoveSection={async (section) =>
                        section.items.length === 0 ||
                        (await ask({
                          title: `Delete “${section.name || "this section"}”?`,
                          body: `Its ${section.items.length} item${section.items.length === 1 ? "" : "s"} go too.`,
                          confirmLabel: "Delete section",
                          danger: true,
                        }))
                      }
                    />
                  </>
                )}
              </EditorPanel>
            )}

            {tab === "settings" && (
              <EditorPanel id="settings">
                <Card
                  title="Menu settings"
                  description={external ? "Where the menu card on your page sends guests." : `${dishCount} dish${dishCount === 1 ? "" : "es"} in ${menu.sections.length} section${menu.sections.length === 1 ? "" : "s"}.`}
                  actions={
                    list.length > 1 ? (
                      <button type="button" className="btn btn-sm btn-danger" onClick={removeMenu}>
                        <Trash2 aria-hidden /> Delete menu
                      </button>
                    ) : undefined
                  }
                >
                  <div className="row">
                    <TextField label="Menu name" value={menu.name} onChange={(value) => setMenu({ name: value ?? "" })} placeholder="All day" maxLength={80} />
                    <div className="field">
                      <span className="field-label" id="menu-mode-label">
                        Where&apos;s the menu?
                      </span>
                      <div className="segmented" role="group" aria-labelledby="menu-mode-label">
                        <button type="button" aria-pressed={!external} onClick={() => setMenu({ externalUrl: null })}>
                          Hosted here
                        </button>
                        <button type="button" aria-pressed={external} onClick={() => setMenu({ externalUrl: menu.externalUrl ?? "", linkLabelToken: menu.linkLabelToken ?? "view_menu" })}>
                          A link
                        </button>
                      </div>
                    </div>
                  </div>
                  {external ? (
                    <div className="row" style={{ marginTop: 14 }}>
                      <TextField label="Menu link" value={menu.externalUrl} onChange={(value) => setMenu({ externalUrl: value ?? "" })} placeholder="https://" type="url" />
                      <Field label="Button text" htmlFor="menu-label">
                        <select id="menu-label" className="select" value={menu.linkLabelToken ?? "view_menu"} onChange={(event) => setMenu({ linkLabelToken: event.target.value as Menu["linkLabelToken"] })}>
                          {LINK_LABEL_TOKENS.map((token) => (
                            <option key={token} value={token}>
                              {BUTTON_LABELS[token]}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  ) : (
                    <TextField label="Welcome note" value={menu.welcomeText} onChange={(value) => setMenu({ welcomeText: value })} placeholder="Food served 12 – 9pm" maxLength={200} hint="A line at the top of the menu, under its name." />
                  )}
                </Card>
                {!external && (
                  <Card title="Look" description="How dishes are laid out for guests.">
                    <div className="preset-grid" role="group" aria-label="Menu layout">
                      {MENU_LAYOUTS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className="preset"
                          aria-pressed={(menu.layout === "classic" ? "classic" : "list") === option.value}
                          onClick={() => setMenu({ layout: option.value === "list" ? null : option.value })}
                        >
                          <option.icon className="preset-icon" aria-hidden />
                          <span>
                            {option.label}
                            <span className="preset-hint">{option.hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <SwitchRow title="Show calories" description="Print each dish's kcal where you've entered it." checked={!!menu.showCalories} onChange={(on) => setMenu({ showCalories: on })} />
                  </Card>
                )}
              </EditorPanel>
            )}

            {tab === "import" && (
              <EditorPanel id="import">
                <MenuAiTools
                  venueId={venueId}
                  importLimits={importLimits}
                  sections={menu.sections}
                  onImport={(sections, mode, flagged) => {
                    setSections(mode === "replace" ? sections : [...menu.sections, ...sections]);
                    setToCheck((current) => new Set([...current, ...flagged]));
                    setTab("dishes");
                  }}
                  onExplanations={(byItemId) =>
                    setSections(
                      menu.sections.map((section) => ({
                        ...section,
                        items: section.items.map((item) => (byItemId[item.id] ? { ...item, explainer: byItemId[item.id] } : item)),
                      })),
                    )
                  }
                />
              </EditorPanel>
            )}
          </>
        )}
      </div>

      {external || !menu ? (
        <aside className="preview-pane" aria-label="Menu preview">
          <span className="preview-label">Live preview</span>
          <div className="preview-empty">
            <p>{menu ? "This menu opens your own link, so there's nothing to preview here." : "Your menu shows here once you add one."}</p>
          </div>
        </aside>
      ) : (
        <PreviewPane src={`${previewUrl}&embed=1`} version={editor.version} title="Live menu preview" fullHref={previewUrl} />
      )}

      <SaveBar dirty={editor.dirty} saving={editor.saving} error={editor.error} onSave={editor.save} onReset={editor.reset} />
    </div>
  );
}

/** One line under an item's name: what a guest will see on it, or what needs checking. */
function itemNote(item: Item, flagged: boolean): { text: string; warn: boolean } {
  if (flagged) return { text: "Imported · check allergens", warn: true };
  if (!item.isAvailable) return { text: "Sold out", warn: false };
  const parts = [
    ...item.dietaryTags.map((tag) => DIETARY_LABELS[tag]),
    ...(item.badges ?? []).map((badge) => BADGE_LABELS[badge]),
    ...(item.featured ? ["Today's special"] : []),
    ...(item.imageUrl ? ["photo"] : []),
  ];
  if (!item.priceInPence) parts.unshift("No price yet");
  return { text: parts.join(" · ") || (item.description ? item.description : "No details yet"), warn: !item.priceInPence };
}

interface SectionsProps {
  venueId: string;
  ai: boolean;
  sections: Section[];
  money: Intl.NumberFormat;
  toCheck: Set<string>;
  onChecked: (itemId: string) => void;
  onChange: (sections: Section[]) => void;
  /** Resolves true once the owner has confirmed (or there was nothing to lose). */
  onRemoveSection: (section: Section) => Promise<boolean>;
}

/** Every section stacked, as guests see the menu; a dish opens in place to edit, one at a time. */
function MenuSections({ sections, onChange, onRemoveSection, ...rest }: SectionsProps) {
  const [openItem, setOpenItem] = useState<string | null>(null);

  function addSection() {
    const next: Section = { id: newClientId("sec"), name: "", sortOrder: sections.length, items: [] };
    onChange([...sections, next]);
  }

  return (
    <>
      {sections.length === 0 && (
        <Card>
          <div className="empty">
            <p>Start with a section like “Coffee” or “Brunch”, then add dishes to it.</p>
          </div>
        </Card>
      )}
      {sections.map((section, index) => (
        <SectionCard
          key={section.id}
          {...rest}
          section={section}
          first={index === 0}
          last={index === sections.length - 1}
          openItem={openItem}
          onOpen={setOpenItem}
          onChange={(next) => onChange(sections.map((s) => (s.id === next.id ? next : s)))}
          onMove={(delta) => onChange(move(sections, index, delta))}
          onRemove={async () => {
            if (await onRemoveSection(section)) onChange(sections.filter((s) => s.id !== section.id));
          }}
        />
      ))}
      <button type="button" className="btn-dashed" disabled={sections.length >= 50} onClick={addSection}>
        <Plus aria-hidden /> Add section
      </button>
    </>
  );
}

function SectionCard({
  venueId,
  ai,
  section,
  first,
  last,
  money,
  toCheck,
  openItem,
  onOpen,
  onChecked,
  onChange,
  onMove,
  onRemove,
}: Omit<SectionsProps, "sections" | "onChange" | "onRemoveSection"> & {
  section: Section;
  first: boolean;
  last: boolean;
  openItem: string | null;
  onOpen: (itemId: string | null) => void;
  onChange: (section: Section) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const setItems = (items: Item[]) => onChange({ ...section, items });
  const drag = useDragReorder(section.items.length, (from, to) => setItems(moveTo(section.items, from, to)));

  function addItem() {
    const next: Item = { id: newClientId("itm"), name: "", priceInPence: 0, isAvailable: true, allergens: [], dietaryTags: [] };
    setItems([...section.items, next]);
    onOpen(next.id);
  }

  return (
    <section className="card menu-section-card" aria-label={section.name || "New section"}>
      <div className="pane-head">
        <input className="input pane-title" aria-label="Section name" placeholder="Section name, e.g. Coffee" value={section.name} maxLength={120} onChange={(event) => onChange({ ...section, name: event.target.value })} />
        <button type="button" className="btn btn-icon btn-ghost" aria-label="Move section up" disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp aria-hidden />
        </button>
        <button type="button" className="btn btn-icon btn-ghost" aria-label="Move section down" disabled={last} onClick={() => onMove(1)}>
          <ArrowDown aria-hidden />
        </button>
        <button type="button" className="btn btn-icon btn-ghost" aria-label="Delete section" onClick={onRemove}>
          <Trash2 aria-hidden />
        </button>
      </div>
      <input
        className="input pane-desc"
        aria-label="Section note"
        placeholder="Optional note, e.g. Served until 11:30"
        value={section.description ?? ""}
        maxLength={140}
        onChange={(event) => onChange({ ...section, description: event.target.value || null })}
      />
      <ul className="pane-list">
        {section.items.map((it, index) => {
          const note = itemNote(it, toCheck.has(it.id));
          const open = openItem === it.id;
          return (
            <li key={it.id} ref={drag.rowRef(index)} className={`item-row${open ? " selected" : ""}${it.isAvailable ? "" : " sold-out"}${drag.dragging === index ? " dragging" : ""}`}>
              <button type="button" className="drag-handle" aria-label={`Reorder ${it.name || "this item"}. Use the arrow keys to move it.`} {...drag.handleProps(index)}>
                <GripVertical aria-hidden />
              </button>
              <button type="button" className="item-row-main" aria-expanded={open} onClick={() => onOpen(open ? null : it.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- merchant uploads, already sized */}
                {it.imageUrl && <img className="item-thumb" src={it.imageUrl} alt="" />}
                <span className="item-row-text">
                  <strong>{it.name || "Untitled dish"}</strong>
                  <span className={note.warn ? "warn" : undefined}>{note.text}</span>
                </span>
                <span className="num item-row-price">{money.format(it.priceInPence / 100)}</span>
                <ChevronDown className="item-row-chevron" aria-hidden />
              </button>
              {open && (
                <ItemEditor
                  venueId={venueId}
                  ai={ai}
                  item={it}
                  money={money}
                  flagged={toCheck.has(it.id)}
                  onChecked={() => onChecked(it.id)}
                  onChange={(next) => setItems(section.items.map((i) => (i.id === it.id ? next : i)))}
                  onRemove={() => {
                    setItems(section.items.filter((i) => i.id !== it.id));
                    onOpen(null);
                  }}
                  onClose={() => onOpen(null)}
                />
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn-dashed" onClick={addItem} disabled={section.items.length >= 300}>
        <Plus aria-hidden /> Add dish
      </button>
    </section>
  );
}

function ItemEditor({
  venueId,
  ai,
  item,
  money,
  flagged,
  onChecked,
  onChange,
  onRemove,
  onClose,
}: {
  venueId: string;
  ai: boolean;
  item: Item;
  money: Intl.NumberFormat;
  /** Allergens came from an AI import and haven't been confirmed yet. */
  flagged: boolean;
  onChecked: () => void;
  onChange: (item: Item) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  // Typed text, so "4." or "" survive while the merchant is mid-edit.
  const [price, setPrice] = useState(item.priceInPence ? (item.priceInPence / 100).toFixed(2) : "");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [aiDrafted, setAiDrafted] = useState(false);
  const set = (patch: Partial<Item>) => onChange({ ...item, ...patch });
  const toggle = <T extends string>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const symbol = money.formatToParts(0).find((part) => part.type === "currency")?.value ?? "";

  return (
    <div className="item-editor" role="group" aria-label={`Edit ${item.name || "new dish"}`}>

      {flagged && (
        <div className="ai-check">
          <span>
            <strong>Allergens suggested by AI.</strong> Check they&apos;re right for your kitchen before saving.
          </span>
          <button type="button" className="btn btn-sm" onClick={onChecked}>
            Looks right
          </button>
        </div>
      )}

      <div className="row">
        <div className="span-all">
          <TextField label="Name" value={item.name} onChange={(value) => set({ name: value ?? "" })} maxLength={120} />
        </div>
        <div className="span-all">
          <TextField label="Description" value={item.description} onChange={(value) => set({ description: value })} multiline maxLength={500} />
        </div>
        <Field label="Price" htmlFor={`price-${item.id}`}>
          <span className="input-prefix">
            {symbol && <span aria-hidden>{symbol}</span>}
            <input
              id={`price-${item.id}`}
              className="input"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(event) => {
                const text = event.target.value.replace(",", ".");
                if (!/^\d*\.?\d{0,2}$/.test(text)) return;
                setPrice(text);
                set({ priceInPence: Math.round((parseFloat(text) || 0) * 100) });
              }}
            />
          </span>
        </Field>
        <Field label="Calories · optional" htmlFor={`kcal-${item.id}`}>
          <span className="input-prefix suffix">
            <input
              id={`kcal-${item.id}`}
              className="input"
              inputMode="numeric"
              placeholder="0"
              value={item.calories ?? ""}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "").slice(0, 5);
                set({ calories: digits ? Number(digits) : null });
              }}
            />
            <span aria-hidden>kcal</span>
          </span>
        </Field>
      </div>
      <ImageField venueId={venueId} label="Photo" value={item.imageUrl} onChange={(url) => set({ imageUrl: url })} />

      <div className="field">
        <span className="field-label">Allergens</span>
        <div className="chips">
          {ALLERGENS.map((allergen) => (
            <button key={allergen} type="button" className="chip" aria-pressed={item.allergens.includes(allergen)} onClick={() => set({ allergens: toggle(item.allergens, allergen) })}>
              {capitalise(allergen)}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="field-label">Dietary and badges</span>
        <div className="chips">
          {DIETARY_TAGS.map((tag) => (
            <button key={tag} type="button" className="chip" aria-pressed={item.dietaryTags.includes(tag)} onClick={() => set({ dietaryTags: toggle(item.dietaryTags, tag) })}>
              {DIETARY_LABELS[tag]}
            </button>
          ))}
          {MENU_BADGES.map((badge) => (
            <button key={badge} type="button" className="chip" aria-pressed={(item.badges ?? []).includes(badge)} onClick={() => set({ badges: toggle(item.badges ?? [], badge) })}>
              {BADGE_LABELS[badge]}
            </button>
          ))}
        </div>
      </div>

      <div className="switch-list">
        <SwitchRow title="Today's special" description="Shows in the specials strip at the top of the menu." checked={!!item.featured} onChange={(on) => set({ featured: on })} />
        <SwitchRow title="Available" description="Turn off to show “Sold out”." checked={item.isAvailable} onChange={(on) => set({ isAvailable: on })} />
      </div>

      <div className="field">
        <div className="spread">
          <label htmlFor={`explainer-${item.id}`}>“What&apos;s this?” explainer</label>
          {ai && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={drafting || !item.name.trim()}
              onClick={async () => {
                setDrafting(true);
                setDraftError(null);
                try {
                  const { suggestions } = await dashboardApi.explainDishes(venueId, {
                    items: [{ id: item.id, name: item.name, description: item.description ?? null }],
                    onlyUnfamiliar: false,
                  });
                  if (suggestions[0]) {
                    set({ explainer: suggestions[0].explainer });
                    setAiDrafted(true);
                  } else setDraftError("No draft came back. Try adding a short description first.");
                } catch (err) {
                  setDraftError(errorMessage(err));
                } finally {
                  setDrafting(false);
                }
              }}
            >
              {drafting ? <Loader2 className="spin" aria-hidden /> : <Sparkles aria-hidden />} {item.explainer ? "Redraft with AI" : "Draft with AI"}
            </button>
          )}
        </div>
        <textarea
          id={`explainer-${item.id}`}
          className={`textarea${aiDrafted ? " ai-drafted" : ""}`}
          maxLength={600}
          value={item.explainer ?? ""}
          placeholder="For dishes guests might not know, e.g. “Shakshuka is eggs gently poached in a spiced tomato and pepper sauce…”"
          onChange={(event) => set({ explainer: event.target.value || null })}
        />
        {draftError ? (
          <p className="field-error">{draftError}</p>
        ) : aiDrafted ? (
          <div className="ai-check">
            <span>
              <strong>AI draft.</strong> Check it&apos;s right for your kitchen before saving.
            </span>
            <button type="button" className="btn btn-sm" onClick={() => setAiDrafted(false)}>
              Looks right
            </button>
          </div>
        ) : (
          <p className="hint">Guests tap “What&apos;s this?” under the dish to read it. Leave blank for familiar dishes.</p>
        )}
      </div>

      <div className="item-editor-foot">
        <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={onRemove}>
          <Trash2 aria-hidden /> Delete dish
        </button>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
