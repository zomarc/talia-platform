# Talia Platform v0.5.0

**Release date:** 23 November 2026  
**Version:** 0.5.0  
**Status:** Firm development baseline (MVP-ready for review)

---

## Summary

Next firm/dev minor after 0.4.0. Centers on Data Lineage diagram support for upstream source remapping, PlaceHolder wireframes, science/evidence plumbing, and Celestyal SSO/auth hardening on Azure MVP.

## Highlights

### Data Lineage
- Display → Diagram: Synapse → Talia → Component (not FK ERD)
- Component filter scopes the graph; Co-consumers restores shared fan-out
- Usage-weighted edges + Legends strip (Views / StatusBar)
- Advisory logical links catalog (proposed / provisional / confirmed)
- PDF export embeds a light-theme diagram SVG

### PlaceHolder
- Wireframe canvas for early UX/layout before full panel implementation

### Science / engine
- Evidence contract + Driver Analysis path
- Server migration `rm_science_evidence` and GraphQL wiring

### Auth / MVP
- OIDC role map and landing polish for Celestyal SSO

## Version matrix

| Package | Version |
|---------|---------|
| Root / platform | 0.5.0 |
| talia-ui | 0.5.0 |
| talia-server | 0.5.0 |
| talia-engine | 0.1.x (independent) |

## Tag

```bash
git tag -a v0.5.0 -m "Talia 0.5.0 firm/dev baseline"
```

See [CHANGELOG.md](../CHANGELOG.md) for the full entry.
