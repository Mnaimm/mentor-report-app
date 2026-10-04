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
