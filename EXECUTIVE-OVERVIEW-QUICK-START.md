# Executive Overview - Quick Start

## 🚀 Generate Weekly Overview

```bash
npm run generate:overview
```

This automatically:
- ✅ Updates version from `package.json`
- ✅ Extracts recent changes from `CHANGELOG.md`
- ✅ Updates dates and week numbers
- ✅ Generates `EXECUTIVE-OVERVIEW.md`

---

## 📄 Generate PDF

### Option 1: Using pandoc (Best Quality)
```bash
# Install pandoc first
brew install pandoc  # macOS
# or
sudo apt-get install pandoc  # Linux

# Generate PDF
npm run generate:overview:pdf
```

### Option 2: Using gamma.app (Best Presentation)
1. Generate markdown: `npm run generate:overview`
2. Go to [gamma.app](https://gamma.app)
3. Create new presentation
4. Paste content from `EXECUTIVE-OVERVIEW.md`
5. Let gamma.app format it beautifully
6. Export as PDF or present directly

### Option 3: Using markdown-pdf
```bash
npm install -g markdown-pdf
npm run generate:overview:pdf
```

---

## 📅 Weekly Workflow

**Every Monday:**
```bash
# 1. Generate fresh overview
npm run generate:overview

# 2. Review and customize (optional)
# Open EXECUTIVE-OVERVIEW.md and add any notes

# 3. Generate PDF or use gamma.app
npm run generate:overview:pdf
# OR
# Copy to gamma.app for beautiful presentation
```

---

## 📚 Full Documentation

See `EXECUTIVE-OVERVIEW-GUIDE.md` for:
- Detailed instructions
- Customization options
- Troubleshooting
- Automation tips

---

**Quick Commands:**
- `npm run generate:overview` - Generate/update overview
- `npm run generate:overview:pdf` - Generate PDF (requires pandoc or markdown-pdf)




