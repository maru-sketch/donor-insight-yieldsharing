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
  assert.doesNotMatch(page, /회원명.*DonationRow|회원번호.*DonationRow|입금계좌.*DonationRow/s);
});

test("shows monthly acquisition counts broken down by channel", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /data-testid="monthly-channel-matrix"/);
  assert.match(page, /월별 × 인입채널/);
  assert.match(page, /monthChannelRows/);
  assert.match(page, /monthYearLabel\(month\)/);
  assert.match(page, /월 합계/);
});
