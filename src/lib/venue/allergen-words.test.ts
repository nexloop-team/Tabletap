import { describe, expect, it } from "vitest";
import { backedAllergens } from "./allergen-words";

describe("AI allergen suggestions", () => {
  it("drops allergens nothing in the dish backs up, like peanuts in a coffee", () => {
    expect(backedAllergens(["peanuts", "nuts"], "Filter coffee ")).toEqual([]);
    expect(backedAllergens(["milk", "peanuts"], "Cappuccino Double shot")).toEqual(["milk"]);
  });

  it("keeps the ones the dish's own words name", () => {
    expect(backedAllergens(["peanuts", "gluten"], "Chicken satay With peanut sauce")).toEqual(["peanuts"]);
    expect(backedAllergens(["milk", "nuts"], "Paneer butter masala With cashew gravy")).toEqual(["milk", "nuts"]);
    expect(backedAllergens(["eggs", "gluten"], "Eggs Benedict On a toasted muffin")).toEqual(["eggs", "gluten"]);
  });

  it("matches whole words only", () => {
    expect(backedAllergens(["fish"], "Shellfish-free goldfish crackers")).toEqual([]);
    expect(backedAllergens(["sesame"], "Tilapia")).toEqual([]);
  });
});
