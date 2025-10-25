# Action 4: Scan for Leaked Secrets (CRITICAL)

**Priority:** 🔴 P0 - Do Today
**Time Required:** 1 hour
**Risk Level:** Critical if secrets found
**Difficulty:** Medium

---

## 🎯 Goal

Scan Git history for accidentally committed secrets:
- Google OAuth client secrets
- Service account JSON files
- API keys
- NextAuth secrets
- Any other credentials

**Why this matters:** Even if you deleted the file, it's still in Git history. Anyone with repo access can find it.

---

## 🔍 What We're Looking For

Based on your .gitignore, these files SHOULD be excluded:
- ✅ `.env.local` (gitignored)
- ✅ `mentor-reporting-tool-fa84de51b7ce.json` (gitignored)

But we need to verify they were NEVER committed in the past.

---

## 📋 Prerequisites

- [ ] You have access to create new credentials in Google Cloud Console
- [ ] You have admin access to Vercel environment variables
- [ ] You can generate new NextAuth secret

**Why:** If secrets are found, you'll need to rotate them immediately.

---

## 🛠️ Step-by-Step Instructions

### Step 1: Install Gitleaks

**On macOS:**
```bash
brew install gitleaks
```

**On Linux:**
```bash
# Download latest release
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.1/gitleaks_8.18.1_linux_x64.tar.gz
tar -xzf gitleaks_8.18.1_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/
```

**On Windows:**
```bash
# Download from: https://github.com/gitleaks/gitleaks/releases
# Extract and add to PATH
```

**Verify installation:**
```bash
gitleaks version
# Output: 8.18.1 (or similar)
```

---

### Step 2: Run Gitleaks Scan

```bash
cd /home/user/mentor-report-app

# Scan entire Git history
gitleaks detect --source=. --verbose --report-path=gitleaks-report.json

# This scans:
# - All commits in history
# - All branches
# - Staged and unstaged files
```

**This will take 1-5 minutes depending on repo size.**

---

### Step 3: Review Results

```bash
# View report
cat gitleaks-report.json

# Or get summary:
gitleaks detect --source=. --no-git
```

**Possible outcomes:**

#### A. ✅ No leaks found
```
○
│╲
│ ○
○ ░
░    gitleaks

9:47AM INF 134 commits scanned.
9:47AM INF scan completed in 2.3s
9:47AM INF no leaks found
```

**Action:** You're good! Skip to Step 6 (commit scan results).

---

#### B. ⚠️ Leaks found
```
Finding:     GOOGLE_CLIENT_SECRET="GOCSPX-abc123..."
Secret:      GOCSPX-abc123...
File:        .env.local
Commit:      a1b2c3d4
Author:      Your Name
Date:        2024-10-15
```

**Action:** Proceed to Step 4 (rotate secrets).

---

### Step 4: If Secrets Found - Identify What Leaked

Common patterns gitleaks finds:

**Pattern 1: Google OAuth Client Secret**
```
GOOGLE_CLIENT_SECRET=GOCSPX-...
```
**Risk:** Attackers can impersonate your app in OAuth flow
**Action:** Create new OAuth credentials

---

**Pattern 2: Service Account JSON**
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n..."
}
```
**Risk:** Full access to Google Sheets/Drive via service account
**Action:** Delete service account, create new one

---

**Pattern 3: NextAuth Secret**
```
NEXTAUTH_SECRET=abc123...
```
**Risk:** Can forge session tokens, impersonate users
**Action:** Generate new secret

---

**Pattern 4: API Keys**
```
GOOGLE_API_KEY=AIzaSy...
```
**Risk:** Depends on API permissions
**Action:** Rotate in Google Cloud Console

---

### Step 5: Rotate Compromised Secrets

**For each secret found, do the following:**

---

#### Rotating Google OAuth Client Secret

1. **Create new OAuth credentials:**
   ```bash
   # Go to Google Cloud Console
   open https://console.cloud.google.com/apis/credentials
   ```

2. **Create new OAuth 2.0 Client ID:**
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: Web application
   - Name: `iTEKAD Mentor App (New - 2024-10)`
   - Authorized redirect URIs:
     - `https://mentor-report-app.vercel.app/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google` (dev only)
   - Click "Create"
   - Copy Client ID and Client Secret

