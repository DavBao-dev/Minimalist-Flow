# Minimalist Flow — Streamlit + persistent per-user progress

This package wraps the pre-built Minimalist Flow React UI in a **bidirectional
Streamlit Component**. The UI stays in the browser, while Python persists the
complete state per logged-in user.

## What is now persisted

For each username:

- tasks
- free blocks
- materials
- Fixed Calendar events

The browser may still use `localStorage` as a fast cache, but the source of
truth after login is the database. Switching browser/device or redeploying the
Streamlit app will restore the user's saved state from the database.

## Recommended free test deployment

For a few testers, use:

**Streamlit Community Cloud + Turso**

Turso is SQLite/libSQL-compatible, so the existing schema and SQL remain very
close to the SQLite version. Turso's current Python documentation recommends
`libsql` for remote access when the app cannot keep a local DB file, which is
exactly the Streamlit Community Cloud situation.

### 1. Create the Turso database

Install/login to the Turso CLI, create a database, obtain its URL and create a
database token. Put those values into Streamlit Community Cloud Secrets.

Use:

```toml
[credentials]
admin = "your-admin-password"

[database]
url = "libsql://YOUR-DB-YOUR-ORG.turso.io"
auth_token = "YOUR_TOKEN"
```

Do **not** commit `secrets.toml`.

### 2. Deploy to Streamlit Community Cloud

The repository root should contain `streamlit_app/app.py` (or point the
Streamlit deployment to that file).

The app automatically detects the Turso URL/token and uses remote libSQL.
There is no need to change `app.py` for deployment.

### 3. Local development

If `[database] url/auth_token` are absent, the app automatically falls back to
SQLite at:

```text
streamlit_app/minimalist_flow.db
```

Or set:

```bash
MINIMALIST_FLOW_DB_PATH=/absolute/path/to/minimalist_flow.db
```

### 4. VPS / Docker

SQLite is perfectly fine for a small self-hosted deployment. Mount a
persistent volume and set `MINIMALIST_FLOW_DB_PATH` to the mounted file.

Example Docker concept:

```yaml
volumes:
  - ./data:/data
environment:
  MINIMALIST_FLOW_DB_PATH: /data/minimalist_flow.db
```

## Architecture

```text
Browser
  │
  │ React state changes
  ▼
Minimalist Flow custom component
  │ Streamlit.setComponentValue
  ▼
app.py
  │
  ▼
db.py
  ├── Turso/libSQL (recommended on Streamlit Cloud)
  └── SQLite file (local/VPS/Docker)
```

The component uses the Streamlit Component v1 protocol directly, so the
pre-built React bundle does not need npm, Vite or a rebuild.

## Important security note

Passwords are stored using PBKDF2-HMAC-SHA256 with a per-user random salt.
Admin credentials in Streamlit Secrets are separate from registered users.

For a real production deployment with many users, add rate limiting, account
recovery, CSRF/session hardening and a proper authentication provider. For a
few internal testers, this implementation is sufficient as the application
layer.
