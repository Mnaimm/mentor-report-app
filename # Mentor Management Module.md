# Mentor Management Module — Product Requirements Document (PRD)

## 1. Purpose

The Mentor Management Module provides administrators and program coordinators with a centralized system to manage mentors and mentor–mentee assignments.

The module ensures:

* Clear mentor responsibility tracking
* Accurate report and payment attribution
* Controlled mentor reassignment
* Full audit logging of assignment changes
* Reduced reliance on manual processes (Google Sheets + SQL edits)

---

# 2. Problems This Module Solves

Current operational issues include:

1. Mentor onboarding is manual and inconsistent
2. Mentor reassignment requires updates across multiple systems
3. No audit trail for reassignment decisions
4. Risk of incorrect payment attribution
5. Google Sheets is used as an operational database
6. No visibility of mentor capacity or workload

---

# 3. Users

## Admin

Responsibilities:

* Onboard mentors
* Deactivate mentors
* View mentor activity across the system

## Program Coordinator

Responsibilities:

* Assign mentees
* Reassign mentees
* Monitor mentor workload
* Monitor program progress

---

# 4. Key Features

## 4.1 Mentor Onboarding

Admins can create a new mentor profile.

### Required Fields

* Name
* Email
* Phone
* Program (Bangkit / Maju / TUBF)
* Region
* Maximum mentees
* Premier mentor (optional)
* Bio

### System Actions

Creates records in:

* `users`
* `mentor_profiles`

Mentor becomes available in the **Coordinator Mentor Directory**.

---

## 4.2 Mentor Directory

Coordinators can view all mentors.

Displayed fields include:

* Name
* Email
* Program
* Region
* Maximum mentees
* Assigned mentees
* Available slots
* Reports submitted
* Completion rate

Data sources:

* `mentor_profiles`
* `mentor_assignments`
* `sessions`

---

## 4.3 Mentor Capacity Monitoring

Prevent mentor overload.

Rule:

```
active mentor_assignments <= max_mentees
```

If exceeded, assignment is blocked.

System message:

```
Mentor is at maximum capacity
```

---

## 4.4 Mentee Assignment

Coordinator assigns a mentee to a mentor.

### Flow

```
Coordinator selects mentee
↓
Choose mentor
↓
Submit
```

### API

```
POST /api/coordinator/assign-mentor
```

### Database

```
mentor_assignments
```

---

## 4.5 Mentor Reassignment

Coordinator reassigns mentee.

### Input Fields

* New mentor
* Reason
* Notes

### System Actions

* Update `mentor_assignments`
* Log reassignment activity

### Audit Fields

* Previous mentor
* New mentor
* Changed by
* Reason
* Timestamp

---

## 4.6 Assignment History

All mentor changes are tracked.

### Table

```
assignment_history
```

### Example

| mentee | old mentor | new mentor | reason | changed_by | date |
| ------ | ---------- | ---------- | ------ | ---------- | ---- |

Purpose:

* Audit
* Responsibility tracking
* Payment validation

---

## 4.7 Unassigned Mentee Detection

Dashboard highlights mentees without assigned mentors.

Query:

```
mentor_assignments WHERE mentor_id IS NULL
```

Coordinator can assign mentors directly from this list.

---

## 4.8 Mentor Deactivation

Admin can deactivate a mentor.

Actions:

```
users.status = inactive
mentor_profiles.active = false
```

If mentor still has active mentees, system prompts coordinator to reassign them first.

---

## 4.9 Payment Integrity

Payments are derived from:

* `sessions`
* `mentor_assignments`

Rule:

```
The mentor assigned at the time of report submission receives payment.
```

This ensures correct mentor compensation.

---

# 5. System Architecture

## Source of Truth

Supabase database.

Primary tables:

* `users`
* `mentor_profiles`
* `mentor_assignments`
* `entrepreneurs`
* `sessions`

---

## Google Sheets Usage

Sheets remain only for:

* Report exports
* Analytics
* External reporting

Sheets are **not used for operational assignments**.

---

# 6. API Endpoints

### Mentor Listing

```
GET /api/coordinator/mentors
```

Returns all mentors.

---

### Mentee Listing

```
GET /api/coordinator/mentees
```

Returns all mentees and assignment status.

---

### Assign / Reassign Mentor

```
POST /api/coordinator/assign-mentor
```

Creates or updates mentor assignment.

---

### Future APIs

```
POST /api/admin/create-mentor
PATCH /api/admin/update-mentor
DELETE /api/admin/deactivate-mentor
GET /api/assignments/history
```

---

# 7. UI Components

## Admin Interface

```
Mentor Management
├ Add Mentor
├ Edit Mentor
├ Deactivate Mentor
└ Mentor Directory
```

---

## Coordinator Interface

```
Mentor Dashboard
├ Mentor List
├ Mentee List
├ Assign Mentor
├ Reassign Mentor
└ Unassigned Mentees
```

---

# 8. Audit Logging

All mentor management actions must be logged.

Event examples:

* `mentor_created`
* `mentor_updated`
* `mentor_deactivated`
* `mentee_assigned`
* `mentee_reassigned`

Logging handled through:

```
logActivity()
```

---

# 9. Security

Role-based access control.

Roles:

* `admin`
* `program_coordinator`
* `mentor`

| Action          | Role        |
| --------------- | ----------- |
| Create mentor   | admin       |
| Assign mentee   | coordinator |
| Reassign mentee | coordinator |
| View mentors    | coordinator |
| Submit reports  | mentor      |

---

# 10. Success Metrics

Indicators of successful implementation:

* 100% mentor onboarding through portal
* Zero manual SQL assignment updates
* No operational dependency on mapping sheets
* Full audit trail of reassignment events
* Accurate payment attribution

---

# 11. Future Enhancements

## Automated Google Drive Permissions

Automatically grant mentor access to mentee folders during assignment.

---

## Mentor Performance Analytics

Track:

* Response time
* Session completion
* Mentee progress

---

## Intelligent Mentor Assignment

Suggest mentors based on:

* Available capacity
* Region
* Performance metrics

---

# 12. Migration Plan

## Step 1

Freeze manual edits in the **mapping sheet**.

## Step 2

Use:

```
mentor_assignments
```

as the official assignment record.

## Step 3

Update mentor portal APIs to replace:

```
/api/mapping
```

with:

```
/api/mentor/my-mentees
```

---

## Outcome

After this module is implemented:

* Mentor onboarding
* Mentor assignment
* Mentor reassignment
* Mentor capacity monitoring
* Payment responsibility tracking

will all be handled in a **single unified system**.
