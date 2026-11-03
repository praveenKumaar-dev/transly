import { describe, expect, it } from "vitest";
import { formatMessage, placeholdersMatch } from "../src/index.js";
describe("formatMessage", () => {
  it("interpolates", () => expect(formatMessage("Hi {name}!", { name: "Praveen" })).toBe("Hi Praveen!"));
  it("keeps unknown placeholders", () => expect(formatMessage("Hi {x}")).toBe("Hi {x}"));
  it("ICU plural", () => {
    const m = "{count, plural, =0 {No items} one {# item} other {# items}}";
    expect(formatMessage(m, { count: 0 })).toBe("No items");
    expect(formatMessage(m, { count: 1 })).toBe("1 item");
    expect(formatMessage(m, { count: 1234 })).toBe("1,234 items");
  });
  it("nested params inside plural", () =>
    expect(
      formatMessage("{count, plural, one {{who} has # cat} other {{who} has # cats}}", { count: 2, who: "Al" }),
    ).toBe("Al has 2 cats"));
  it("validates placeholders/tags", () => {
    expect(placeholdersMatch("Hi {name} <b>x</b>", "வணக்கம் <b>x</b> {name}")).toBe(true);
    expect(placeholdersMatch("Hi {name}", "வணக்கம்")).toBe(false);
  });
});
