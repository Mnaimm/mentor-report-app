// lib/mapping-ownership.js
// Pure helpers (no I/O) for the Google Sheets mentor-mentee mapping tab.
// mappingRows = sheets.values.get(...).data.values (row 0 = headers).

const normHeader = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
const normEmail = (s) => (s || '').toString().trim().toLowerCase();

/**
 * True if the header row has a 'Mentor_Email' column.
 */
export function hasMentorEmailColumn(mappingRows) {
  if (!Array.isArray(mappingRows) || mappingRows.length < 1) return false;
  return (mappingRows[0] || []).map(normHeader).includes(normHeader('Mentor_Email'));
}

/**
 * First mapping row whose 'Mentee' column equals `name` exactly
 * (same match laporanMajuData uses for menteeMapping), or null.
 */
export function findMenteeMappingRow(mappingRows, name) {
  if (!Array.isArray(mappingRows) || mappingRows.length < 1 || !name) return null;
  const headers = (mappingRows[0] || []).map(normHeader);
  const menteeIdx = headers.indexOf(normHeader('Mentee'));
  if (menteeIdx === -1) return null;
  return mappingRows.slice(1).find((row) => row && (row[menteeIdx] || '') === name) || null;
}

/**
 * True only if the mapping row for `name` has Mentor_Email equal to `email`
 * (trimmed, case-insensitive). Missing sheet, header, row or email => false.
 */
export function isMenteeOfMentor(mappingRows, name, email) {
  const target = normEmail(email);
  if (!target || !Array.isArray(mappingRows) || mappingRows.length < 1) return false;
  const headers = (mappingRows[0] || []).map(normHeader);
  const mentorEmailIdx = headers.indexOf(normHeader('Mentor_Email'));
  if (mentorEmailIdx === -1) return false;
  const row = findMenteeMappingRow(mappingRows, name);
  return !!row && normEmail(row[mentorEmailIdx]) === target;
}
