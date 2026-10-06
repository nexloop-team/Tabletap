import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Presentational building blocks for dashboard and admin pages. Server-safe: no hooks, no "use client". */

/** Page title row: heading, one-line description and right-aligned actions. */
export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

const compact = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });

/** 1,284 stays as is; 12,900 → 12.9K. */
export function formatCount(value: number): string {
  return value < 10_000 ? value.toLocaleString("en-GB") : compact.format(value);
}

/** KPI tile: label, headline value and an optional supporting line ("up" tints it as good news). */
export function Stat({ label, value, sub, icon: Icon, href, tone }: { label: string; value: number | string; sub?: ReactNode; icon?: LucideIcon; href?: string; tone?: "up" }) {
  const body = (
    <>
      <div className="stat-top">
        <span className="label">{label}</span>
        {Icon && (
          <span className="stat-icon">
            <Icon aria-hidden />
          </span>
        )}
      </div>
      <div className="value">{typeof value === "number" ? formatCount(value) : value}</div>
      {sub && <div className={`sub${tone === "up" ? " up" : ""}`}>{sub}</div>}
    </>
  );
  return href ? (
    <Link className="card stat stat-link" href={href}>
      {body}
    </Link>
  ) : (
    <div className="card stat">{body}</div>
  );
}

function shortDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function weekday(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

/**
 * Single-series daily column chart. One series, so no legend: the card title
 * names it. Up to two weeks, every column carries its value and weekday;
 * longer ranges show a scale and a hover/focus tooltip instead. A visually
 * hidden table carries the same numbers for screen readers.
 */
export function DailyBars({ data, label, unit }: { data: { day: string; value: number }[]; label: string; unit: [singular: string, plural: string] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const noun = (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? unit[0] : unit[1]}`;
  const labelled = data.length <= 14;
  return (
    <figure className={`chart${labelled ? " labelled" : ""}`}>
      {!labelled && (
        <div className="chart-scale" aria-hidden>
          <span>{max.toLocaleString("en-GB")}</span>
          <span>0</span>
        </div>
      )}
      <div className="chart-plot" aria-hidden>
        {data.map((d) => (
          <div key={d.day} className="chart-col" data-tip={labelled ? undefined : `${shortDay(d.day)} · ${noun(d.value)}`}>
            {labelled && <span className="chart-value num">{d.value.toLocaleString("en-GB")}</span>}
            <div className="chart-bar" style={{ height: `${(d.value / max) * 100}%` }} data-zero={d.value === 0 || undefined} />
          </div>
        ))}
      </div>
      <div className="chart-axis" aria-hidden>
        {labelled ? (
          data.map((d) => <span key={d.day}>{weekday(d.day)}</span>)
        ) : (
          <>
            <span>{data[0] ? shortDay(data[0].day) : ""}</span>
            <span>Today</span>
          </>
        )}
      </div>
      <figcaption className="visually-hidden">
        {label}: {noun(total)} in {data.length} days.
      </figcaption>
      <table className="visually-hidden">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">{unit[1]}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon aria-hidden />
      </span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
