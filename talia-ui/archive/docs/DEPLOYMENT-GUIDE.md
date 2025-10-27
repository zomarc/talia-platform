# Netlify Deployment Guide for TaliaHub

## 🚀 Successful Deployment Steps

### **Repository Information**
- **GitHub Repository:** `https://github.com/rbryer/dockview01.git`
- **Domain:** `taliahub.com`
- **Current Working Branch:** `feature-talia-auth`

### **Build Configuration**
- **Build Command:** `npm run build`
- **Publish Directory:** `dist`
- **Node Version:** 18
- **Framework:** Vite + React

### **Deployment Process**

#### **Step 1: Prepare for Deployment**
```bash
# Ensure all changes are committed
git add .
git commit -m "Your commit message"

# Push to GitHub
git push origin feature-talia-auth
```

#### **Step 2: Netlify Configuration**
- **Go to:** [Netlify Dashboard](https://app.netlify.com/)
- **Find your site:** taliahub.com
- **Go to:** Site Settings → Build & Deploy → Continuous Deployment
- **Configure:**
  - **Branch to deploy:** `feature-talia-auth` (or `main` if merged)
  - **Build command:** `npm run build`
  - **Publish directory:** `dist`

#### **Step 3: Force Deployment (if needed)**
- **Go to:** Deploys in Netlify dashboard
- **Click:** "Trigger deploy" → "Deploy site"
- **This forces a new build from the current branch**

#### **Step 4: Verify Deployment**
- **Check:** taliahub.com for latest changes
- **Clear browser cache** if seeing old version
- **Test:** All functionality works correctly

### **Netlify Configuration File**
The `netlify.toml` file is already configured with:
```toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[dev]
  command = "npm run dev"
  port = 5173
  publish = "dist"
```

### **Troubleshooting**

#### **If Old Version Still Shows:**
1. **Check branch:** Ensure Netlify is deploying from correct branch
2. **Force deploy:** Trigger manual deployment
3. **Clear cache:** Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)
4. **Check logs:** Review build logs for errors

#### **If Build Fails:**
1. **Test locally:** Run `npm run build` locally first
2. **Check dependencies:** Ensure all packages are in package.json
3. **Node version:** Verify Node 18 is set in Netlify
4. **Environment variables:** Add any required env vars in Netlify

### **Current Working Features**
✅ **Authentication System**
- Magic code sign-in flow
- User profile management
- Role-based access control
- Demo mode for testing

✅ **Layout System**
- Fixed panel ID consistency issues
- Proper grid layout for performance dashboard
- No more "referencePanel does not exist" errors
- Dockview layout working correctly

✅ **Performance Dashboard**
- Sailings table
- Key Performance Indicators
- Weekly Occupancy & Revenue chart
- Revenue Breakdown
- Active Exceptions

### **Deployment Checklist**
- [ ] All changes committed and pushed to GitHub
- [ ] Netlify branch set to correct branch
- [ ] Build command: `npm run build`
- [ ] Publish directory: `dist`
- [ ] Node version: 18
- [ ] Manual deploy triggered (if needed)
- [ ] Site tested on taliahub.com
- [ ] All features working correctly

### **Quick Deploy Command**
```bash
# Quick deployment workflow
git add .
git commit -m "feat: Your feature description"
git push origin feature-talia-auth
# Then trigger deploy in Netlify dashboard
```

---

**Last Successful Deployment:** December 2024
**Status:** ✅ WORKING PERFECTLY
**Domain:** taliahub.com
**Repository:** rbryer/dockview01
