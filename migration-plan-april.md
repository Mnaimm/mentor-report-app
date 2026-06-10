# Migration Plan — April (Supabase First)

## 🎯 Objective
Transition mentor dashboard from Google Sheets → Supabase as source of truth  
without breaking production.

---

# 🧭 PHASE 1 — Validate Core Replacement (CURRENT)

## Goal
Prove Supabase can fully replace Sheets for mentor dashboard

## Steps
- [x] Build `mentor-stats-v2` query
- [ ] Compare with current `/api/mentor-stats`
- [ ] Fix any mismatch (edge cases)

---

# 🧭 PHASE 2 — Safe Parallel Run

## Goal
Run both systems safely

## Steps
- [ ] Create new endpoint:

/api/mentor-stats-v2

- [ ] Update frontend (temporary):
- Call BOTH endpoints
- Log differences (console or backend)
- [ ] Monitor for:
- mismatch
- missing data
- edge cases

## Duration
1–3 days (can be shorter if stable)

---

# 🧭 PHASE 3 — Switch Read Source

## Goal
Make Supabase the source of truth for reads

## Steps
- [ ] Replace usage:

/api/mentor-stats → /api/mentor-stats-v2

- [ ] Keep old endpoint as fallback (temporary)

---

# 🧭 PHASE 4 — Stabilize & Clean

## Goal
Ensure consistency and correctness

## Steps
- [ ] Add filters:
- `is_active = true`
- consistent `program` casing
- [ ] Fix data issues:
- ignore or clean orphan `batch_rounds`
- normalize program values (`Maju` vs `MAJU`)

---

# 🧭 PHASE 5 — Remove Sheets Dependency

## Goal
Decouple dashboard from Google Sheets

## Steps
- [ ] Remove Sheets logic from:

/api/mentor-stats

- [ ] Keep Sheets only for:
- export
- Apps Script
- legacy compatibility

---

# 🧭 PHASE 6 — Expand Migration

## Next Targets
- [ ] `/api/menteeData`
- [ ] `/api/laporanMajuData`
- [ ] `/api/mentor/my-dashboard`

---

# ⚠️ What We Are NOT Doing

- ❌ Full database migration
- ❌ Rewriting entire system
- ❌ Removing Google Sheets completely

---

# 🧠 Guiding Principle


Writes → already hybrid (acceptable)
Reads → must be consistent (Supabase only)


---

# 🚀 Current Progress

- ✅ Data validation complete
- ✅ Batch-round join fixed
- ✅ First working Supabase query
- 🔄 In transition phase (~70% complete)

---

# 🎯 Next Immediate Action

Build and deploy:


/api/mentor-stats-v2


Then:
- Compare results
- Run parallel
- Switch safely

---

# 🔥 Key Insight

You are no longer debugging.

You are **transitioning architecture**.