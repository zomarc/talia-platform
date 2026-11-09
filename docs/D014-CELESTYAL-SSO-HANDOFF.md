# D014 — Celestyal SSO ↔ Talia access (discussion brief)

| Field | Value |
|-------|--------|
| **Reference** | D014 |
| **Status** | Agreed recommendation for Celestyal technical discussion |
| **Date** | 9 November 2026 |
| **Author** | Talia delivery |
| **Related** | D004 Celestyal instance provisioning · Phase 1 auth (Supabase) |
| **Audience** | Celestyal IdP / IT · Talia delivery |

---

## 1. Verdict

**Yes — the model is sensible.** Split responsibility cleanly:

| Layer | Owner | Job |
|---|---|---|
| **Authentication** (who is this person?) | Celestyal SSO / IdP | Login, MFA, leavers, corporate policy |
| **Authorisation seed** (first-time role hint) | Celestyal claim → Talia | Pass `userId` + an initial role/group on first login |
| **In-app access** (what can they see/do?) | **Talia** | Roles on `talia_users`, focuses, Views, admin mappings — editable without IdP changes |

Celestyal gates the door. Talia owns the floor plan.

---

## 2. Protocol: OpenID Connect (not SAML)

**Use OpenID Connect (OIDC).**

Why:

- Talia’s auth is **self-hosted Supabase Auth (GoTrue)**, which is built for **OIDC / OAuth2**.
- SAML would need a bridge (extra component or Entra→OIDC conversion) and more ops risk on a single-VM instance.
- Entra ID / most corporate SSO frameworks expose OIDC apps as a first-class path.

Ask Celestyal to register a **confidential OIDC web application** (authorization code + PKCE as they prefer).

---

## 3. Callback URL

Until the Celestyal hostname is final, use the **pattern**. After DNS is known, send the concrete URL.

**Authentication callback (redirect URI) — required:**

```text
https://<talia-public-hostname>/auth/v1/callback
```

That is the Supabase/GoTrue callback on the instance (public hostname via reverse proxy — see D004).

**Also register (recommended):**

| Type | Value |
|---|---|
| Redirect URI | `https://<talia-public-hostname>/auth/v1/callback` |
| Front-channel logout / post-logout (if used) | `https://<talia-public-hostname>/` |
| Allowed origins / SPA | `https://<talia-public-hostname>` |

**Talia needs from Celestyal once the app exists:**

- Tenant / issuer URL (e.g. Entra `https://login.microsoftonline.com/<tenant-id>/v2.0`)
- Client ID
- Client secret (Key Vault on Celestyal side; Talia stores only as instance env)
- Scopes: at least `openid profile email`
- Optional but useful: groups or a custom role claim

Hostname is item 4 in D004 / `docs/CELESTYAL-INSTANCE-SPEC.md` §4.

---

## 4. Claims contract

Minimum for first login:

| Claim | Purpose |
|---|---|
| `sub` (OIDC subject) | Stable Celestyal user id — store on `talia_users` as external id |
| `email` | Match / display; upsert key if `sub` not yet stored |
| `name` (optional) | Display |
| **Initial role** | Map Entra **group → Talia role**, or a custom claim e.g. `talia_role` |

**Talia role vocabulary:** `GUEST` · `USER` · `MANAGER` · `ADMIN` · `SUPER_USER`.

**Policy:**

1. **First successful SSO login** — create `talia_users` row; set `role` from Celestyal claim/group map (default `USER` if unknown).
2. **Subsequent logins** — **do not overwrite** Talia role from IdP (Talia admin / SUPER_USER adjusts access inside the app).
3. **Leaver / disable** — Celestyal SSO blocks login; Talia does not need to delete the row.
4. **Break-glass** — one local SUPER_USER password path for emergency only (documented, not day-to-day).

---

## 5. What Talia controls after login

- Role on `talia_users` (Admin Dashboard)
- Focus / panel visibility by role
- Component Views and operations
- Document / requirements admin surfaces
- Any future sail/market scoping

Celestyal does **not** need to model every Talia permission in the IdP.

---

## 6. Discussion agenda / step plan

### A. Agree (this meeting)

1. OIDC (not SAML).
2. Split: Celestyal authN + initial role seed; Talia in-app authZ.
3. Callback URL pattern above; concrete URL after hostname is assigned.
4. Claims: `sub`, `email`, role via group or `talia_role`.
5. First-login seed only; Talia owns role thereafter.

### B. Celestyal delivers

1. Final public hostname (+ TLS).
2. OIDC app registration with the callback URI.
3. Client id/secret + issuer/tenant metadata (secure channel / Key Vault).
4. Group → role mapping one-pager (e.g. RM Controllers → MANAGER, Commercial analysts → USER, IT admins → ADMIN).
5. Confirm MFA and conditional access apply to this app.

### C. Talia delivers (after B)

1. Enable OIDC on instance Supabase Auth.
2. Set GoTrue allow-list / site URL to the Celestyal hostname.
3. Login UI: “Sign in with Celestyal”; disable open signup on that instance.
4. Persist Celestyal `sub` on `talia_users`; map claim → role on insert only.
5. Smoke test: new user, returning user (role unchanged), disabled IdP user, in-app role change.
6. Document break-glass SUPER_USER.

### D. Handover checklist

- [ ] Hostname live on HTTPS
- [ ] Callback URI registered exactly
- [ ] OIDC client secret in Celestyal Key Vault + Talia instance env
- [ ] Group/role map agreed
- [ ] Password signup off; SSO primary
- [ ] Test users in each role

---

## 7. Suggested reply to Celestyal (send now)

> We’ll use **OpenID Connect**. Please register a confidential OIDC web app for Talia.
>
> **Redirect URI:** `https://<talia-hostname>/auth/v1/callback` (we’ll confirm the hostname once DNS is assigned).
>
> We need issuer/tenant URL, client id, and client secret. Please include email and a stable user id (`sub`), plus either group membership or a role claim we can map to Talia’s roles (`USER` / `MANAGER` / `ADMIN`).
>
> Celestyal SSO will control who can sign in and the **initial** role; **Talia** will manage fine-grained access inside the application after first login.

When the hostname is known, replace `<talia-hostname>` and resend the Redirect URI line only if needed.
