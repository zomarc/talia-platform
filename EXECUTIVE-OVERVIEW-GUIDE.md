# Executive Overview Generation Guide

This guide explains how to generate and maintain the Executive Overview document for management presentations.

---

## Quick Start

### Generate the Document

```bash
# Generate/update the executive overview
npm run generate:overview
```

This will:
- ✅ Read current version from `package.json`
- ✅ Extract recent changes from `CHANGELOG.md`
- ✅ Update dates and week numbers automatically
- ✅ Generate `EXECUTIVE-OVERVIEW.md` with current information

### Generate PDF

```bash
# Option 1: Using pandoc (recommended)
npm run generate:overview:pdf

# Option 2: Using markdown-pdf
npm install -g markdown-pdf
npm run generate:overview:pdf
```

---

## Weekly Workflow

### Recommended Weekly Process

1. **Monday Morning**: Generate fresh overview
   ```bash
   npm run generate:overview
   ```

2. **Review & Customize**: Open `EXECUTIVE-OVERVIEW.md` and add any custom notes or updates

3. **Generate PDF** (if needed):
   ```bash
   npm run generate:overview:pdf
   ```

4. **Or Use gamma.app**:
   - Copy content from `EXECUTIVE-OVERVIEW.md`
   - Paste into gamma.app
   - Let gamma.app create a beautiful presentation

---

## PDF Generation Options

### Option 1: pandoc (Best Quality)

**Installation:**
```bash
# macOS
brew install pandoc

# Linux
sudo apt-get install pandoc texlive-xetex

# Windows
# Download from https://pandoc.org/installing.html
```

**Usage:**
```bash
npm run generate:overview:pdf
```

**Advantages:**
- ✅ High-quality PDF output
- ✅ Professional formatting
- ✅ Supports custom styling
- ✅ Handles complex markdown

### Option 2: markdown-pdf (Simple)

**Installation:**
```bash
npm install -g markdown-pdf
```

**Usage:**
```bash
npm run generate:overview:pdf
```

**Advantages:**
- ✅ Simple installation
- ✅ Quick generation
- ✅ Good for basic documents

### Option 3: gamma.app (Best Presentation)

**Process:**
1. Generate the markdown: `npm run generate:overview`
2. Go to [gamma.app](https://gamma.app)
3. Create a new presentation
4. Copy content from `EXECUTIVE-OVERVIEW.md`
5. Paste into gamma.app
6. Let gamma.app format it beautifully
7. Export as PDF or present directly

**Advantages:**
- ✅ Beautiful, modern presentation format
- ✅ Interactive elements
- ✅ Professional design
- ✅ Easy to share and present
- ✅ Can be edited visually

### Option 4: Manual Conversion

**Using VS Code:**
1. Install "Markdown PDF" extension
2. Open `EXECUTIVE-OVERVIEW.md`
3. Right-click → "Markdown PDF: Export (pdf)"

**Using Online Tools:**
- [Markdown to PDF](https://www.markdowntopdf.com/)
- [Dillinger](https://dillinger.io/) - Export as PDF
- [StackEdit](https://stackedit.io/) - Export as PDF

---

## Customization

### Updating Content

The script automatically pulls from:
- `package.json` - Version number
- `CHANGELOG.md` - Recent changes
- Current date - Automatically updated

### Manual Edits

After generation, you can manually edit `EXECUTIVE-OVERVIEW.md` to:
- Add custom notes or highlights
- Update specific sections
- Add weekly achievements
- Customize goals and priorities

### Template Customization

To modify the template structure, edit:
```
scripts/generate-executive-overview.js
```

The template is in the `generateExecutiveOverview()` function.

---

## Automation

### Weekly Reminder (macOS/Linux)

Add to your crontab:
```bash
# Edit crontab
crontab -e

# Add this line (runs every Monday at 9 AM)
0 9 * * 1 cd /Users/russell/Work/AA-Celestyal/Dev/talia && npm run generate:overview
```

### Git Hook (Pre-commit)

Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash
cd /Users/russell/Work/AA-Celestyal/Dev/talia
npm run generate:overview
git add EXECUTIVE-OVERVIEW.md
```

### CI/CD Integration

Add to your CI/CD pipeline:
```yaml
# Example GitHub Actions
- name: Generate Executive Overview
  run: npm run generate:overview
- name: Upload PDF
  uses: actions/upload-artifact@v3
  with:
    name: executive-overview
    path: EXECUTIVE-OVERVIEW.pdf
```

---

## Best Practices

### Weekly Updates

1. **Generate Fresh**: Always generate a new version before meetings
2. **Review Changes**: Check what changed since last week
3. **Add Highlights**: Manually add any major achievements
4. **Update Goals**: Adjust priorities based on progress

### Before Presentations

1. **Generate**: `npm run generate:overview`
2. **Review**: Read through the document
3. **Customize**: Add any presentation-specific notes
4. **Export**: Generate PDF or use gamma.app
5. **Share**: Distribute to stakeholders

### Version Control

- ✅ Commit `EXECUTIVE-OVERVIEW.md` to git
- ✅ Keep PDFs in a shared folder (not git)
- ✅ Tag versions for important milestones
- ✅ Archive old versions for reference

---

## Troubleshooting

### Script Fails

**Error: "Cannot find module"**
```bash
# Make sure you're in the project root
cd /Users/russell/Work/AA-Celestyal/Dev/talia
npm run generate:overview
```

**Error: "Permission denied"**
```bash
# Make script executable
chmod +x scripts/generate-executive-overview.js
```

### PDF Generation Fails

**No PDF tool installed:**
- Install pandoc or markdown-pdf (see options above)
- Or use gamma.app instead

**PDF looks wrong:**
- Try a different tool (pandoc usually works best)
- Or use gamma.app for better formatting

### Content Out of Date

**Version number wrong:**
- Check `package.json` version
- Update if needed

**Recent changes missing:**
- Check `CHANGELOG.md` has latest entries
- Update CHANGELOG.md first, then regenerate

---

## Tips for gamma.app

### Getting Best Results

1. **Structure**: gamma.app works best with clear sections (already in the markdown)
2. **Bullet Points**: Convert long paragraphs to bullets for better slides
3. **Visuals**: Add diagrams/images manually in gamma.app
4. **Themes**: Choose a professional theme that matches your brand

### Workflow

1. Generate markdown: `npm run generate:overview`
2. Open gamma.app
3. Create new presentation
4. Import or paste markdown content
5. Let gamma.app auto-format
6. Review and customize slides
7. Export as PDF or present directly

---

## Support

For issues or questions:
- Check script output for error messages
- Review `scripts/generate-executive-overview.js`
- See `/docs` directory for more documentation

---

**Last Updated**: December 2024

