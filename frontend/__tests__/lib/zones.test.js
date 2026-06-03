import { ZONES, isValidZone, toBackendZone, zoneLabel } from "@/lib/zones";

describe("zone helpers", () => {
  it("exposes A, B, and C factory zones", () => {
    expect(ZONES.map((zone) => zone.value)).toEqual(["A", "B", "C"]);
  });

  it("validates known zone values only", () => {
    expect(isValidZone("A")).toBe(true);
    expect(isValidZone("B")).toBe(true);
    expect(isValidZone("D")).toBe(false);
    expect(isValidZone("")).toBe(false);
  });

  it("resolves labels and falls back to the provided value", () => {
    expect(zoneLabel("A")).toBe(ZONES[0].label);
    expect(zoneLabel("D")).toBe("D");
    expect(zoneLabel()).toBe("");
  });

  it("formats backend factoryZone values", () => {
    expect(toBackendZone("A")).toContain("A");
  });
});
