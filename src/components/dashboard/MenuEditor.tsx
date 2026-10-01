"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ALLERGENS, DIETARY_TAGS, LINK_LABEL_TOKENS, type VenueConfig } from "@/lib/venue/schema";
import { Card, Field, ImageField, newClientId, SaveBar, Switch, SwitchRow, TextField } from "./ui";
import { useVenueDraft } from "./useVenueDraft";

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

export function MenuEditor({ venueId, menus, currencyCode }: { venueId: string; menus: VenueConfig["menus"]; currencyCode: string }) {
  const editor = useVenueDraft<{ menus: VenueConfig["menus"] }>(venueId, { menus });
  const list = editor.draft.menus;
  const [selected, setSelected] = useState(0);
  const menu = list[Math.min(selected, list.length - 1)];
  const money = new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode });

  const setMenus = (next: VenueConfig["menus"]) => editor.update("menus", next);
  const setMenu = (patch: Partial<Menu>) => setMenus(list.map((m) => (m === menu ? { ...m, ...patch } : m)));
  const setSections = (sections: Section[]) => setMenu({ sections: sections.map((s, i) => ({ ...s, sortOrder: i })) });

  function addMenu() {
    setMenus([...list, { id: newClientId("menu"), name: `Menu ${list.length + 1}`, sections: [] }]);
    setSelected(list.length);
  }

  function removeMenu() {
    if (!menu || !window.confirm(`Delete “${menu.name}” and everything on it?`)) return;
    setMenus(list.filter((m) => m !== menu));
    setSelected(0);
  }

  const external = menu ? menu.externalUrl !== null && menu.externalUrl !== undefined : false;

  return (
    <>
      <div className="tabs" role="group" aria-label="Menus">
        {list.map((m, index) => (
          <button key={m.id} type="button" className="chip" aria-pressed={m === menu} onClick={() => setSelected(index)}>
            {m.name || "Untitled"}
          </button>
        ))}
        <button type="button" className="chip" onClick={addMenu} disabled={list.length >= 10}>
          + New menu
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
          <Card
            title="Menu details"
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
              <Field label="Where's the menu?" htmlFor="menu-mode">
                <select
                  id="menu-mode"
                  className="select"
                  value={external ? "external" : "hosted"}
                  onChange={(event) => setMenu(event.target.value === "external" ? { externalUrl: menu.externalUrl ?? "", linkLabelToken: menu.linkLabelToken ?? "view_menu" } : { externalUrl: null })}
                >
                  <option value="hosted">Build it here</option>
                  <option value="external">Link to my own menu</option>
                </select>
              </Field>
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
              <>
                <TextField label="Welcome note" value={menu.welcomeText} onChange={(value) => setMenu({ welcomeText: value })} placeholder="Food served 12 – 9pm" maxLength={200} />
                <SwitchRow title="Show calories" description="Print each item's kcal where you've entered it." checked={!!menu.showCalories} onChange={(on) => setMenu({ showCalories: on })} />
              </>
            )}
          </Card>

          {!external && (
            <>
              {menu.sections.map((section, sectionIndex) => (
                <SectionEditor
                  key={section.id}
                  venueId={venueId}
                  section={section}
                  money={money}
                  first={sectionIndex === 0}
                  last={sectionIndex === menu.sections.length - 1}
                  onChange={(next) => setSections(menu.sections.map((s) => (s.id === section.id ? next : s)))}
                  onMove={(delta) => setSections(move(menu.sections, sectionIndex, delta))}
                  onRemove={() => {
                    if (section.items.length === 0 || window.confirm(`Delete “${section.name}” and its ${section.items.length} item(s)?`)) {
                      setSections(menu.sections.filter((s) => s.id !== section.id));
                    }
                  }}
                />
              ))}
              <button
                type="button"
                className="btn btn-block"
                style={{ marginTop: 14 }}
                disabled={menu.sections.length >= 50}
                onClick={() => setSections([...menu.sections, { id: newClientId("sec"), name: "", sortOrder: menu.sections.length, items: [] }])}
              >
                <Plus aria-hidden /> Add a section
              </button>
              {menu.sections.length === 0 && <p className="hint" style={{ marginTop: 8, textAlign: "center" }}>Start with a section like “Coffee” or “Brunch”, then add items to it.</p>}
            </>
          )}
        </>
      )}

      <SaveBar dirty={editor.dirty} saving={editor.saving} error={editor.error} onSave={editor.save} onReset={editor.reset} />
    </>
  );
}