3. **Update Vercel environment variables:**
   ```bash
   # Via Vercel dashboard:
   # Settings → Environment Variables → GOOGLE_CLIENT_ID → Edit
   # Paste new Client ID

   # Settings → Environment Variables → GOOGLE_CLIENT_SECRET → Edit
   # Paste new Client Secret
   ```

4. **Update local .env.local:**
   ```bash
   nano .env.local
   # Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
   ```

5. **Delete old OAuth credentials:**
   - Go back to Google Cloud Console
   - Find old credential, click Delete
   - Confirm deletion

6. **Redeploy app:**
   ```bash
   git commit --allow-empty -m "trigger: redeploy after credential rotation"
   git push origin main
   ```

---

#### Rotating Service Account

1. **Create new service account:**
   ```bash
   # Go to Google Cloud Console
   open https://console.cloud.google.com/iam-admin/serviceaccounts
   ```

2. **Create new service account:**
   - Click "Create Service Account"
   - Name: `itekad-mentor-app-new-2024-10`
   - Grant roles:
     - "Editor" (or more restrictive: "Google Sheets API" + "Google Drive API")
   - Click "Done"

3. **Create and download key:**
   - Click on the new service account
   - Keys tab → Add Key → Create new key
   - Type: JSON
   - Click "Create" (downloads JSON file)

4. **Encode to base64:**
   ```bash
   # On macOS/Linux:
   base64 -i ~/Downloads/itekad-mentor-app-new-*.json | tr -d '\n'

   # Copy the output
   ```

5. **Update Vercel environment variable:**
   - Settings → Environment Variables → GOOGLE_CREDENTIALS_BASE64 → Edit
   - Paste new base64 string

6. **Share Google Sheets with new service account:**
   - Open each Google Sheet (Bangkit, Maju, Mapping, etc.)
   - Click "Share"
   - Add email: `itekad-mentor-app-new-2024-10@PROJECT_ID.iam.gserviceaccount.com`
   - Permission: Editor
   - Uncheck "Notify people"
   - Click "Share"

7. **Delete old service account:**
   - Go to IAM & Admin → Service Accounts
   - Find old account, click Delete

8. **Redeploy:**
   ```bash
   git commit --allow-empty -m "trigger: redeploy after service account rotation"
   git push origin main
   ```

---

#### Rotating NextAuth Secret

1. **Generate new secret:**
   ```bash
   openssl rand -base64 32
   # Copy output
   ```

2. **Update Vercel:**
   - Settings → Environment Variables → NEXTAUTH_SECRET → Edit
   - Paste new secret

3. **Update local .env.local:**
   ```bash
   nano .env.local
   # Update NEXTAUTH_SECRET=<new secret>
   ```

4. **Redeploy:**
   ```bash
   git commit --allow-empty -m "trigger: redeploy after NextAuth secret rotation"
   git push origin main
   ```

**Note:** All users will be logged out after this change (need to re-login).

---

### Step 6: Remove Secrets from Git History

**WARNING:** This rewrites Git history. Coordinate with team first!

**Option A: Using BFG Repo Cleaner (Recommended)**

```bash
# Install BFG
brew install bfg
# or download JAR from https://rtyley.github.io/bfg-repo-cleaner/

# Clone a fresh copy (backup)
cd ..
git clone --mirror https://github.com/Mnaimm/mentor-report-app.git mentor-report-app-backup.git

# Go back to working repo
cd mentor-report-app

# Remove files from history
bfg --delete-files 'mentor-reporting-tool-*.json' .
bfg --delete-files '.env.local' .
bfg --delete-files '.env' .

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (CAREFUL!)
git push origin --force --all
git push origin --force --tags
```

---

**Option B: Using git-filter-repo (More precise)**

