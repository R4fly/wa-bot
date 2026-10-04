import { describe, expect, it } from "vitest";
import { createCatalog, translate } from "./catalog.js";
import { interpolate } from "./interpolate.js";
import { resolveLocale, selectPlural } from "./resolver.js";

describe("interpolate", () => {
  it("should replace known placeholders and keep unknown ones", () => {
    expect(interpolate("hi {name}, count {n} and {x}", { name: "ana", n: "3" })).toBe("hi ana, count 3 and {x}");
  });
});

describe("translate", () => {
  it("should fall back to the key when the message is absent", () => {
    const catalog = createCatalog("id", { greet: "halo {name}" });
    expect(translate(catalog, "missing")).toBe("missing");
    expect(translate(catalog, "greet", { name: "ana" })).toBe("halo ana");
  });
});

describe("resolveLocale", () => {
  it("should prefer user locale then group locale then fallback", () => {
    const supported = ["id", "en"];
    expect(resolveLocale({ userLocale: "id", groupLocale: "en", fallback: "en", supported })).toBe("id");
    expect(resolveLocale({ userLocale: "fr", groupLocale: "id", fallback: "en", supported })).toBe("id");
    expect(resolveLocale({ userLocale: "fr", groupLocale: "de", fallback: "en", supported })).toBe("en");
  });

  it("should fall back when neither user nor group locale is supported", () => {
    expect(
      resolveLocale({ userLocale: "fr", groupLocale: "de", fallback: "en", supported: ["id", "en"] }),
    ).toBe("en");
  });
});

describe("selectPlural", () => {
  it("should use exact count keys before one and other", () => {
    const forms = { one: "satu", other: "banyak", "0": "kosong" };
    expect(selectPlural(0, forms)).toBe("kosong");
    expect(selectPlural(1, forms)).toBe("satu");
    expect(selectPlural(7, forms)).toBe("banyak");
  });

  it("should return an empty string when no plural form matches", () => {
    expect(selectPlural(5, {})).toBe("");
  });
});