function SectionEditor({
  venueId,
  section,
  money,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  venueId: string;
  section: Section;
  money: Intl.NumberFormat;
  first: boolean;
  last: boolean;
  onChange: (section: Section) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const setItems = (items: Item[]) => onChange({ ...section, items });

  function addItem() {
    const item: Item = { id: newClientId("itm"), name: "", priceInPence: 0, isAvailable: true, allergens: [], dietaryTags: [] };
    setItems([...section.items, item]);
    setOpen(item.id);
  }

  return (
    <section className="section-block">
      <div className="list-row-head">
        <input className="input" aria-label="Section name" placeholder="Section name, e.g. Coffee" value={section.name} maxLength={120} onChange={(event) => onChange({ ...section, name: event.target.value })} />
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

      <div className="section-items">
        {section.items.map((item, index) => (
          <div key={item.id} className="list-row">
            <div className="list-row-head">
              <button type="button" className="item-summary" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)}>
                {open === item.id ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
                {/* eslint-disable-next-line @next/next/no-img-element -- merchant uploads, already sized */}
                {item.imageUrl ? <img className="item-thumb" src={item.imageUrl} alt="" /> : null}
                <strong>{item.name || "Untitled item"}</strong>
                {!item.isAvailable && <span className="badge badge-warn">Sold out</span>}
                <span className="price">{money.format(item.priceInPence / 100)}</span>
              </button>
              <button type="button" className="btn btn-icon btn-ghost" aria-label="Move item up" disabled={index === 0} onClick={() => setItems(move(section.items, index, -1))}>
                <ArrowUp aria-hidden />
              </button>
              <button type="button" className="btn btn-icon btn-ghost" aria-label="Move item down" disabled={index === section.items.length - 1} onClick={() => setItems(move(section.items, index, 1))}>
                <ArrowDown aria-hidden />
              </button>
            </div>
            {open === item.id && (
              <ItemEditor
                venueId={venueId}
                item={item}
                onChange={(next) => setItems(section.items.map((i) => (i.id === item.id ? next : i)))}
                onRemove={() => setItems(section.items.filter((i) => i.id !== item.id))}
              />
            )}
          </div>
        ))}
        <button type="button" className="btn btn-sm" style={{ justifySelf: "start" }} onClick={addItem} disabled={section.items.length >= 300}>
          <Plus aria-hidden /> Add item
        </button>
      </div>
    </section>
  );
}

function ItemEditor({ venueId, item, onChange, onRemove }: { venueId: string; item: Item; onChange: (item: Item) => void; onRemove: () => void }) {
  // Typed text, so "4." or "" survive while the merchant is mid-edit.
  const [price, setPrice] = useState(item.priceInPence ? (item.priceInPence / 100).toFixed(2) : "");
  const set = (patch: Partial<Item>) => onChange({ ...item, ...patch });
  const toggle = <T extends string>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <div className="list-row-body">
      <div className="row">
        <TextField label="Name" value={item.name} onChange={(value) => set({ name: value ?? "" })} maxLength={120} />
        <Field label="Price" htmlFor={`price-${item.id}`}>
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
        </Field>
        <Field label="Calories (kcal)" htmlFor={`kcal-${item.id}`}>
          <input
            id={`kcal-${item.id}`}
            className="input"
            inputMode="numeric"
            value={item.calories ?? ""}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").slice(0, 5);
              set({ calories: digits ? Number(digits) : null });
            }}
          />
        </Field>
      </div>
      <TextField label="Description" value={item.description} onChange={(value) => set({ description: value })} multiline maxLength={500} />
      <div className="field" style={{ marginTop: 14 }}>
        <span className="field-label">Contains (allergens)</span>
        <div className="chips">
          {ALLERGENS.map((allergen) => (
            <button key={allergen} type="button" className="chip" aria-pressed={item.allergens.includes(allergen)} onClick={() => set({ allergens: toggle(item.allergens, allergen) })}>
              {capitalise(allergen)}
            </button>
          ))}
        </div>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <span className="field-label">Dietary</span>
        <div className="chips">
          {DIETARY_TAGS.map((tag) => (
            <button key={tag} type="button" className="chip" aria-pressed={item.dietaryTags.includes(tag)} onClick={() => set({ dietaryTags: toggle(item.dietaryTags, tag) })}>
              {DIETARY_LABELS[tag]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <ImageField venueId={venueId} label="Photo" value={item.imageUrl} onChange={(url) => set({ imageUrl: url })} />
      </div>
      <div className="spread" style={{ marginTop: 14 }}>
        <label className="inline">
          <Switch label="Available" checked={item.isAvailable} onChange={(on) => set({ isAvailable: on })} />
          <span>{item.isAvailable ? "Available" : "Sold out"}</span>
        </label>
        <button type="button" className="btn btn-sm btn-danger" onClick={onRemove}>
          <Trash2 aria-hidden /> Delete item
        </button>
      </div>
    </div>
  );
}
