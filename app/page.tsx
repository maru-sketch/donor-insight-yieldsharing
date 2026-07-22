"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

type DonationRow = {
  date: string;
  item: string;
  channel: string;
  amount: number;
};

type Insight = {
  eyebrow: string;
  title: string;
  body: string;
  tone: "orange" | "green" | "ink";
};

const SAMPLE_CSV = `납부일,납부항목,인입채널,납부금액
2026-01-12,정기후원,홈페이지,30000
2026-01-18,일시후원,SNS,50000
2026-02-03,정기후원,홈페이지,30000
2026-02-14,일시후원,행사,120000
2026-03-05,정기후원,홈페이지,30000
2026-03-19,기업후원,소개,300000
2026-04-02,정기후원,홈페이지,30000
2026-04-11,일시후원,SNS,70000
2026-05-06,정기후원,홈페이지,30000
2026-05-22,일시후원,SNS,100000
2026-06-08,정기후원,홈페이지,30000
2026-06-20,기업후원,소개,450000`;

const HEADER_ALIASES = {
  date: ["납부일", "납부일자", "결제일", "date"],
  item: ["납부항목", "후원유형", "기부유형", "item"],
  channel: ["인입채널", "유입채널", "채널", "channel"],
  amount: ["납부금액", "후원금액", "기부금액", "금액", "amount"],
};

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").replace(/[\s_-]/g, "").toLowerCase();
}

