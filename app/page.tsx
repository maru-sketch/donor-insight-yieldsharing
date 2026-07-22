"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

type DonationRow = {
  date: string;
  item: string;
  channel: string;
  amount: number;
};

type SafeColumnKey = keyof DonationRow;

type ParsedCsv = {
  rows: DonationRow[];
  detectedHeaders: string[];
  missingChannelCount: number;
};

type DetectedInfo = {
  headers: string[];
  encoding: string;
  missingChannelCount: number;
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

const COLUMN_OPTIONS: { key: SafeColumnKey; label: string }[] = [
  { key: "date", label: "납부일" },
  { key: "item", label: "납부항목" },
  { key: "channel", label: "인입채널" },
  { key: "amount", label: "납부금액" },
];

const DATA_PAGE_SIZE = 20;

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

function findHeaderLine(lines: string[]) {
  const candidates = lines.slice(0, 10).map((line, index) => {
    const headers = splitCsvLine(line);
    const score = Object.values(HEADER_ALIASES)
      .filter((aliases) => findColumn(headers, aliases) >= 0).length;
    return { index, score };
  });
  return candidates.sort((a, b) => b.score - a.score)[0]?.index ?? 0;
}

function parseAmount(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  return cleaned ? Number(cleaned) : Number.NaN;
}

function parseCsv(text: string): ParsedCsv {
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
  if (lines.length < 2) throw new Error("헤더와 데이터 행이 있는 CSV 파일을 선택해 주세요.");
  const headerLine = findHeaderLine(lines);
  const headers = splitCsvLine(lines[headerLine]);
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

  const rows = lines.slice(headerLine + 1).map(splitCsvLine).map((cells) => {
    const channel = cells[indexes.channel]?.trim();
    return {
      date: cells[indexes.date]?.trim() ?? "",
      item: cells[indexes.item]?.trim() ?? "",
      channel: channel || "채널 미입력",
      amount: parseAmount(cells[indexes.amount] ?? ""),
    };
  }).filter((row) => row.date && row.item && Number.isFinite(row.amount) && row.amount >= 0);
  const missingChannelCount = rows.filter((row) => row.channel === "채널 미입력").length;

  if (!rows.length) throw new Error("분석할 수 있는 데이터 행이 없습니다. 날짜·항목·채널·금액 값을 확인해 주세요.");
  return {
    rows,
    detectedHeaders: [headers[indexes.date], headers[indexes.item], headers[indexes.channel], headers[indexes.amount]],
    missingChannelCount,
  };
}

async function decodeCsvFile(file: File) {
  const buffer = await file.arrayBuffer();
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer), encoding: "UTF-8" };
  } catch {
    return { text: new TextDecoder("euc-kr").decode(buffer), encoding: "한글 CSV(CP949)" };
  }
}

