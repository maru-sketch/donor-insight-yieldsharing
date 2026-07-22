import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished donor insight experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /후원자 데이터 인사이트 대시보드/);
  assert.match(html, /숫자 사이의/);
  assert.match(html, /CSV 파일을 여기에 놓거나/);
  assert.match(html, /원본 서버 저장 없음/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the TEST-01~03 interaction contracts in the product source", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /data-testid="upload-dropzone"/);
  assert.match(page, /data-testid="upload-error"/);
  assert.match(page, /data-testid="monthly-chart"/);
  assert.match(page, /data-testid="channel-chart"/);
  assert.match(page, /수정 문구 저장/);
  assert.match(page, /donor-insight-draft/);
  assert.match(page, /원본 행은 브라우저를 닫으면 사라집니다/);
  assert.match(page, /new Blob/);
  assert.match(page, /후원자-데이터-인사이트-리포트\.txt/);
  assert.match(page, /document\.body\.appendChild\(anchor\)/);
  assert.match(page, /anchor\.click\(\)/);
});

test("auto-detects the supplied Korean CSV shape without storing private columns", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /TextDecoder\("utf-8", \{ fatal: true \}\)/);
  assert.match(page, /TextDecoder\("euc-kr"\)/);
  assert.match(page, /자동으로 찾습니다/);
  assert.match(page, /채널 미입력/);
  assert.match(page, /인입채널.*먼저 보완하세요/);
  assert.match(page, /data-testid="detected-columns"/);
  const donationRow = page.match(/type DonationRow = \{[\s\S]*?\n\};/)?.[0] ?? "";
  assert.doesNotMatch(donationRow, /memberName|contact|account|회원명|입금계좌/);
  assert.doesNotMatch(page, /localStorage\.setItem\([^\n]*memberKey/);
});

test("shows monthly acquisition counts broken down by channel", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /data-testid="monthly-channel-matrix"/);
  assert.match(page, /월별 × 인입채널/);
  assert.match(page, /monthChannelRows/);
  assert.match(page, /monthYearLabel\(month\)/);
  assert.match(page, /월 합계/);
});

test("lets the user choose only the safe data columns they want to see", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /data-testid="column-viewer"/);
  assert.match(page, /데이터 보기 설정/);
  assert.match(page, /selectedColumns/);
  assert.match(page, /납부일/);
  assert.match(page, /납부항목/);
  assert.match(page, /인입채널/);
  assert.match(page, /납부금액/);
  assert.match(page, /data-testid="selected-data-table"/);
  const options = page.match(/const COLUMN_OPTIONS[\s\S]*?\n\];/)?.[0] ?? "";
  assert.doesNotMatch(options, /회원명|연락처|입금계좌/);
});

test("calculates donor retention from start and stop dates without exposing donor ids", async () => {
  const { calculateRetention } = await import("../app/retention.mjs");
  const retention = calculateRetention([
    { memberKey: "A", startDate: "2026-01", endDate: "", date: "2026-07-22" },
    { memberKey: "B", startDate: "2026-02", endDate: "2026-04-15", date: "2026-04-15" },
    { memberKey: "C", startDate: "2026-03", endDate: "2026-12", date: "2026-07-10" },
  ]);

  assert.equal(retention.eligibleDonors, 3);
  assert.equal(retention.retainedDonors, 2);
  assert.equal(retention.endedDonors, 1);
  assert.equal(retention.retentionRate, 66.7);
  assert.equal(retention.asOf, "2026-07-22");
  assert.ok(retention.averageMonths > 0);
  assert.equal(calculateRetention([{ date: "2026-07-22" }]), null);

  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /data-testid="retention-summary"/);
  assert.match(page, /평균 후원 유지율/);
  assert.match(page, /평균 후원기간/);
  assert.match(page, /회원번호는 중복 후원자 구분에만/);
  assert.doesNotMatch(page, /\{row\.memberKey\}/);
});
