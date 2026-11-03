# Talia Platform v0.4.0

**Release date:** 3 November 2026  
**Version:** 0.4.0  
**Status:** Development baseline (demo-ready)

---

## Summary

Stabilizes the current demo stack as a minor baseline: Documents can ingest PDF/paste as Markdown; Data Management architecture diagrams print reliably; dock PDFs share platform chrome; Historic MR Path is available for source MR review.

## Highlights

### Documents
- Import `.pdf` / `.txt` / `.md` or paste text → structured Markdown
- Auto-save into the document repository (content only; originals not stored)
- Reformat existing raw bodies as Markdown

### Architecture & print
- Architecture overview/details with live-oriented status cues
- HTML print diagrams (avoids blank Mermaid-in-Chrome-print)
- Shared print document chrome (logo + date/time)

### Historic MR Path
- Focus panel for historic source MR path review
- Server GraphQL + ETL migration support for MR path data

## Version matrix

| Package | Version |
|---------|---------|
| Root / platform | 0.4.0 |
| talia-ui | 0.4.0 |
| talia-server | 0.4.0 |

## Quality notes

- Unit tests covering document import, architecture/print helpers, and historic MR path helpers
- Discuss portal: rebuild with Start Demo after UI changes (`dev.taliahub.com`)
- Azure MVP deploy still depends on SSH/NSG reachability

## Tag

```bash
git tag -a v0.4.0 -m "Talia 0.4.0 demo baseline"
```

See [CHANGELOG.md](../CHANGELOG.md) for the full entry.