function formatWon(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(Math.round(value))}원`;
}

function formatColumnValue(row: DonationRow, key: SafeColumnKey) {
  return key === "amount" ? formatWon(row.amount) : String(row[key]);
}

function monthLabel(value: string) {
  const match = value.match(/(\d{4})[-/.](\d{1,2})/);
  return match ? `${Number(match[2])}월` : value.slice(0, 7);
}

function monthYearLabel(value: string) {
  const match = value.match(/(\d{4})[-/.](\d{1,2})/);
  return match ? `${match[1]}.${String(Number(match[2])).padStart(2, "0")}` : value.slice(0, 7);
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
  const missingChannelCount = channelCounts.get("채널 미입력") ?? 0;
  const topKnownChannel = [...channelCounts.entries()]
    .filter(([channel]) => channel !== "채널 미입력")
    .sort((a, b) => b[1] - a[1])[0] ?? topChannel;
  const topItem = [...itemTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const months = [...monthlyTotals.entries()].sort(([a], [b]) => a.localeCompare(b));
  const latest = months.at(-1)?.[1] ?? 0;
  const previous = months.at(-2)?.[1] ?? latest;
  const change = previous ? ((latest - previous) / previous) * 100 : 0;
  const direction = change >= 0 ? "증가" : "감소";
  return [
    {
      eyebrow: "채널 집중도",
      title: missingChannelCount > 0 ? `인입채널 ${missingChannelCount}건을 먼저 보완하세요` : `${topKnownChannel[0]} 유입을 우선 관리하세요`,
      body: missingChannelCount > 0
        ? `전체 ${rows.length}건 중 ${missingChannelCount}건(${Math.round((missingChannelCount / rows.length) * 100)}%)의 인입채널이 비어 있습니다. 채널 성과를 비교하기 전에 원본 시스템에서 이 값을 먼저 보완해 주세요.`
        : `${topKnownChannel[0]} 채널이 전체 ${rows.length}건 중 ${topKnownChannel[1]}건(${Math.round((topKnownChannel[1] / rows.length) * 100)}%)으로 가장 많습니다. 이 채널의 후원 전환 문구와 재방문 동선을 먼저 점검해 보세요.`,
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
  const [detectedInfo, setDetectedInfo] = useState<DetectedInfo | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<SafeColumnKey[]>(["date", "amount"]);
  const [dataPage, setDataPage] = useState(0);

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

  const monthChannelRows = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    rows.forEach((row) => {
      const month = row.date.slice(0, 7);
      const monthChannels = map.get(month) ?? new Map<string, number>();
      monthChannels.set(row.channel, (monthChannels.get(row.channel) ?? 0) + 1);
      map.set(month, monthChannels);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, counts]) => ({
        month,
        counts,
        total: [...counts.values()].reduce((sum, count) => sum + count, 0),
      }));
  }, [rows]);

  const maxMonthChannelCount = Math.max(
    ...monthChannelRows.flatMap(({ counts }) => channels.map(([channel]) => counts.get(channel) ?? 0)),
    1,
  );

  const selectedColumnOptions = COLUMN_OPTIONS.filter(({ key }) => selectedColumns.includes(key));
  const totalDataPages = Math.max(Math.ceil(rows.length / DATA_PAGE_SIZE), 1);
  const visibleDataRows = rows.slice(dataPage * DATA_PAGE_SIZE, (dataPage + 1) * DATA_PAGE_SIZE);

  const toggleColumn = (key: SafeColumnKey) => {
    setSelectedColumns((current) => {
      const next = current.includes(key)
        ? current.length === 1 ? current : current.filter((column) => column !== key)
        : [...current, key];
      return COLUMN_OPTIONS.filter((option) => next.includes(option.key)).map((option) => option.key);
    });
    setDataPage(0);
  };

  const applyData = (text: string, name: string, encoding = "UTF-8") => {
    try {
      const parsed = parseCsv(text);
      setRows(parsed.rows);
      setInsights(buildInsights(parsed.rows));
      setFileName(name);
      setDetectedInfo({ headers: parsed.detectedHeaders, encoding, missingChannelCount: parsed.missingChannelCount });
      setError("");
      setSavedMessage("");
      setDataPage(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "파일을 분석하지 못했습니다.");
      setRows([]);
      setInsights([]);
      setFileName("");
      setDetectedInfo(null);
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
    const decoded = await decodeCsvFile(file);
    applyData(decoded.text, file.name, decoded.encoding);
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
          <p>열 이름을 직접 바꾸지 않아도 됩니다. 납부일·납부항목·인입채널·납부금액을 자동으로 찾습니다.</p>
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
            <small>UTF-8·한글 CSV(CP949) 자동 인식 · 최대 5MB</small>
          </div>
          <button className="sample-button" type="button" onClick={() => applyData(SAMPLE_CSV, "sample-donations.csv")}>샘플 데이터로 먼저 보기 <span>→</span></button>
          {error && <div className="error-message" role="alert" data-testid="upload-error"><strong>파일을 확인해 주세요</strong><span>{error}</span></div>}
          <details className="privacy-guide">
            <summary>민감정보를 안전하게 준비하는 방법</summary>
            <p>가능하면 성명·연락처 열을 삭제하거나 마스킹하세요. 포함되어 있어도 이 앱은 해당 열을 분석·표시·저장하지 않습니다. 원본 행은 브라우저를 닫으면 사라집니다.</p>
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

          {detectedInfo && (
            <div className="detected-columns" data-testid="detected-columns">
              <div>
                <strong>필수 열을 자동으로 찾았습니다</strong>
                <span>{detectedInfo.encoding} · 성명·회원번호·계좌 등 다른 열은 분석하지 않습니다.</span>
              </div>
              <div className="detected-tags" aria-label="자동 인식된 필수 열">
                {detectedInfo.headers.map((header) => <span key={header}>{header}</span>)}
                {detectedInfo.missingChannelCount > 0 && <span className="notice">채널 미입력 {detectedInfo.missingChannelCount}건 별도 분류</span>}
              </div>
            </div>
          )}

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

          <article className="chart-card monthly-channel-card" data-testid="monthly-channel-matrix">
            <div className="card-heading">
              <div><span>교차 분석</span><h3>월별 × 인입채널</h3></div>
              <span className="unit">진할수록 인입 건수가 많음</span>
            </div>
            <p className="matrix-description">월마다 어떤 채널에서 몇 건이 들어왔는지 비교합니다. 가로로 움직이면 모든 채널을 볼 수 있습니다.</p>
            <div className="matrix-scroll">
              <table className="channel-matrix">
                <caption className="sr-only">월별 인입채널별 후원 건수</caption>
                <thead>
                  <tr>
                    <th scope="col">월</th>
                    {channels.map(([channel]) => <th scope="col" key={channel}>{channel}</th>)}
                    <th scope="col">월 합계</th>
                  </tr>
                </thead>
                <tbody>
                  {monthChannelRows.map(({ month, counts, total }) => (
                    <tr key={month}>
                      <th scope="row">{monthYearLabel(month)}</th>
                      {channels.map(([channel]) => {
                        const count = counts.get(channel) ?? 0;
                        const intensity = count / maxMonthChannelCount;
                        return (
                          <td
                            key={channel}
                            aria-label={`${monthYearLabel(month)} ${channel} ${count}건`}
                            style={{ backgroundColor: count ? `rgba(46, 113, 98, ${0.12 + intensity * 0.7})` : undefined }}
                          >
                            {count ? `${count}건` : "–"}
                          </td>
                        );
                      })}
                      <td className="matrix-total">{total}건</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="column-viewer-card" data-testid="column-viewer">
            <div className="card-heading">
              <div><span>맞춤 데이터 보기</span><h3>데이터 보기 설정</h3></div>
              <span className="unit">현재 {selectedColumns.length}개 열 · 전체 {rows.length}건</span>
            </div>
            <p className="matrix-description">확인하고 싶은 열만 선택하세요. 성명·연락처·계좌 등 민감한 열은 선택 목록과 화면에 나타나지 않습니다.</p>

            <fieldset className="column-picker">
              <legend className="sr-only">표시할 데이터 열 선택</legend>
              {COLUMN_OPTIONS.map(({ key, label }) => {
                const isSelected = selectedColumns.includes(key);
                return (
                  <label className={`column-toggle ${isSelected ? "is-selected" : ""}`} key={key}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isSelected && selectedColumns.length === 1}
                      onChange={() => toggleColumn(key)}
                    />
                    <span aria-hidden="true">{isSelected ? "✓" : "+"}</span>
                    {label}
                  </label>
                );
              })}
            </fieldset>

            <div className="selected-table-scroll">
              <table
                className="selected-data-table"
                data-testid="selected-data-table"
                style={{ minWidth: `${Math.max(selectedColumns.length * 180, 320)}px` }}
              >
                <caption className="sr-only">선택한 열만 표시한 후원 데이터</caption>
                <thead>
                  <tr>{selectedColumnOptions.map(({ key, label }) => <th scope="col" key={key}>{label}</th>)}</tr>
                </thead>
                <tbody>
                  {visibleDataRows.map((row, index) => (
                    <tr key={`${dataPage}-${index}`}>
                      {selectedColumnOptions.map(({ key }) => (
                        <td className={key === "amount" ? "amount-cell" : undefined} key={key}>{formatColumnValue(row, key)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="data-pagination" aria-label="데이터 페이지 이동">
              <span>{dataPage + 1} / {totalDataPages} 페이지 · 한 번에 {DATA_PAGE_SIZE}건</span>
              <div>
                <button type="button" className="outline-button" disabled={dataPage === 0} onClick={() => setDataPage((page) => Math.max(page - 1, 0))}>이전</button>
                <button type="button" className="outline-button" disabled={dataPage >= totalDataPages - 1} onClick={() => setDataPage((page) => Math.min(page + 1, totalDataPages - 1))}>다음</button>
              </div>
            </div>
          </article>

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
