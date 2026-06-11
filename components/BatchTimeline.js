import React, { useMemo } from 'react';

const MALAY_MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];

function parseDate(dateStr) {
  if (!dateStr) return null;
  // Append noon to avoid timezone-induced date shifts
  return new Date(dateStr + 'T12:00:00');
}

function fmtDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '';
  return `${d.getDate()} ${MALAY_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function BatchTimeline({ rounds }) {
  const validRounds = useMemo(
    () => (rounds || []).filter(r => r.start_date && r.end_date),
    [rounds]
  );

  if (!validRounds.length) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm bg-gray-900 rounded-xl">
        Tiada jadual batch ditemui
      </div>
    );
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  // Timeline bounds (expand to month boundaries)
  const allMs = validRounds.flatMap(r => [parseDate(r.start_date).getTime(), parseDate(r.end_date).getTime()]);
  const minMs = Math.min(...allMs);
  const maxMs = Math.max(...allMs);
  const minD = new Date(minMs);
  const maxD = new Date(maxMs);
  const timelineStart = new Date(minD.getFullYear(), minD.getMonth(), 1);
  const timelineEnd   = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0, 23, 59, 59);
  const totalMs = timelineEnd.getTime() - timelineStart.getTime();

  const toPct = (date) => {
    if (!date || totalMs === 0) return 0;
    return Math.max(0, Math.min(100, (date.getTime() - timelineStart.getTime()) / totalMs * 100));
  };

  // Month tick marks
  const months = [];
  const cursor = new Date(timelineStart.getFullYear(), timelineStart.getMonth(), 1);
  while (cursor <= timelineEnd) {
    months.push({ label: MALAY_MONTHS[cursor.getMonth()], year: cursor.getFullYear(), month: cursor.getMonth(), pct: toPct(cursor) });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Group rounds into cohort pairs: Bangkit N + Maju (N-1) share cohort N.
  // Normalise program to lowercase before any comparison.
  // cohort = batchNum if bangkit, batchNum + 1 if maju.
  const cohortMap = {};
  validRounds.forEach(r => {
    const prog  = (r.program || '').toLowerCase();
    const bname = r.batch_name || 'Unknown';
    const numMatch  = bname.match(/\d+/);
    const batchNum  = numMatch ? parseInt(numMatch[0], 10) : 0;
    const isBangkit = prog.includes('bangkit');
    const cohortNum = isBangkit ? batchNum : batchNum + 1;
    const progKey   = isBangkit ? 'bangkit' : 'maju';

    if (!cohortMap[cohortNum]) cohortMap[cohortNum] = {};
    if (!cohortMap[cohortNum][progKey]) cohortMap[cohortNum][progKey] = { batchName: bname, rounds: [] };
    cohortMap[cohortNum][progKey].rounds.push(r);
  });

  const cohorts = Object.keys(cohortMap).map(Number).sort((a, b) => a - b);

  const todayPct = toPct(today);
  const todayInRange = today >= timelineStart && today <= timelineEnd;

  const barColor = (r) => {
    const rEnd   = parseDate(r.end_date);
    const rStart = parseDate(r.start_date);
    if (today > rEnd)    return 'bg-gray-600';
    if (today >= rStart) return 'bg-green-500';
    return 'bg-blue-500';
  };

  return (
    <div className="bg-gray-900 rounded-xl p-5 overflow-x-auto text-sm select-none">
      <div className="min-w-[640px]">

        {/* Month header row */}
        <div className="flex items-end mb-1">
          <div className="w-40 shrink-0" />
          <div className="flex-1 relative h-6">
            {months.map((m, i) => (
              <div
                key={i}
                className="absolute top-0"
                style={{ left: `${m.pct}%` }}
              >
                {/* Tick line */}
                <div className="w-px h-3 bg-gray-600 mx-auto" />
                <span className="block text-[11px] text-gray-400 whitespace-nowrap -translate-x-1/2 mt-0.5">
                  {m.label}
                  {(i === 0 || m.month === 0)
                    ? ` '${String(m.year).slice(2)}`
                    : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* "HARI INI" label row */}
        {todayInRange && (
          <div className="flex mb-1">
            <div className="w-40 shrink-0" />
            <div className="flex-1 relative h-5">
              <div
                className="absolute top-0 flex flex-col items-center"
                style={{ left: `${todayPct}%`, transform: 'translateX(-50%)' }}
              >
                <span className="text-red-400 text-[10px] font-bold whitespace-nowrap leading-tight">HARI INI</span>
              </div>
            </div>
          </div>
        )}

        {/* Cohort groups — Bangkit row first, Maju row second */}
        {cohorts.map((cohortNum, cohortIdx) => {
          const cohort = cohortMap[cohortNum];
          const rows = [
            cohort.bangkit ? { key: 'bangkit', ...cohort.bangkit } : null,
            cohort.maju    ? { key: 'maju',    ...cohort.maju    } : null,
          ].filter(Boolean);

          return (
            <div
              key={cohortNum}
              className={cohortIdx > 0 ? 'border-t border-gray-700 pt-3 mb-3' : 'mb-3'}
            >
              {rows.map(({ key, batchName, rounds: batchRounds }) => (
                <div key={key} className="flex items-center mb-2">
                  {/* Batch label */}
                  <div className="w-40 shrink-0 pr-3">
                    <span className="text-xs text-gray-300 font-medium truncate block" title={batchName}>
                      {batchName}
                    </span>
                  </div>

                  {/* Gantt row */}
                  <div className="flex-1 relative h-8 bg-gray-800 rounded overflow-visible">
                    {/* Today line */}
                    {todayInRange && (
                      <div
                        className="absolute top-0 h-full w-px bg-red-500 z-10 pointer-events-none"
                        style={{ left: `${todayPct}%` }}
                      />
                    )}

                    {/* Round bars */}
                    {batchRounds.map((round) => {
                      const rStart   = parseDate(round.start_date);
                      const rEnd     = parseDate(round.end_date);
                      const leftPct  = toPct(rStart);
                      const rightPct = toPct(rEnd);
                      const widthPct = Math.max(1, rightPct - leftPct);
                      const color    = barColor(round);

                      return (
                        <div
                          key={round.id}
                          className={`absolute top-1 h-6 rounded ${color} flex items-center justify-center group cursor-default z-20`}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        >
                          <span className="text-[11px] text-white font-bold px-1 leading-none pointer-events-none truncate">
                            R{round.round_number}
                          </span>

                          {/* Hover tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 pointer-events-none">
                            <div className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 shadow-xl text-left" style={{ minWidth: '200px' }}>
                              <p className="text-white font-semibold text-xs leading-snug mb-1">
                                {round.round_name || `Pusingan ${round.round_number}`}
                              </p>
                              {round.period_label && (
                                <p className="text-gray-300 text-xs mb-1">{round.period_label}</p>
                              )}
                              <p className="text-gray-400 text-xs">
                                {fmtDate(round.start_date)} – {fmtDate(round.end_date)}
                              </p>
                            </div>
                            {/* Arrow */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-600" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-2 pt-3 border-t border-gray-700">
          <span className="text-[11px] text-gray-500">Petunjuk:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-[11px] text-gray-400">Semasa</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-[11px] text-gray-400">Akan datang</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-600" />
            <span className="text-[11px] text-gray-400">Selesai</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-px h-4 bg-red-500" />
            <span className="text-[11px] text-gray-400">Hari Ini</span>
          </div>
        </div>

      </div>
    </div>
  );
}
