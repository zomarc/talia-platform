# Meeting notes (Plaud)

Normalized Plaud → Talia requirement captures live here.

Naming: `YYYY-MM-DD-short-slug.md`

This folder is the **git archive** of Plaud captures. The live operational board is the in-app **Requirements Log** panel (Postgres `talia_requirement_item` on each instance). After extracting a meeting, the agent can offer **Push to Requirements Log** via GraphQL (`upsertRequirementItems`); use the panel’s JSON export/import to copy items between instances without a full DB restore.

