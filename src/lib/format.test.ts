import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  dash,
} from "./format";

describe("formatNumber", () => {
  it("null/undefined → '—'", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
  });
  it("숫자 천단위 콤마", () => {
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(0)).toBe("0");
  });
  it("음수", () => {
    expect(formatNumber(-5000)).toBe("-5,000");
  });
});

describe("formatCurrency", () => {
  it("숫자 + '원' 접미", () => {
    expect(formatCurrency(1500000)).toBe("1,500,000원");
    expect(formatCurrency(0)).toBe("0원");
  });
  it("null → '—' (원 없음)", () => {
    expect(formatCurrency(null)).toBe("—");
  });
});

describe("formatDate", () => {
  it("YYYY-MM-DD 입력 → KST 기준 같은 날짜", () => {
    expect(formatDate("2026-04-22")).toBe("2026-04-22");
  });
  it("ISO timestamptz → KST 날짜", () => {
    // UTC 14:30 = KST 23:30 (같은 날)
    expect(formatDate("2026-04-22T14:30:00Z")).toBe("2026-04-22");
    // UTC 15:30 = KST 다음날 00:30
    expect(formatDate("2026-04-22T15:30:00Z")).toBe("2026-04-23");
  });
  it("잘못된 입력 → 원본 그대로 반환", () => {
    expect(formatDate("invalid")).toBe("invalid");
  });
  it("null/undefined/빈문자 → '—'", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("ISO → KST 로컬 표기", () => {
    const result = formatDateTime("2026-04-22T00:00:00Z");
    // KST 로 +9h: 2026-04-22 09:00
    expect(result).toContain("2026");
    expect(result).toContain("04");
    expect(result).toContain("22");
    expect(result).toContain("09");
  });
  it("null → '—'", () => {
    expect(formatDateTime(null)).toBe("—");
  });
});

describe("dash", () => {
  it("null/undefined → '—'", () => {
    expect(dash(null)).toBe("—");
    expect(dash(undefined)).toBe("—");
  });
  it("빈 문자열 / 공백만 → '—'", () => {
    expect(dash("")).toBe("—");
    expect(dash("   ")).toBe("—");
  });
  it("정상 값 → 그대로", () => {
    expect(dash("abc")).toBe("abc");
    expect(dash(0)).toBe("0");
    expect(dash(1234)).toBe("1234");
  });
});