function findColumn(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function parseCsv(text: string): DonationRow[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
  if (lines.length < 2) throw new Error("헤더와 데이터 행이 있는 CSV 파일을 선택해 주세요.");
  const headers = splitCsvLine(lines[0]);
  const indexes = {
    date: findColumn(headers, HEADER_ALIASES.date),
    item: findColumn(headers, HEADER_ALIASES.item),
    channel: findColumn(headers, HEADER_ALIASES.channel),
    amount: findColumn(headers, HEADER_ALIASES.amount),
  };
  const missing = Object.entries(indexes)
    .filter(([, index]) => index < 0)
    .map(([key]) => ({ date: "납부일", item: "납부항목", channel: "인입채널", amount: "납부금액" })[key as keyof typeof indexes]);
  if (missing.length) throw new Error(`필수 열을 찾지 못했습니다: ${missing.join(", ")}. 열 이름을 확인해 주세요.`);

  const rows = lines.slice(1).map(splitCsvLine).map((cells) => ({
    date: cells[indexes.date]?.trim() ?? "",
    item: cells[indexes.item]?.trim() ?? "",
    channel: cells[indexes.channel]?.trim() ?? "",
    amount: Number((cells[indexes.amount] ?? "").replace(/[^0-9.-]/g, "")),
  })).filter((row) => row.date && row.item && row.channel && Number.isFinite(row.amount) && row.amount >= 0);

  if (!rows.length) throw new Error("분석할 수 있는 데이터 행이 없습니다. 날짜·항목·채널·금액 값을 확인해 주세요.");
  return rows;
}

function formatWon(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(Math.round(value))}원`;
}

function monthLabel(value: string) {
  const match = value.match(/(\d{4})[-/.](\d{1,2})/);
  return match ? `${Number(match[2])}월` : value.slice(0, 7);
}

function buildInsights(rows: DonationRow[]): Insight[] {
  const channelCounts = new Map<string, number>();
  const itemTotals = new Map<string, number>();
  const monthlyTotals = new Map<string, number>();
  rows.forEach((row) => {
    channelCounts.set(row.channel, (channelCounts.get(row.channel) ?? 0) + 1);
    itemTotals.set(row.item, (itemTotals.get(row.item) ?? 0) + row.amount);
    const month = row.date.slice(0, 7);
    monthlyTotals.set(month, (monthlyTotals.get(month) ?? 0) + row.amount);
  });
  const topChannel = [...channelCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topItem = [...itemTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const months = [...monthlyTotals.entries()].sort(([a], [b]) => a.localeCompare(b));
  const latest = months.at(-1)?.[1] ?? 0;
  const previous = months.at(-2)?.[1] ?? latest;
  const change = previous ? ((latest - previous) / previous) * 100 : 0;
  const direction = change >= 0 ? "증가" : "감소";
  return [
    {
      eyebrow: "채널 집중도",
      title: `${topChannel[0]} 유입을 우선 관리하세요`,
      body: `${topChannel[0]} 채널이 전체 ${rows.length}건 중 ${topChannel[1]}건(${Math.round((topChannel[1] / rows.length) * 100)}%)으로 가장 많습니다. 이 채널의 후원 전환 문구와 재방문 동선을 먼저 점검해 보세요.`,
      tone: "orange",
    },
    {
      eyebrow: "후원 구성",
      title: `${topItem[0]}이 가장 큰 금액을 만들었습니다`,
      body: `${topItem[0]} 누적 금액은 ${formatWon(topItem[1])}입니다. 단일 고액 후원에 치우친 결과인지 담당자가 원본 내역을 확인한 뒤 다음 요청 전략에 반영하세요.`,
      tone: "green",
    },
    {
      eyebrow: "최근 흐름",
      title: `최근 월 납부액이 ${Math.abs(Math.round(change))}% ${direction}했습니다`,
      body: `가장 최근 월은 ${formatWon(latest)}, 직전 월은 ${formatWon(previous)}입니다. 계절성이나 캠페인 영향인지 확인할 수 있도록 같은 기간의 활동 기록과 함께 검토하세요.`,
      tone: "ink",
    },
  ];
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<DonationRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [savedMessage, setSavedMessage] = useState("");

  const summary = useMemo(() => {
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    return { total, average: rows.length ? total / rows.length : 0, count: rows.length };
  }, [rows]);

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row) => map.set(row.date.slice(0, 7), (map.get(row.date.slice(0, 7)) ?? 0) + row.amount));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const channels = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row) => map.set(row.channel, (map.get(row.channel) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const applyData = (text: string, name: string) => {
    try {
      const parsed = parseCsv(text);
      setRows(parsed);
      setInsights(buildInsights(parsed));
      setFileName(name);
      setError("");
      setSavedMessage("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "파일을 분석하지 못했습니다.");
      setRows([]);
      setInsights([]);
      setFileName("");
    }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("CSV 파일만 업로드할 수 있습니다. 엑셀 파일은 ‘CSV UTF-8’ 형식으로 저장한 뒤 다시 선택해 주세요.");
      setRows([]);
      setInsights([]);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("파일이 5MB를 넘습니다. 필요한 기간만 남겨 CSV를 나눈 뒤 다시 선택해 주세요.");
      return;
    }
    applyData(await file.text(), file.name);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFile(event.dataTransfer.files?.[0]);
  };

  const saveInsights = () => {
    localStorage.setItem("donor-insight-draft", JSON.stringify(insights.map(({ title, body }) => ({ title, body }))));
    setSavedMessage(`이 기기에 저장됨 · ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`);
  };

  const exportReport = () => {
    const report = [
      "후원자 데이터 인사이트 리포트",
      `분석 파일: ${fileName}`,
      `납부 총액: ${formatWon(summary.total)}`,
      `평균 납부액: ${formatWon(summary.average)}`,
      `분석 건수: ${summary.count}건`,
      "",
      ...insights.flatMap((insight, index) => [`${index + 1}. ${insight.title}`, insight.body, ""]),
      "안내: 이 보고서는 브라우저 내 패턴 분석으로 생성된 초안이며, 전략 반영 전 담당자 검토가 필요합니다.",
    ].join("\n");
    const blob = new Blob([`\uFEFF${report}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "후원자-데이터-인사이트-리포트.txt";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const updateInsight = (index: number, key: "title" | "body", value: string) => {
    setInsights((current) => current.map((insight, insightIndex) => insightIndex === index ? { ...insight, [key]: value } : insight));
    setSavedMessage("저장되지 않은 변경사항");
  };

  const maxMonthly = Math.max(...monthly.map(([, value]) => value), 1);
  const maxChannel = Math.max(...channels.map(([, value]) => value), 1);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="후원 데이터 인사이트 홈">
          <span className="brand-mark">열매</span>
          <span>Fundraising Insight</span>
        </a>
        <div className="privacy-badge"><span aria-hidden="true">●</span> 브라우저 내 안전 분석</div>
      </header>

      <section id="top" className="hero shell">
        <div className="hero-copy">
          <p className="kicker">후원 데이터를 전략으로 바꾸는 가장 짧은 경로</p>
          <h1>숫자 사이의 <em>기부 신호</em>를<br />놓치지 마세요.</h1>
          <p className="hero-description">CSV 한 장이면 납부 흐름과 인입 채널을 읽고, 바로 검토할 수 있는 모금 전략 초안으로 정리합니다.</p>
          <div className="trust-row" aria-label="개인정보 보호 원칙">
            <span>원본 서버 저장 없음</span>
            <span>성명·연락처 분석 제외</span>
            <span>담당자 최종 검토</span>
          </div>
        </div>

        <div className="upload-panel" aria-labelledby="upload-title">
          <div className="step-label">STEP 01</div>
          <h2 id="upload-title">데이터를 불러오세요</h2>
          <p>필수 열: 납부일, 납부항목, 인입채널, 납부금액</p>
          <div
            className={`dropzone ${isDragging ? "is-dragging" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            data-testid="upload-dropzone"
          >
            <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFileChange} aria-label="후원자 CSV 파일 선택" />
            <div className="upload-icon" aria-hidden="true">↑</div>
            <strong>CSV 파일을 여기에 놓거나</strong>
            <button type="button" className="primary-button" onClick={() => inputRef.current?.click()}>파일 선택</button>
            <small>CSV UTF-8 · 최대 5MB</small>
          </div>
          <button className="sample-button" type="button" onClick={() => applyData(SAMPLE_CSV, "sample-donations.csv")}>샘플 데이터로 먼저 보기 <span>→</span></button>
          {error && <div className="error-message" role="alert" data-testid="upload-error"><strong>파일을 확인해 주세요</strong><span>{error}</span></div>}
          <details className="privacy-guide">
            <summary>민감정보를 안전하게 준비하는 방법</summary>
            <p>가능하면 성명·연락처 열을 삭제하거나 마스킹하세요. 포함되어 있어도 이 앱은 해당 열을 읽거나 저장하지 않습니다. 원본 행은 브라우저를 닫으면 사라집니다.</p>
          </details>
        </div>
      </section>

      {rows.length > 0 && (
        <section className="dashboard shell" aria-live="polite">
          <div className="section-heading">
            <div>
              <p className="kicker">분석 완료 · {fileName}</p>
              <h2>후원 흐름 한눈에 보기</h2>
            </div>
            <button type="button" className="outline-button" onClick={() => inputRef.current?.click()}>다른 파일 분석</button>
          </div>

          <div className="metric-grid">
            <article className="metric-card featured"><span>납부 총액</span><strong>{formatWon(summary.total)}</strong><small>업로드 파일 전체 기준</small></article>
            <article className="metric-card"><span>평균 납부액</span><strong>{formatWon(summary.average)}</strong><small>1건당 평균 금액</small></article>
            <article className="metric-card"><span>분석 건수</span><strong>{summary.count}건</strong><small>유효한 납부 데이터</small></article>
          </div>

          <div className="chart-grid">
            <article className="chart-card" data-testid="monthly-chart">
              <div className="card-heading"><div><span>금액 추이</span><h3>월별 납부금액</h3></div><span className="unit">단위: 원</span></div>
              <div className="bar-chart" role="img" aria-label="월별 납부금액 막대 차트">
                {monthly.map(([month, value]) => (
                  <div className="bar-column" key={month}>
                    <span className="bar-value">{value >= 10000 ? `${Math.round(value / 10000)}만` : value}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max((value / maxMonthly) * 100, 5)}%` }} /></div>
                    <span className="bar-label">{monthLabel(month)}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="chart-card" data-testid="channel-chart">
              <div className="card-heading"><div><span>유입 분포</span><h3>인입 채널별 기부 빈도</h3></div><span className="unit">총 {summary.count}건</span></div>
              <div className="channel-chart" role="img" aria-label="인입 채널별 기부 빈도 가로 막대 차트">
                {channels.map(([channel, value], index) => (
                  <div className="channel-row" key={channel}>
                    <div className="channel-meta"><span>{channel}</span><strong>{value}건</strong></div>
                    <div className="channel-track"><div className={`channel-fill tone-${(index % 3) + 1}`} style={{ width: `${Math.max((value / maxChannel) * 100, 8)}%` }} /></div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <section className="insight-section" aria-labelledby="insight-title">
            <div className="section-heading insight-heading">
              <div>
                <p className="kicker">STEP 02 · 브라우저 내 패턴 분석</p>
                <h2 id="insight-title">전략 인사이트 초안</h2>
                <p className="section-description">외부 AI로 원본 데이터를 보내지 않고 통계 패턴에서 초안을 만들었습니다. 전략에 반영하기 전 담당자가 꼭 검토해 주세요.</p>
              </div>
              <div className="editor-actions">
                <span className={savedMessage.includes("저장되지") ? "save-status pending" : "save-status"}>{savedMessage}</span>
                <button type="button" className="outline-button" onClick={exportReport}>리포트 내보내기</button>
                <button type="button" className="primary-button" onClick={saveInsights}>수정 문구 저장</button>
              </div>
            </div>

            <div className="insight-grid">
              {insights.map((insight, index) => (
                <article className={`insight-card ${insight.tone}`} key={insight.eyebrow} data-testid={`insight-${index + 1}`}>
                  <div className="insight-number">0{index + 1}</div>
                  <span>{insight.eyebrow}</span>
                  <label>
                    <span className="sr-only">인사이트 {index + 1} 제목</span>
                    <textarea className="insight-title-input" value={insight.title} onChange={(event) => updateInsight(index, "title", event.target.value)} rows={2} />
                  </label>
                  <label>
                    <span className="sr-only">인사이트 {index + 1} 본문</span>
                    <textarea className="insight-body-input" value={insight.body} onChange={(event) => updateInsight(index, "body", event.target.value)} rows={5} />
                  </label>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      <footer className="footer shell"><span>Fundraising Insight · 열매나눔재단 모금 담당자를 위한 분석 도구</span><span>원본 데이터는 서버에 저장되지 않습니다.</span></footer>
    </main>
  );
}
