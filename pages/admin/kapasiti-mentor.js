import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessAdmin, isReadOnly } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';
import ReadOnlyBadge from '../../components/ReadOnlyBadge';

// TEMPORARY: admin staff accounts that exist in `mentors` but are not real mentors.
// Stage 3 replaces this with a DB flag on the mentors table.
const HIDDEN_FROM_CAPACITY_EMAILS = ['maryam@startlah.my', 'hanisah.safwan91@gmail.com'];

const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];

// 'YYYY-MM-DD' → 'dd MMM yyyy' (parsed manually to avoid timezone shifts)
function formatTarikh(iso) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${BULAN[m - 1]} ${y}`;
}

function hariLagi(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const end = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end - today) / 86400000);
}

const STATUS_LABEL = { active: 'Aktif', rehat: 'Rehat', inactive: 'Tidak Aktif' };

function StatusBadge({ status }) {
  if (status === 'active') return null;
  const cls = status === 'rehat'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-gray-50 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function Section({ title, count, children }) {
  const [open, setOpen] = useState(count > 0);
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <span className="font-semibold text-gray-900">{title}</span>
        <span className="flex items-center gap-3">
          {count > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">{count}</span>
          ) : (
            <span className="text-xs font-semibold text-green-700">Tiada</span>
          )}
          <span className="text-gray-500 text-sm">{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && <div className="bg-gray-50 border-t border-gray-200 p-4">{children}</div>}
    </div>
  );
}

function EndedBatch({ batch }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 bg-white rounded-lg mb-2 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-left"
      >
        <span className="text-sm text-gray-900">
          {batch.batch_name} <span className="text-gray-500">({batch.pair}, tamat {formatTarikh(batch.last_end)})</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">{batch.count}</span>
          <span className="text-gray-500 text-sm">{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && (
        <table className="w-full text-sm">
          <thead className="text-gray-600 text-xs uppercase">
            <tr><th className="text-left px-4 py-2">Mentor</th><th className="text-left px-4 py-2">Usahawan</th></tr>
          </thead>
          <tbody>
            {batch.list.map(r => (
              <tr key={r.assignment_id} className="border-t border-gray-200">
                <td className="px-4 py-2 text-gray-900">{r.mentor}</td>
                <td className="px-4 py-2 text-gray-700">{r.entrepreneur}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function cellClass(total, cap) {
  if (total > cap) return 'bg-red-50 text-red-700 font-semibold';
  if (total === cap) return 'bg-amber-50 text-amber-700 font-semibold';
  if (total === 0) return 'text-gray-300';
  return 'text-gray-900';
}

// ---------- Perancang Peruntukan Batch Baharu (client-side draft, no DB writes) ----------

const PLAN_KEY = 'kapasiti-plan-v1';
const PLAN_WINDOWS = [60, 90, 120];
const PLAN_SORTS = ['ruang', 'name', 'total'];
const PLAN_DEFAULT = {
  total: '',
  defaultHad: '10',
  windowDays: 60,
  search: '',
  showInactive: false,
  sortBy: 'ruang',
  hadOverrides: {},
  alloc: {},
};

// Non-numeric → 0, negatives clamped to 0
function toCount(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function sanitizePlan(saved) {
  if (!saved || typeof saved !== 'object') return PLAN_DEFAULT;
  const str = (v, d) => (typeof v === 'string' ? v : d);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  return {
    total: str(saved.total, PLAN_DEFAULT.total),
    defaultHad: str(saved.defaultHad, PLAN_DEFAULT.defaultHad),
    windowDays: PLAN_WINDOWS.includes(saved.windowDays) ? saved.windowDays : PLAN_DEFAULT.windowDays,
    search: str(saved.search, ''),
    showInactive: saved.showInactive === true,
    sortBy: PLAN_SORTS.includes(saved.sortBy) ? saved.sortBy : PLAN_DEFAULT.sortBy,
    hadOverrides: obj(saved.hadOverrides),
    alloc: obj(saved.alloc),
  };
}

function hadFor(id, overrides, defaultHad) {
  return overrides[id] !== undefined ? toCount(overrides[id]) : toCount(defaultHad);
}

function localDateISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function AllocationPlanner({ view, inputCls }) {
  const [open, setOpen] = useState(true);
  const [plan, setPlan] = useState(PLAN_DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState('');
  // Ruang sort uses a snapshot so rows don't jump while the user is typing in them;
  // it refreshes whenever a control (sort, filter, default cap, window) changes.
  const [sortSnap, setSortSnap] = useState({ alloc: {}, hadOverrides: {}, defaultHad: PLAN_DEFAULT.defaultHad });

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(PLAN_KEY);
      if (raw) {
        const p = sanitizePlan(JSON.parse(raw));
        setPlan(p);
        setSortSnap({ alloc: p.alloc, hadOverrides: p.hadOverrides, defaultHad: p.defaultHad });
      }
    } catch (e) {
      // storage unavailable or corrupt: start with an empty draft
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      const json = JSON.stringify(plan);
      if (json === JSON.stringify(PLAN_DEFAULT)) window.sessionStorage.removeItem(PLAN_KEY);
      else window.sessionStorage.setItem(PLAN_KEY, json);
    } catch (e) {
      // storage unavailable: draft lives in React state only
    }
  }, [plan, loaded]);

  const update = (patch) => setPlan(p => ({ ...p, ...patch }));
  const updateAndResort = (patch) => {
    const next = { ...plan, ...patch };
    setPlan(next);
    setSortSnap({ alloc: next.alloc, hadOverrides: next.hadOverrides, defaultHad: next.defaultHad });
  };
  const setAlloc = (id, value) => setPlan(p => ({ ...p, alloc: { ...p.alloc, [id]: value } }));
  const setHad = (id, value) => setPlan(p => ({ ...p, hadOverrides: { ...p.hadOverrides, [id]: value } }));

  const reset = () => {
    setPlan(PLAN_DEFAULT);
    setSortSnap({ alloc: {}, hadOverrides: {}, defaultHad: PLAN_DEFAULT.defaultHad });
    try { window.sessionStorage.removeItem(PLAN_KEY); } catch (e) { /* ignore */ }
  };

  const windowPairs = useMemo(
    () => view.runningPairs.filter(p => hariLagi(p.last_end) <= plan.windowDays),
    [view, plan.windowDays]
  );

  const rows = useMemo(() => {
    const q = plan.search.trim().toLowerCase();
    const list = view.mentors
      .filter(m => plan.showInactive || m.status === 'active')
      .filter(m => !q || m.name.toLowerCase().includes(q))
      .map(m => {
        let ending = 0;
        const endingPairs = [];
        for (const p of windowPairs) {
          const t = m.pairs[p.label]?.total || 0;
          if (t > 0) { ending += t; endingPairs.push(p.label); }
        }
        const had = hadFor(m.id, plan.hadOverrides, plan.defaultHad);
        const alloc = toCount(plan.alloc[m.id]);
        const after = m.total_running - ending;
        return {
          m, ending, endingPairs, after, had, alloc,
          jumlahSelepas: after + alloc,
          sortRuang: hadFor(m.id, sortSnap.hadOverrides, sortSnap.defaultHad) - toCount(sortSnap.alloc[m.id]),
        };
      });
    const byName = (a, b) => a.m.name.localeCompare(b.m.name);
    if (plan.sortBy === 'name') list.sort(byName);
    else if (plan.sortBy === 'total') list.sort((a, b) => b.m.total_running - a.m.total_running || byName(a, b));
    else list.sort((a, b) => b.sortRuang - a.sortRuang || a.after - b.after || byName(a, b));
    return list;
  }, [view, windowPairs, plan, sortSnap]);

  const target = toCount(plan.total);
  const allocated = view.mentors.reduce((s, m) => s + toCount(plan.alloc[m.id]), 0);
  const baki = target - allocated;
  const bakiCls = baki === 0 ? 'text-green-700' : baki > 0 ? 'text-amber-700' : 'text-red-700';
  const barPct = target > 0 ? Math.min(100, (allocated / target) * 100) : 0;
  const barCls = baki < 0 ? 'bg-red-500' : baki === 0 && target > 0 ? 'bg-green-500' : 'bg-blue-500';

  const totals = rows.reduce(
    (t, r) => ({ semasa: t.semasa + r.m.total_running, ending: t.ending + r.ending, alloc: t.alloc + r.alloc }),
    { semasa: 0, ending: 0, alloc: 0 }
  );

  const exportHeader = ['Mentor', 'Negeri', 'Jumlah Semasa', `Tamat dalam ${plan.windowDays} hari`, 'Selepas Tamat', 'Had', 'Peruntuk', 'Jumlah Selepas'];
  const exportRows = () => rows.map(r => [r.m.name, r.m.state || '', r.m.total_running, r.ending, r.after, r.had, r.alloc, r.jumlahSelepas]);

  const toTsv = () => [exportHeader, ...exportRows()]
    .map(cols => cols.map(c => String(c).replace(/[\t\r\n]+/g, ' ')).join('\t'))
    .join('\n');

  const toCsv = () => '﻿' + [exportHeader, ...exportRows()]
    .map(cols => cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const copyTsv = async () => {
    const text = toTsv();
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (e) {
      // fall through to textarea fallback
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) {
        ok = false;
      }
    }
    setCopied(ok ? 'Disalin' : 'Gagal menyalin');
    setTimeout(() => setCopied(''), 2000);
  };

  const downloadCsv = () => {
    const blob = new Blob([toCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kapasiti-peruntukan-${localDateISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const btnCls = 'px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 border border-gray-300 rounded-lg transition-colors';
  const cellInputCls = 'w-16 bg-white border border-gray-300 rounded-md px-2 py-1 text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const stepCls = 'w-7 h-7 rounded-md border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm leading-none';

  return (
    <section className="mb-8">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between gap-3 p-4 bg-white hover:bg-gray-50 transition-colors text-left"
        >
          <span className="font-semibold text-gray-900">Perancang Peruntukan Batch Baharu</span>
          <span className="text-gray-500 text-sm">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="border-t border-gray-200 p-4">
            {/* Controls */}
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                Jumlah peserta baharu
                <input
                  type="number" min="0" step="1" inputMode="numeric"
                  value={plan.total}
                  onChange={e => update({ total: e.target.value })}
                  className={`${inputCls} w-36`}
                />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                Had lalai per mentor
                <input
                  type="number" min="0" step="1" inputMode="numeric"
                  value={plan.defaultHad}
                  onChange={e => updateAndResort({ defaultHad: e.target.value })}
                  className={`${inputCls} w-28`}
                />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                Tamat dalam
                <select
                  value={plan.windowDays}
                  onChange={e => updateAndResort({ windowDays: Number(e.target.value) })}
                  className={inputCls}
                >
                  {PLAN_WINDOWS.map(d => <option key={d} value={d}>{d} hari</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                Susun
                <select value={plan.sortBy} onChange={e => updateAndResort({ sortBy: e.target.value })} className={inputCls}>
                  <option value="ruang">Susun: Ruang</option>
                  <option value="name">Susun: Nama</option>
                  <option value="total">Susun: Jumlah Semasa</option>
                </select>
              </label>
              <input
                type="text"
                value={plan.search}
                onChange={e => updateAndResort({ search: e.target.value })}
                placeholder="Cari nama mentor..."
                className={`${inputCls} sm:w-56`}
              />
              <label className="text-sm text-gray-700 flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  checked={plan.showInactive}
                  onChange={e => updateAndResort({ showInactive: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Papar mentor Rehat / Tidak Aktif
              </label>
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <button onClick={reset} className={btnCls}>Reset</button>
                <button onClick={copyTsv} className={btnCls}>Salin ke Spreadsheet</button>
                <button onClick={downloadCsv} className={btnCls}>Muat Turun CSV</button>
                {copied && <span className="text-xs font-semibold text-green-700">{copied}</span>}
              </div>
            </div>

            {/* Summary */}
            <div className="mb-4">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                <span className="text-gray-700">
                  Diperuntukkan <span className="font-bold text-gray-900">{allocated} / {target}</span>
                </span>
                <span className={`font-semibold ${bakiCls}`}>
                  {baki < 0 ? `Lebih ${-baki}` : `Baki ${baki}`}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${barCls} transition-all`} style={{ width: `${barPct}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">Draf ini disimpan dalam tab ini sahaja. Gunakan Salin / CSV untuk simpan.</p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[32rem] overflow-y-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm whitespace-nowrap">
                <thead className="text-gray-600 text-xs uppercase sticky top-0 bg-gray-50 z-10">
                  <tr>
                    <th className="text-left px-3 py-2">Mentor</th>
                    <th className="text-left px-3 py-2">Negeri <span className="normal-case text-gray-500">(petunjuk sahaja)</span></th>
                    <th className="text-right px-3 py-2">Jumlah Semasa</th>
                    <th className="text-right px-3 py-2">Tamat ≤{plan.windowDays} hari</th>
                    <th className="text-right px-3 py-2">Selepas Tamat</th>
                    <th className="text-right px-3 py-2">Had</th>
                    <th className="text-center px-3 py-2">Peruntuk</th>
                    <th className="text-right px-3 py-2">Jumlah Selepas</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const id = r.m.id;
                    const status = r.alloc > r.had
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">Lebih had</span>
                      : r.alloc === r.had
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Penuh</span>
                        : null;
                    return (
                      <tr key={id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{r.m.name} <StatusBadge status={r.m.status} /></td>
                        <td className="px-3 py-2 text-gray-500">{r.m.state || '-'}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{r.m.total_running}</td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {r.ending > 0 ? (
                            <>{r.ending} <span className="text-xs text-gray-500">({r.endingPairs.join(', ')})</span></>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">{r.after}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number" min="0" step="1" inputMode="numeric"
                            aria-label={`Had ${r.m.name}`}
                            value={plan.hadOverrides[id] !== undefined ? plan.hadOverrides[id] : plan.defaultHad}
                            onChange={e => setHad(id, e.target.value)}
                            className={cellInputCls}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" aria-label="Kurang" onClick={() => setAlloc(id, String(Math.max(0, r.alloc - 1)))} className={stepCls}>−</button>
                            <input
                              type="number" min="0" step="1" inputMode="numeric"
                              aria-label={`Peruntuk ${r.m.name}`}
                              value={plan.alloc[id] !== undefined ? plan.alloc[id] : '0'}
                              onChange={e => setAlloc(id, e.target.value)}
                              className={cellInputCls}
                            />
                            <button type="button" aria-label="Tambah" onClick={() => setAlloc(id, String(r.alloc + 1))} className={stepCls}>+</button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">{r.jumlahSelepas}</td>
                        <td className="px-3 py-2">{status}</td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-500">Tiada mentor sepadan</td></tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-gray-900">
                  <tr>
                    <td className="px-3 py-2" colSpan={2}>Jumlah ({rows.length} mentor)</td>
                    <td className="px-3 py-2 text-right">{totals.semasa}</td>
                    <td className="px-3 py-2 text-right">{totals.ending}</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-center">{totals.alloc}</td>
                    <td className="px-3 py-2" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function KapasitiMentorPage({ userEmail, isReadOnlyUser, accessDenied }) {
  // All hooks before any early return
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roomPair, setRoomPair] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [sortBy, setSortBy] = useState('name');
  const [collapsedPairs, setCollapsedPairs] = useState({});
  const [projectionDate, setProjectionDate] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/kapasiti-mentor');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuatkan data');
      setData(json);
    } catch (err) {
      console.error('Error fetching kapasiti mentor:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accessDenied) fetchData();
  }, [accessDenied, fetchData]);

  const view = useMemo(() => {
    if (!data) return null;
    const cap = data.default_cap;
    const hidden = new Set(HIDDEN_FROM_CAPACITY_EMAILS.map(e => e.toLowerCase()));
    const isHidden = (m) => hidden.has(String(m.email || '').toLowerCase());
    const hiddenCount = data.mentors.filter(isHidden).length;
    const hiddenNames = new Set(data.mentors.filter(isHidden).map(m => m.name));
    const mentors = data.mentors.filter(m => !isHidden(m));

    // Running pairs, newest first; summary counts recomputed from the filtered mentor list
    const runningPairs = data.pairs.filter(p => p.is_running).map(p => {
      let mentorCount = 0, bangkit = 0, maju = 0;
      for (const m of mentors) {
        const c = m.pairs[p.label];
        if (c && c.total > 0) { mentorCount++; bangkit += c.bangkit; maju += c.maju; }
      }
      return { ...p, mentorCount, bangkit, maju, total: bangkit + maju };
    });

    const overCap = [];
    for (const m of mentors) {
      for (const p of runningPairs) {
        const c = m.pairs[p.label];
        if (c && c.total > cap) overCap.push({ mentor: m, pair: p.label, ...c, lebihan: c.total - cap });
      }
    }
    overCap.sort((a, b) => b.lebihan - a.lebihan || a.mentor.name.localeCompare(b.mentor.name));

    const exc = data.exceptions;
    return {
      cap,
      hiddenCount,
      mentors,
      runningPairs,
      overCap,
      withoutBatch: exc.assignments_without_batch.filter(r => !hiddenNames.has(r.mentor)),
      ended: exc.ended_but_active,
      nonActive: exc.non_active_mentors_with_mentees.filter(r => !hiddenNames.has(r.name)),
      projectionDates: [...new Set(runningPairs.map(p => p.last_end))].sort(),
    };
  }, [data]);

  const activeRoomPair = roomPair || view?.runningPairs[0]?.label || '';

  const roomList = useMemo(() => {
    if (!view || !activeRoomPair) return [];
    const q = roomSearch.trim().toLowerCase();
    return view.mentors
      .filter(m => m.status === 'active' && m.pairs[activeRoomPair])
      .filter(m => !q || m.name.toLowerCase().includes(q))
      .map(m => ({ ...m, free: m.pairs[activeRoomPair].free_slots }))
      .sort((a, b) => b.free - a.free || a.total_running - b.total_running || a.name.localeCompare(b.name));
  }, [view, activeRoomPair, roomSearch]);

  const matrixRows = useMemo(() => {
    if (!view) return [];
    const q = search.trim().toLowerCase();
    const freeOf = (m) => view.runningPairs.reduce((s, p) => s + (m.pairs[p.label]?.free_slots || 0), 0);
    const rows = view.mentors
      .filter(m => statusFilter === 'all' || m.status === statusFilter)
      .filter(m => !q || m.name.toLowerCase().includes(q))
      .map(m => ({
        ...m,
        free_total: freeOf(m),
        after: projectionDate
          ? view.runningPairs.filter(p => p.last_end > projectionDate).reduce((s, p) => s + (m.pairs[p.label]?.total || 0), 0)
          : null,
      }));
    if (sortBy === 'total') rows.sort((a, b) => b.total_running - a.total_running || a.name.localeCompare(b.name));
    else if (sortBy === 'free') rows.sort((a, b) => b.free_total - a.free_total || a.name.localeCompare(b.name));
    else rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [view, search, statusFilter, sortBy, projectionDate]);

  if (accessDenied) return <AccessDenied userEmail={userEmail} />;

  const togglePair = (label) => setCollapsedPairs(prev => ({ ...prev, [label]: !prev[label] }));
  const inputCls = 'bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isReadOnlyUser && <ReadOnlyBadge userEmail={userEmail} />}

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <nav className="text-xs text-gray-500 mb-1">
              <Link href="/admin" className="hover:text-gray-700">Admin</Link>
              <span className="mx-2">/</span>
              <span className="text-gray-700">Kapasiti Mentor</span>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900">Kapasiti Mentor</h1>
            <p className="text-sm text-gray-600 mt-1">
              Bilangan mentee aktif per mentor bagi setiap pasangan batch yang sedang berjalan
            </p>
            {data && (
              <p className="text-xs text-gray-500 mt-1">
                Dikemas kini: {new Date(data.generated_at).toLocaleString('ms-MY')}
                {view?.hiddenCount > 0 && <span className="ml-3">{view.hiddenCount} akaun admin disembunyikan</span>}
              </p>
            )}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="self-start sm:self-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400 text-sm text-gray-700 border border-gray-300 rounded-lg transition-colors"
          >
            {loading ? 'Memuatkan...' : '↻ Muat Semula'}
          </button>
        </div>

        {loading && !data ? (
          <div className="text-center py-20 text-gray-500">Memuatkan data kapasiti...</div>
        ) : error ? (
          <div className="text-center py-20 text-red-700">Ralat: {error}</div>
        ) : !view ? null : (
          <>
            {/* 1. Summary strip */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
              {view.runningPairs.map(p => {
                const days = hariLagi(p.last_end);
                const daysCls = days <= 60 ? 'text-red-700' : days <= 120 ? 'text-amber-700' : 'text-gray-600';
                return (
                  <div key={p.label} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                    <p className="text-lg font-bold text-gray-900">{p.label}</p>
                    <p className="text-xs text-gray-600">Tamat {formatTarikh(p.last_end)}</p>
                    <p className={`text-xs font-semibold ${daysCls}`}>dalam {days} hari</p>
                    <p className="text-sm text-gray-700 mt-2">{p.mentorCount} mentor</p>
                    <p className="text-sm text-gray-700">
                      {p.total} mentee <span className="text-gray-500">({p.bangkit} B / {p.maju} M)</span>
                    </p>
                  </div>
                );
              })}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <p className="text-gray-600 text-xs font-medium uppercase tracking-wide mb-1">Mentor Ada Ruang</p>
                <p className="text-3xl font-bold text-gray-900">
                  {view.mentors.filter(m => m.status === 'active' && view.runningPairs[0] && m.pairs[view.runningPairs[0].label]?.free_slots > 0).length}
                </p>
                <p className="text-xs text-gray-500">mentor aktif bawah had dalam {view.runningPairs[0]?.label}</p>
              </div>
              <div className={`rounded-xl p-4 border ${view.overCap.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 shadow-sm'}`}>
                <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${view.overCap.length > 0 ? 'text-red-700' : 'text-gray-600'}`}>Melebihi Had</p>
                <p className={`text-3xl font-bold ${view.overCap.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{view.overCap.length}</p>
                <p className="text-xs text-gray-500">sel mentor × pasangan &gt; {view.cap}</p>
              </div>
            </div>

            {/* 2. Exceptions */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Pengecualian</h2>

              <Section title="Melebihi Had" count={view.overCap.length}>
                <p className="text-xs text-gray-500 mb-3">
                  Had semasa: {view.cap} mentee per pasangan batch. Had khas per mentor akan ditetapkan di peringkat seterusnya.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="text-left px-3 py-2">Mentor</th>
                        <th className="text-left px-3 py-2">Pasangan</th>
                        <th className="text-right px-3 py-2">Bangkit / Maju</th>
                        <th className="text-right px-3 py-2">Jumlah</th>
                        <th className="text-right px-3 py-2">Lebihan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.overCap.map(r => (
                        <tr key={`${r.mentor.id}|${r.pair}`} className="border-t border-gray-200">
                          <td className="px-3 py-2 text-gray-900">{r.mentor.name} <StatusBadge status={r.mentor.status} /></td>
                          <td className="px-3 py-2 text-gray-700">{r.pair}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{r.bangkit} / {r.maju}</td>
                          <td className="px-3 py-2 text-right text-red-600 font-semibold">{r.total}</td>
                          <td className="px-3 py-2 text-right text-red-700">+{r.lebihan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section title="Tiada Batch" count={view.withoutBatch.length}>
                <table className="w-full text-sm">
                  <thead className="text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Mentor</th>
                      <th className="text-left px-3 py-2">Usahawan</th>
                      <th className="text-left px-3 py-2">Program</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.withoutBatch.map(r => (
                      <tr key={r.assignment_id} className="border-t border-gray-200">
                        <td className="px-3 py-2 text-gray-900">{r.mentor}</td>
                        <td className="px-3 py-2 text-gray-700">{r.entrepreneur}</td>
                        <td className="px-3 py-2 text-gray-600">{r.program || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              <Section title="Batch Tamat, Masih Aktif" count={view.ended.count}>
                <p className="text-xs text-gray-500 mb-3">
                  Penugasan masih berstatus aktif walaupun batch sudah tamat. Untuk makluman sahaja.
                </p>
                {view.ended.batches.map(b => <EndedBatch key={b.batch_id} batch={b} />)}
              </Section>

              <Section title="Mentor Rehat / Tidak Aktif Masih Ada Mentee" count={view.nonActive.length}>
                <table className="w-full text-sm">
                  <thead className="text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Mentor</th>
                      <th className="text-right px-3 py-2">Batch Berjalan</th>
                      <th className="text-right px-3 py-2">Tiada Batch</th>
                      <th className="text-right px-3 py-2">Batch Tamat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.nonActive.map(r => (
                      <tr key={r.id} className="border-t border-gray-200">
                        <td className="px-3 py-2 text-gray-900">{r.name} <StatusBadge status={r.status} /></td>
                        <td className="px-3 py-2 text-right text-gray-700">{r.running_mentees}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{r.no_batch_mentees}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{r.ended_batch_mentees}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            </section>

            {/* 2b. Perancang peruntukan (client-side only) */}
            <AllocationPlanner view={view} inputCls={inputCls} />

            {/* 3. Ada Kapasiti */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Ada Kapasiti</h2>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <label className="text-sm text-gray-600 flex items-center gap-2">
                    Untuk pasangan batch
                    <select value={activeRoomPair} onChange={e => setRoomPair(e.target.value)} className={inputCls}>
                      {view.runningPairs.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
                    </select>
                  </label>
                  <input
                    type="text"
                    value={roomSearch}
                    onChange={e => setRoomSearch(e.target.value)}
                    placeholder="Cari nama mentor..."
                    className={`${inputCls} sm:w-64`}
                  />
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="text-gray-600 text-xs uppercase sticky top-0 bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">#</th>
                        <th className="text-left px-3 py-2">Mentor</th>
                        <th className="text-right px-3 py-2">Slot Kosong ({activeRoomPair})</th>
                        <th className="text-right px-3 py-2">Jumlah Semasa</th>
                        <th className="text-left px-3 py-2">Negeri <span className="normal-case text-gray-500">(petunjuk sahaja)</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {roomList.map((m, i) => (
                        <tr key={m.id} className="border-t border-gray-200">
                          <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-900">
                            {m.name}
                            {m.is_khas && <span className="ml-2 text-xs text-purple-700">Khas</span>}
                          </td>
                          <td className={`px-3 py-2 text-right font-semibold ${m.free > 0 ? 'text-green-700' : 'text-gray-300'}`}>{m.free}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{m.total_running}</td>
                          <td className="px-3 py-2 text-gray-600">{m.state || '-'}</td>
                        </tr>
                      ))}
                      {roomList.length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Tiada mentor sepadan</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* 4 + 5. Matrix */}
            <section>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Kapasiti Semasa</h2>
              <div className="flex flex-col md:flex-row md:flex-wrap gap-3 mb-3">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama mentor..."
                  className={`${inputCls} md:w-64`}
                />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputCls}>
                  <option value="active">Aktif</option>
                  <option value="rehat">Rehat</option>
                  <option value="inactive">Tidak Aktif</option>
                  <option value="all">Semua</option>
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={inputCls}>
                  <option value="name">Susun: Nama</option>
                  <option value="total">Susun: Jumlah Semasa</option>
                  <option value="free">Susun: Slot Kosong</option>
                </select>
                <select value={projectionDate} onChange={e => setProjectionDate(e.target.value)} className={inputCls}>
                  <option value="">Kapasiti selepas…</option>
                  {view.projectionDates.map(d => <option key={d} value={d}>Selepas {formatTarikh(d)}</option>)}
                </select>
              </div>
              <p className="text-xs text-gray-500 mb-2">Klik tajuk pasangan untuk kecilkan kepada jumlah sahaja.</p>

              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th rowSpan={2} className="text-left px-3 py-2 border-b border-gray-200">Mentor</th>
                      {view.runningPairs.map(p => (
                        <th
                          key={p.label}
                          colSpan={collapsedPairs[p.label] ? 1 : 3}
                          onClick={() => togglePair(p.label)}
                          className="px-3 py-2 text-center border-l border-gray-200 cursor-pointer hover:text-gray-900 select-none"
                        >
                          {p.label} {collapsedPairs[p.label] ? '▸' : '▾'}
                        </th>
                      ))}
                      <th rowSpan={2} className="px-3 py-2 text-right border-l border-gray-200 border-b">Jumlah Semasa</th>
                      {projectionDate && (
                        <th rowSpan={2} className="px-3 py-2 text-right border-l border-gray-200 border-b">
                          Jumlah Selepas {formatTarikh(projectionDate)}
                        </th>
                      )}
                    </tr>
                    <tr>
                      {view.runningPairs.map(p => (collapsedPairs[p.label] ? (
                        <th key={p.label} className="px-3 py-1 text-right border-l border-b border-gray-200">J</th>
                      ) : (
                        <React.Fragment key={p.label}>
                          <th className="px-3 py-1 text-right border-l border-b border-gray-200">B</th>
                          <th className="px-3 py-1 text-right border-b border-gray-200">M</th>
                          <th className="px-3 py-1 text-right border-b border-gray-200">J</th>
                        </React.Fragment>
                      )))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map(m => (
                      <tr key={m.id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">
                          {m.name} <StatusBadge status={m.status} />
                        </td>
                        {view.runningPairs.map(p => {
                          const c = m.pairs[p.label] || { bangkit: 0, maju: 0, total: 0 };
                          const totalCell = (
                            <td className={`px-3 py-2 text-right ${cellClass(c.total, view.cap)}`}>{c.total}</td>
                          );
                          return collapsedPairs[p.label] ? (
                            <React.Fragment key={p.label}>{totalCell}</React.Fragment>
                          ) : (
                            <React.Fragment key={p.label}>
                              <td className={`px-3 py-2 text-right border-l border-gray-200 ${c.bangkit === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{c.bangkit}</td>
                              <td className={`px-3 py-2 text-right ${c.maju === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{c.maju}</td>
                              {totalCell}
                            </React.Fragment>
                          );
                        })}
                        <td className={`px-3 py-2 text-right border-l border-gray-200 font-semibold ${m.total_running === 0 ? 'text-gray-300' : 'text-gray-900'}`}>
                          {m.total_running}
                        </td>
                        {projectionDate && (
                          <td className={`px-3 py-2 text-right border-l border-gray-200 ${m.after === 0 ? 'text-gray-300' : 'text-gray-900'}`}>
                            {m.after}
                          </td>
                        )}
                      </tr>
                    ))}
                    {matrixRows.length === 0 && (
                      <tr>
                        <td colSpan={2 + view.runningPairs.length * 3 + (projectionDate ? 1 : 0)} className="px-3 py-6 text-center text-gray-500">
                          Tiada mentor sepadan
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);

  if (!session) {
    return { redirect: { destination: '/api/auth/signin', permanent: false } };
  }

  const userEmail = session.user.email;
  const hasAccess = await canAccessAdmin(userEmail);

  if (!hasAccess) {
    return { props: { accessDenied: true, userEmail } };
  }

  const isReadOnlyUser = await isReadOnly(userEmail);

  return { props: { userEmail, isReadOnlyUser, accessDenied: false } };
}
