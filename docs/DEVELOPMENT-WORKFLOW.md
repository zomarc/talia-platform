# Development Workflow

Canonical daily workflow for Talia local development and staging deployment.

## Local Development

Run UI and server in separate terminals:

```bash
# Terminal 1
cd talia-server
npm start

# Terminal 2
cd talia-ui
npm run dev
```

- UI: `http://localhost:5173`
- GraphQL: `http://localhost:4000/graphql`

## Typical Loop

1. Implement and test locally.
2. Validate changed panels/features in browser.
3. Commit focused changes.
4. Deploy to staging using local deployment scripts.
5. Verify staging behavior and logs.

## Staging Deployment (MiniPC)

Use the local deployment flow (tarball/scripts from laptop to MiniPC staging).  
For exact commands and options, use:

- `docs/ENVIRONMENTS-AND-DEPLOY.md` (primary)
- `docs/DEPLOYMENT.md` (operational details)
- `docs/AZURE-STAGING.md` (Azure VM stack details)

## Backend-Specific Workflow

For server schema/resolver/sync development conventions, use:

- `talia-server/DEVELOPMENT-GUIDE.md`

## Notes

- Prefer project scripts over ad-hoc deployment commands.
- Keep component logic minimal and library-first; shared behaviors belong in shared hooks/config.
- Treat this file as the canonical workflow entry, not milestone history.
