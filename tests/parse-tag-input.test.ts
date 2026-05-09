// NOTE: 단위 테스트 — 순수 함수 입출력. DB X, 외부 의존성 X.
// docs/22 §13 우선 ★★ — trim/lowercase/dedupe 함정 박제.
import { describe, expect, test } from "vitest";
import { parseTagInput } from "@/lib/tags";

describe("parseTagInput", () => {
  test("빈/null/undefined 입력은 빈 배열", () => {
    expect(parseTagInput("")).toEqual([]);
    expect(parseTagInput(null)).toEqual([]);
    expect(parseTagInput(undefined)).toEqual([]);
    expect(parseTagInput("   ")).toEqual([]);
  });

  test("쉼표로 분리하고 trim", () => {
    expect(parseTagInput("react, typescript, nextjs")).toEqual([
      "react",
      "typescript",
      "nextjs",
    ]);
  });

  test("lowercase 정규화 — 대소문자 변형이 같은 태그로", () => {
    expect(parseTagInput("React, react, REACT")).toEqual(["react"]);
  });

  test("입력 단계 dedupe — 같은 이름 한 번만", () => {
    expect(parseTagInput("react, typescript, react")).toEqual([
      "react",
      "typescript",
    ]);
  });

  test("빈 항목 / 공백만 항목 필터링", () => {
    expect(parseTagInput(",,react,,, ,typescript,")).toEqual([
      "react",
      "typescript",
    ]);
  });

  test("50자 초과 태그는 무시", () => {
    const long = "a".repeat(51);
    expect(parseTagInput(`${long}, react`)).toEqual(["react"]);
  });

  test("정확히 50자는 통과", () => {
    const exact = "a".repeat(50);
    expect(parseTagInput(exact)).toEqual([exact]);
  });

  test("최대 20개 태그 제한", () => {
    const twentyFive = Array.from({ length: 25 }, (_, i) => `tag${i}`).join(
      ",",
    );
    expect(parseTagInput(twentyFive)).toHaveLength(20);
  });

  test("한글 태그 OK (lowercase 의미 약함)", () => {
    expect(parseTagInput("리액트, 타입스크립트")).toEqual([
      "리액트",
      "타입스크립트",
    ]);
  });
});