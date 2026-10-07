import { describe, expect, it } from "vitest";
import { expandSocialLink } from "./social";

describe("expandSocialLink", () => {
  it("turns a handle, with or without @, into the profile link", () => {
    expect(expandSocialLink("instagram", "@junipercoffee")).toBe("https://instagram.com/junipercoffee");
    expect(expandSocialLink("instagram", " junipercoffee ")).toBe("https://instagram.com/junipercoffee");
    expect(expandSocialLink("facebook", "juniper.coffee")).toBe("https://facebook.com/juniper.coffee");
    expect(expandSocialLink("youtube", "@JuniperTV")).toBe("https://youtube.com/@JuniperTV");
  });

  it("adds https:// to a pasted address and keeps full links as they are", () => {
    expect(expandSocialLink("instagram", "instagram.com/juniper")).toBe("https://instagram.com/juniper");
    expect(expandSocialLink("facebook", "www.facebook.com/juniper")).toBe("https://www.facebook.com/juniper");
    expect(expandSocialLink("youtube", "https://youtube.com/@x")).toBe("https://youtube.com/@x");
  });

  it("leaves what it can't read for validation to explain, and clears blanks", () => {
    expect(expandSocialLink("tripAdvisor", "juniper")).toBe("juniper");
    expect(expandSocialLink("instagram", "not a handle!")).toBe("not a handle!");
    expect(expandSocialLink("instagram", "   ")).toBeNull();
    expect(expandSocialLink("facebook", null)).toBeNull();
  });
});
