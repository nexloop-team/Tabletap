import "server-only";
import type { Db } from "./db";
import type { PublicVenue } from "@/lib/venue/types";

/**
 * Demo venues, one per major configuration, so every flow on the landing
 * page can be exercised locally:
 *   /s?i=demo          stamp card with tiers, menu, Wi-Fi, CRM off (plain Wi-Fi)
 *   /s?i=demo-crm      dark brand, pub (18+), Wi-Fi email gate, consent, birthday
 *   /s?i=demo-rewards  rewards-only membership, external menu, custom links, no cover
 *
 * The Google review links use the reserved `.invalid` TLD, which the page
 * treats as a placeholder and answers with an explanatory dialog.
 */
export const DEMO_VENUES: PublicVenue[] = [
  {
    id: "ven_juniper",
    shortCode: "demo",
    name: "Juniper Coffee House",
    venueType: "cafe",
    currencyCode: "GBP",
    wifi: { ssid: "Juniper-Guest", password: "flatwhite2024", security: "WPA2" },
    socialLinks: {
      google: "https://reviews.demo.invalid/juniper",
      instagram: "https://www.instagram.com/",
      facebook: "https://www.facebook.com/",
    },
    menus: [
      {
        id: "menu_juniper_all_day",
        name: "All Day",
        welcomeText: "Welcome to Juniper Coffee House",
        primaryColorHex: "#2F4A3A",
        sections: [
          {
            id: "sec_brunch",
            name: "Brunch & Small Plates",
            description: "Served all day. Ask about our gluten-free bread.",
            sortOrder: 0,
            items: [
              { id: "itm_avo", name: "Avocado on Sourdough", description: "Smashed avocado, cherry tomatoes, chilli, lime and toasted seeds", priceInPence: 1095, isAvailable: true, allergens: ["gluten"], dietaryTags: ["vegan"], calories: 410, imageUrl: "/demo/dish-avocado-toast.svg", badges: ["popular"] },
              {
                id: "itm_eggs",
                name: "Eggs Florentine",
                description: "Poached eggs, wilted spinach and hollandaise on a toasted English muffin",
                priceInPence: 1250,
                isAvailable: true,
                allergens: ["gluten", "eggs", "milk"],
                dietaryTags: ["vegetarian"],
                calories: 540,
                imageUrl: "/demo/dish-eggs-florentine.svg",
                badges: ["chef"],
                explainer: "Florentine means made with spinach. Think eggs Benedict, with spinach instead of ham.",
              },
              { id: "itm_pancakes", name: "Buttermilk Pancakes", description: "A tall stack with berries, maple syrup and whipped ricotta", priceInPence: 1050, isAvailable: true, allergens: ["gluten", "eggs", "milk"], dietaryTags: ["vegetarian"], calories: 620, imageUrl: "/demo/dish-pancakes.svg", badges: ["new"], featured: true },
              {
                id: "itm_shak",
                name: "Shakshuka",
                description: "Spiced tomato and pepper sauce, baked eggs, feta, flatbread",
                priceInPence: 1195,
                isAvailable: false,
                allergens: ["gluten", "eggs", "milk"],
                dietaryTags: ["vegetarian"],
                calories: 480,
                badges: ["spicy"],
                explainer: "A North African and Middle Eastern dish: eggs gently poached in a spiced tomato and pepper sauce, eaten with bread.",
              },
            ],
          },
          {
            id: "sec_drinks",
            name: "Coffee & Drinks",
            description: "Oat, soy or coconut milk at no extra cost.",
            sortOrder: 1,
            items: [
              { id: "itm_flat", name: "Flat White", description: "Double ristretto, silky steamed milk", priceInPence: 360, isAvailable: true, allergens: ["milk"], dietaryTags: ["vegetarian"], calories: 110, imageUrl: "/demo/dish-flat-white.svg", badges: ["popular"] },
              { id: "itm_oat", name: "Oat Latte", description: "House espresso with barista oat milk", priceInPence: 395, isAvailable: true, allergens: [], dietaryTags: ["vegan"], calories: 140 },
              {
                id: "itm_chai",
                name: "Dirty Chai",
                description: "Spiced chai latte with a shot of espresso",
                priceInPence: 420,
                isAvailable: true,
                allergens: ["milk"],
                dietaryTags: ["vegetarian"],
                calories: 190,
                badges: ["spicy"],
                explainer: "A chai latte (black tea with cinnamon, cardamom, ginger and milk) made “dirty” with a shot of espresso.",
              },
            ],
          },
        ],
      },
    ],
    loyaltyProgram: {
      rewardName: "Free Brunch",
      stampsRequired: 10,
      rewardTiers: [
        { rewardName: "Free Coffee", stampsRequired: 6 },
        { rewardName: "Free Brunch", stampsRequired: 10 },
      ],
    },
    branding: {
      coverImageUrl: "/demo/juniper-cover.svg",
      logoUrl: "/demo/juniper-logo.svg",
      titleOverride: "Juniper Coffee House",
      tagline: "Slow coffee, good company",
      backgroundColorHex: "#FFFFFF",
      showGoogleReviewButton: true,
      sudokuEnabled: true,
      featureOrder: ["loyalty", "googleReview", "menu", "wifi", "feedback"],
    },
    externalLinks: [],
    crm: { enabled: false, consentAsk: false, wifiCapture: false, feedbackCapture: false, birthdayAsk: false },
  },
  {
    id: "ven_kettle",
    shortCode: "demo-crm",
    name: "The Copper Kettle",
    venueType: "pub",
    currencyCode: "GBP",
    wifi: { ssid: "CopperKettle", password: "ale&cider", security: "WPA2" },
    socialLinks: {
      google: "https://reviews.demo.invalid/copper-kettle",
      facebook: "https://www.facebook.com/",
      tripAdvisor: "https://www.tripadvisor.com/",
      youtube: "https://www.youtube.com/",
    },
    menus: [
      {
        id: "menu_kettle",
        name: "Food",
        welcomeText: "Food served 12 - 9pm",
        primaryColorHex: "#B5651D",
        sections: [
          {
            id: "sec_mains",
            name: "Pub Classics",
            description: "Served 12 – 9pm. Sunday roasts 12 – 5.",
            sortOrder: 0,
            items: [
              { id: "itm_fish", name: "Beer-Battered Haddock", description: "Line-caught haddock in our own ale batter, chunky chips, mushy peas, tartare", priceInPence: 1650, isAvailable: true, allergens: ["gluten", "fish", "eggs"], dietaryTags: [], calories: 980, imageUrl: "/demo/dish-haddock.svg", badges: ["popular"] },
              {
                id: "itm_pie",
                name: "Steak & Ale Pie",
                description: "Slow-cooked beef in real ale under a shortcrust lid, mash, greens, gravy",
                priceInPence: 1750,
                isAvailable: true,
                allergens: ["gluten", "milk", "celery"],
                dietaryTags: [],
                calories: 1040,
                imageUrl: "/demo/dish-steak-pie.svg",
                badges: ["chef"],
                featured: true,
                explainer: "Chunks of beef braised for hours in dark ale until tender, then baked under a pastry lid.",
              },
            ],
          },
          {
            id: "sec_sides",
            name: "Sides",
            sortOrder: 1,
            items: [
              { id: "itm_chips", name: "Chunky Chips", description: "Triple-cooked, sea salt", priceInPence: 450, isAvailable: true, allergens: [], dietaryTags: ["vegan"], calories: 420 },
              { id: "itm_rings", name: "Onion Rings", description: "In our ale batter", priceInPence: 500, isAvailable: true, allergens: ["gluten"], dietaryTags: ["vegetarian"], calories: 380, badges: ["new"] },
            ],
          },
        ],
      },
    ],
    loyaltyProgram: { rewardName: "Free Pint", stampsRequired: 8 },
    branding: {
      coverImageUrl: "/demo/kettle-cover.svg",
      logoUrl: "/demo/kettle-logo.svg",
      tagline: "Est. 1887 · Real ales & roasts",
      backgroundColorHex: "#1F2A24",
      style: "classic",
      showGoogleReviewButton: true,
      sudokuEnabled: false,
    },
    externalLinks: [],
    crm: { enabled: true, consentAsk: true, wifiCapture: true, feedbackCapture: true, birthdayAsk: true },
  },
  {
    id: "ven_bloom",
    shortCode: "demo-rewards",
    name: "Bloom Bakery",
    venueType: "bakery",
    currencyCode: "GBP",
    wifi: { ssid: "Bloom Free WiFi", password: null, security: "open" },
    socialLinks: { instagram: "https://www.instagram.com/" },
    menus: [
      {
        id: "menu_bloom",
        name: "Order",
        externalUrl: "https://example.com/bloom-bakery/order",
        linkLabelToken: "order_online",
        sections: [],
      },
    ],
    loyaltyProgram: { rewardName: "", stampsRequired: 0, stampsEnabled: false },
    branding: {
      logoUrl: "/demo/bloom-logo.svg",
      tagline: "Sourdough, pastries & flowers",
      backgroundColorHex: "#F6E7D8",
      style: "modern",
      showGoogleReviewButton: false,
      sudokuEnabled: true,
    },
    externalLinks: [
      { id: "lnk_book", url: "https://example.com/bloom-bakery/cake-orders", labelCustom: "Order a celebration cake", icon: "gift" },
      { id: "lnk_jobs", url: "https://example.com/bloom-bakery/jobs", labelToken: "visit_website", icon: "jobs" },
    ],
    crm: { enabled: true, consentAsk: true, wifiCapture: true, feedbackCapture: true, birthdayAsk: false },
  },
];

export async function seedDemoVenues(db: Db) {
  // Demo venues have no owner, so they're refreshed from this file on every start:
  // new demo content shows up without resetting the database.
  for (const venue of DEMO_VENUES) {
    const { id, shortCode, ...config } = venue;
    await db.run("INSERT INTO venues (id, short_code, config) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET config = excluded.config", id, shortCode, JSON.stringify(config));
    // Demos show every feature, so they sit on the paid plan with no owner.
    await db.run("INSERT INTO subscriptions (venue_id, plan, status) VALUES (?, 'pro', 'active') ON CONFLICT (venue_id) DO NOTHING", id);
  }
}
