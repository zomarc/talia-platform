# Staging setup — superseded workflow note

This file documented an older **git-pull-on-server** flow. The supported path now is:

- **Laptop** → `./scripts/deploy-to-staging.sh` → **tarball / scp** → **staging** → **Docker Compose**.

See `STAGING-GIT-SETUP.md` and `docs/ENVIRONMENTS-AND-DEPLOY.md` for the current model. Keep a local git repo on the laptop and/or on staging for your own history; deploys do not require a public git remote.
