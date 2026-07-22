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
});

