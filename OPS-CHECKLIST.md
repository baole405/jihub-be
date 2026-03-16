# OAuth + CORS + Env Sync Checklist

This checklist is meant to keep **OAuth**, **CORS**, and **environment variables** aligned across:
- GitHub OAuth App
- Atlassian OAuth 2.0 App
- DigitalOcean App Platform (BE)
- Vercel (FE)
- Doppler (prd)

## ✅ Quick Auto-Check (Local)

Run from `be-repo`:

```powershell
pwsh .\scripts\check-config.ps1 -Mode prod
```

Use `-Mode local` to validate local values.

## ✅ Manual Checklist (Production)

### 1. GitHub OAuth App
- Homepage URL = `https://jihub.vercel.app`
- Authorization callback URL = `https://jihub-toxzx.ondigitalocean.app/api/auth/github/callback`

### 2. Atlassian OAuth 2.0 App
- Callback URL = `https://jihub-toxzx.ondigitalocean.app/api/auth/jira/callback`

### 3. Doppler (prd)
- `FRONTEND_URL` = `https://jihub.vercel.app`
- `GH_CALLBACK_URL` = `https://jihub-toxzx.ondigitalocean.app/api/auth/github/callback`
- `JIRA_CALLBACK_URL` = `https://jihub-toxzx.ondigitalocean.app/api/auth/jira/callback`
- `ALLOWED_CORS_ORIGINS` includes `https://jihub.vercel.app`
- **No VPS IPs** (no `143.198.223.247`)

### 4. DigitalOcean App Platform (BE)
- Env vars match Doppler prd (sync status green)
- Swagger URL: `https://jihub-toxzx.ondigitalocean.app/api/docs`

### 5. Vercel (FE) — manual env
- `NEXT_PUBLIC_API_URL=https://jihub-toxzx.ondigitalocean.app`
- `NEXT_PUBLIC_FRONTEND_URL=https://jihub.vercel.app`
- `AUTH_SECRET` set
- `GITHUB_ID`, `GITHUB_SECRET` set
- `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET` set

## ✅ After Any Change

1. Update Doppler prd values.
2. Confirm DO App Platform sync is **In Sync**.
3. Update OAuth apps if URLs changed.
4. Re-run `check-config.ps1`.
