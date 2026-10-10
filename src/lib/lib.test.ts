import { describe, expect, it } from "vitest";
import { lexiconSentiment } from "@/server/services/sentiment";
import { formatSince } from "./format";
import { createTranslator } from "./i18n";
import { linkLabel } from "./landing-copy";
import { computeTheme, isLightColor, themeCss } from "./theme";
import { isPlausibleEmail, isValidBirthday, maskEmail } from "./validation";

describe("theme", () => {
  it("defaults to white and never follows the OS theme", () => {
    const theme = computeTheme({});
    expect(theme.vars["--page-bg"]).toBe("#FFFFFF");
    expect(theme.isLightCards).toBe(true);
  });

  it("switches to light text on a dark brand colour, but keeps cards light", () => {
    expect(computeTheme({ backgroundColorHex: "#1F2A24" }).vars["--text-primary"]).toBe("#FFFFFF");
    expect(computeTheme({ backgroundColorHex: "#1F2A24", appearance: "dark" }).vars["--card-text-primary"]).toBe("#1A1A1A");
    expect(isLightColor("#F6E7D8")).toBe(true);
  });

  it("normalises a bare hex and rejects anything that is not a colour", () => {
    expect(computeTheme({ backgroundColorHex: "abc" }).vars["--page-bg"]).toBe("#abc");
    const css = themeCss(computeTheme({ backgroundColorHex: "red;}body{display:none" }));
    expect(css).not.toContain("display:none");
    expect(css.startsWith(":root{")).toBe(true);
  });
});

describe("validation", () => {
  it("accepts plausible emails only", () => {
    expect(isPlausibleEmail(" Ana@Example.co.uk ")).toBe(true);
    expect(isPlausibleEmail("a@b")).toBe(false);
    expect(isPlausibleEmail("a@@b.com")).toBe(false);
    expect(isPlausibleEmail("a@.b.com")).toBe(false);
  });

  it("masks emails to first and last character", () => {
    expect(maskEmail("alice@gmail.com")).toBe("a•••e@gmail.com");
    expect(maskEmail("al@x.io")).toBe("a•••@x.io");
  });

  it("checks birthdays without a year (29 Feb allowed)", () => {
    expect(isValidBirthday(2, 29)).toBe(true);
    expect(isValidBirthday(4, 31)).toBe(false);
  });
});

describe("i18n", () => {
  it("fills placeholders", () => {
    const { tf } = createTranslator();
    expect(tf("collect_stamps_single", { stamps: 8, reward: "coffee" })).toContain("8");
  });

  it("labels links from custom text, then known tokens, then the fallback", () => {
    const { t } = createTranslator();
    expect(linkLabel("book_now", " Reserve ", t, "feature_menu")).toBe("Reserve");
    expect(linkLabel("book_now", null, t, "feature_menu")).toBe("Book Now");
    expect(linkLabel("toString", null, t, "feature_menu")).toBe("Menu");
  });
});

describe("sentiment", () => {
  it("scores praise positive enough to ask for a review, complaints negative", () => {
    expect(lexiconSentiment("Amazing coffee and really friendly staff!")).toBeGreaterThan(0.5);
    expect(lexiconSentiment("Rude service and the food was cold")).toBeLessThan(0);
    expect(lexiconSentiment("The food was not good")).toBeLessThan(0);
    expect(lexiconSentiment("We sat by the window")).toBe(0);
  });
});

describe("formatSince", () => {
  const now = Date.UTC(2026, 9, 8, 12, 0, 0);
  it("counts minutes and hours for the till, then falls back to days", () => {
    expect(formatSince("2026-10-08 11:59:40", now)).toBe("just now");
    expect(formatSince("2026-10-08 11:56:00", now)).toBe("4 min");
    expect(formatSince("2026-10-08 09:30:00", now)).toBe("2 h");
    expect(formatSince("2026-10-07 09:00:00", now)).toBe("Yesterday");
    expect(formatSince(null, now)).toBe("–");
  });
});

describe("NFC tag links", () => {
  it("open the table's page, marked so taps show apart from QR scans", async () => {
    const { nfcTagLink } = await import("@/components/dashboard/QrDesigner");
    expect(nfcTagLink("https://tabletap.in/s?i=chai-corner", "Table 4")).toBe("https://tabletap.in/s?i=chai-corner&s=table-4-nfc");
    expect(nfcTagLink("https://tabletap.in/s?i=chai-corner", "Patio")).toBe("https://tabletap.in/s?i=chai-corner&s=patio-nfc");
    expect(nfcTagLink("https://tabletap.in/s?i=chai-corner", "")).toBe("https://tabletap.in/s?i=chai-corner&s=nfc");
  });
});

describe("NFC links download", () => {
  it("lists each table's NFC link beside its QR link, one row per table", async () => {
    const { nfcLinksCsv } = await import("@/components/dashboard/QrDesigner");
    const csv = nfcLinksCsv("https://tabletap.in/s?i=chai", ["Table 1", "Patio, back"]);
    expect(csv.split("\r\n")).toEqual([
      "Table,NFC link (write onto the tag),QR link (on the printed card)",
      "Table 1,https://tabletap.in/s?i=chai&s=table-1-nfc,https://tabletap.in/s?i=chai&s=table-1",
      '"Patio, back",https://tabletap.in/s?i=chai&s=patio-back-nfc,https://tabletap.in/s?i=chai&s=patio-back',
      "",
    ]);
  });
});