```bash
# Install git-filter-repo
pip3 install git-filter-repo

# Remove specific file from history
git filter-repo --path .env.local --invert-paths
git filter-repo --path 'mentor-reporting-tool-fa84de51b7ce.json' --invert-paths

# Force push
git push origin --force --all
```

---

### Step 7: Verify Secrets Removed

```bash
# Re-run gitleaks
gitleaks detect --source=. --verbose

# Should show: "no leaks found"
```

---

### Step 8: Document Rotation

Create incident report:

```bash
# Create file
nano SECURITY_INCIDENT_SECRET_ROTATION.md
```

```markdown
# Security Incident: Secret Rotation

**Date:** 2024-10-25
**Severity:** [None Found / Low / Medium / High]
**Status:** Resolved

## Findings

[List what was found, e.g.:]
- Google OAuth Client Secret in commit a1b2c3d from 2024-09-15
- NextAuth Secret in .env.local committed on 2024-08-01

## Actions Taken

- [x] New OAuth credentials created
- [x] Old credentials deleted
- [x] Vercel env vars updated
- [x] Secrets removed from Git history
- [x] Force push to remote
- [x] Team notified to pull --force

## Verification

- [x] Gitleaks scan clean
- [x] App still works with new credentials
- [x] Old credentials confirmed non-functional

## Lessons Learned

- Always verify .gitignore before first commit
- Use git hooks to prevent secret commits
- Regular secret scanning in CI/CD

## Next Steps

- [ ] Implement pre-commit hook (Action 11)
- [ ] Add gitleaks to CI/CD (Action 10)
```

---

### Step 9: Notify Team (If Applicable)

If others have clones of the repo:

```bash
# Send message to team:
```

**Email template:**
```
Subject: [URGENT] Git History Rewritten - Force Pull Required

Team,

We've removed sensitive credentials from Git history for security.

ACTION REQUIRED:
1. Commit/stash your local changes
2. Backup your work
3. Run: git fetch origin
4. Run: git reset --hard origin/main
5. Re-apply your local changes

Old commits are now invalid. Do NOT push old branches.

Details: See SECURITY_INCIDENT_SECRET_ROTATION.md

Questions? Ping me.
```

---

## 🧪 Testing Checklist

After rotation:

- [ ] Gitleaks scan shows no leaks
- [ ] App deploys successfully on Vercel
- [ ] Login works (OAuth with new credentials)
- [ ] API routes work (service account with new credentials)
- [ ] Old credentials no longer work (test in local .env with old values)

---

## 📊 Success Metrics

**Before:**
```bash
gitleaks detect --source=.
# Found: 3 leaks in history
```

**After:**
```bash
gitleaks detect --source=.
# no leaks found ✅
```

---

## 🐛 Troubleshooting

### Issue: App broken after rotation

**Check:**
```bash
# Verify env vars in Vercel
vercel env ls

# Pull latest env vars
vercel env pull .env.local

# Test locally
npm run dev
```

---

### Issue: "Old credentials still work"

**Google takes up to 10 minutes to fully revoke.**

Wait 10 minutes, then test again.

---

### Issue: Force push rejected

```bash
# If protected branch:
# 1. Go to GitHub → Settings → Branches
# 2. Temporarily disable branch protection
# 3. Force push
# 4. Re-enable branch protection
```

---

## ✅ Completion Criteria

1. ✅ Gitleaks scan completed
2. ✅ If secrets found: All rotated
3. ✅ If secrets found: Removed from Git history
4. ✅ Re-scan shows no leaks
5. ✅ App still works with new credentials
6. ✅ Incident documented

---

## 📝 Next Steps

After completing this action:
- Proceed to **Action 5: Remove NEXT_PUBLIC Admin Emails**
- File: `SECURITY_ACTION_05_ADMIN_EMAILS.md`

---

**Estimated Time Spent:** _________ minutes
**Secrets Found:** _________ (0 = good!)
**Rotation Required:** ⬜ Yes | ⬜ No
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete | ⬜ Blocked
