const DAY_MS = 24 * 60 * 60 * 1_000;
const AVERAGE_DAYS_PER_MONTH = 365.25 / 12;

function parseDateValue(value, monthEnd = false) {
  const match = String(value ?? "").trim().match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] ? Number(match[3]) : monthEnd ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 1;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.valueOf()) ? null : date;
}

/**
 * 회원번호는 브라우저 메모리에서 중복 후원자를 묶는 데만 사용한다.
 * 반환값에는 회원번호나 원본 행을 포함하지 않는다.
 */
export function calculateRetention(rows) {
  const paymentDates = rows.map((row) => parseDateValue(row.date)).filter(Boolean);
  if (!paymentDates.length) return null;

  const asOfDate = new Date(Math.max(...paymentDates.map((date) => date.valueOf())));
  const groups = new Map();
  rows.forEach((row) => {
    const memberKey = String(row.memberKey ?? "").trim();
    if (!memberKey) return;
    const group = groups.get(memberKey) ?? [];
    group.push(row);
    groups.set(memberKey, group);
  });

  let retainedDonors = 0;
  let endedDonors = 0;
  const durations = [];

  groups.forEach((group) => {
    const starts = group.map((row) => parseDateValue(row.startDate)).filter(Boolean);
    if (!starts.length) return;
    const startDate = new Date(Math.min(...starts.map((date) => date.valueOf())));
    const ends = group.map((row) => parseDateValue(row.endDate, true)).filter(Boolean);
    const retained = group.some((row) => {
      const endDate = parseDateValue(row.endDate, true);
      return !endDate || endDate >= asOfDate;
    });

    if (retained) retainedDonors += 1;
    else endedDonors += 1;

    const endPoint = retained || !ends.length
      ? asOfDate
      : new Date(Math.max(...ends.map((date) => date.valueOf())));
    durations.push(Math.max(0, (endPoint.valueOf() - startDate.valueOf()) / DAY_MS / AVERAGE_DAYS_PER_MONTH));
  });

  const eligibleDonors = durations.length;
  if (!eligibleDonors) return null;
  return {
    asOf: asOfDate.toISOString().slice(0, 10),
    eligibleDonors,
    retainedDonors,
    endedDonors,
    retentionRate: Math.round((retainedDonors / eligibleDonors) * 1_000) / 10,
    averageMonths: Math.round((durations.reduce((sum, value) => sum + value, 0) / eligibleDonors) * 10) / 10,
  };
}
