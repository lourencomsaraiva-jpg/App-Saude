import { describe, expect, it } from "vitest";
import { parseHealthDate, parseWeight } from "./health-weight";

describe("peso da app Saúde", () => {
  it("valores", () => {
    expect(parseWeight(81.2)).toBe(81.2);
    expect(parseWeight("81,2 kg")).toBe(81.2);
    expect(parseWeight("81.2")).toBe(81.2);
    expect(parseWeight("179 lb")).toBeCloseTo(81.19, 2);
    expect(parseWeight("abc")).toBeNull();
  });
  it("datas", () => {
    const tz = "Europe/Lisbon";
    expect(parseHealthDate("2026-11-14T00:30:00+00:00", tz)).toBe("2026-11-14");
    expect(parseHealthDate("2026-11-13T23:30:00-01:00", tz)).toBe("2026-11-14");
    expect(parseHealthDate("2026-11-14", tz)).toBe("2026-11-14");
    expect(parseHealthDate("14/11/2026, 07:12", tz)).toBe("2026-11-14");
    expect(parseHealthDate("14 de novembro de 2026 às 07:12", tz)).toBe("2026-11-14");
    expect(parseHealthDate("14 nov 2026, 07:12", tz)).toBe("2026-11-14");
    expect(parseHealthDate("Nov 14, 2026 at 7:12 AM", tz)).toBe("2026-11-14");
    expect(parseHealthDate("ontem", tz)).toBeNull();
  });
});
