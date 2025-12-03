# Quick Start: Configure Google API Keys

## Step-by-Step Guide

### Step 1: Get Your Google API Credentials

#### A. Get API Key (Google Cloud Console)

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create or Select a Project**
   - Click the project dropdown at the top
   - Click "New Project" (or select existing)
   - Name it "Talia Platform" (or any name you prefer)
   - Click "Create"

3. **Enable Custom Search API**
   - Go to **"APIs & Services"** > **"Library"**
   - Search for **"Custom Search API"**
   - Click on it and click **"Enable"**

4. **Create API Key**
   - Go to **"APIs & Services"** > **"Credentials"**
   - Click **"Create Credentials"** > **"API Key"**
   - Copy the API key that appears
   - **Optional**: Click "Restrict Key" and select "Custom Search API" for security

#### B. Get Search Engine ID (Custom Search Engine)

1. **Go to Custom Search Engine Control Panel**: https://programmablesearchengine.google.com/
2. **Create Search Engine**
   - Click **"Add"** button
   - **Sites to search**: 
     - Leave blank to search entire web, OR
     - Enter specific sites (e.g., `celestyal.com`)
   - **Name**: "Talia Search Engine" (or any name)
   - Click **"Create"**
3. **Get Search Engine ID**
   - After creation, you'll see a **Search Engine ID** (CX)
   - Format: `012345678901234567890:abc123def456`
   - **Copy this ID**

4. **Enable Web Search (Optional)**
   - Click on your search engine
   - Go to **"Setup"** tab
   - Under **"Basics"**, enable **"Search the entire web"**
   - This allows broader search results

---

### Step 2: Add Keys to Your Environment File

1. **Open the environment file**:
   ```bash
   cd talia-server
   nano .env  # or use your preferred editor
   ```

2. **Add these lines at the end of the file**:
   ```bash
   # Google Search API Configuration
   GOOGLE_SEARCH_API_KEY=your-actual-api-key-here
   GOOGLE_SEARCH_ENGINE_ID=your-actual-search-engine-id-here
   ```

3. **Replace the placeholders**:
   - Replace `your-actual-api-key-here` with the API key from Step 1A
   - Replace `your-actual-search-engine-id-here` with the Search Engine ID from Step 1B

4. **Save the file** (in nano: `Ctrl+X`, then `Y`, then `Enter`)

---

### Step 3: Restart the Server

After adding the keys, restart your GraphQL server:

```bash
cd talia-server
npm run restart
```

The server needs to restart to load the new environment variables.

---

### Step 4: Test It

1. **Start the UI** (if not already running):
   ```bash
   cd talia-ui
   npm run dev
   ```

2. **Test the Google Search component**:
   - Navigate to: http://localhost:5173
   - Go to the Test Page
   - Select "GoogleSearch" from the component list
   - Enter a search query (e.g., "Celestyal Cruises")
   - Click "Search"
   - You should see Google search results!

---

## Example .env File

Your `talia-server/.env` file should look something like this:

```bash
# Supabase Configuration (Local Development)
SUPABASE_URL=http://127.0.0.1:54323
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Azure Synapse Configuration (Production Data)
AZURE_SYNAPSE_SERVER=celestyaldataplatform-prd.sql.azuresynapse.net
AZURE_SYNAPSE_PORT=1433
AZURE_SYNAPSE_DATABASE=CDP_Dedicated_SQL_DWH
AZURE_SYNAPSE_USERNAME=RBryer
AZURE_SYNAPSE_PASSWORD=Cele5tyalrbUser!

# Data Source Priority (supabase | azure | both)
DATA_SOURCE_PRIORITY=supabase

# Environment
NODE_ENV=development

# Google Search API Configuration
GOOGLE_SEARCH_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz
GOOGLE_SEARCH_ENGINE_ID=012345678901234567890:abc123def456
```

---

## Troubleshooting

### "API key not valid" error
- Double-check you copied the entire API key (no extra spaces)
- Make sure Custom Search API is enabled in Google Cloud Console
- Wait a few minutes after enabling the API - it can take time to propagate

### "Invalid Search Engine ID" error
- Verify you copied the full Search Engine ID (CX)
- Check that the search engine exists in your Custom Search Engine Control Panel

### "Google Custom Search API credentials not configured" error
- Make sure you added the keys to `talia-server/.env` (not `talia-ui/.env`)
- Restart the server after adding the keys
- Check that variable names are exactly: `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` (case-sensitive)

### No search results
- Try enabling "Search the entire web" in your search engine settings
- Check if your search engine has any site restrictions
- Try a different search query

---

## Cost Information

- **Free Tier**: 100 searches per day (free)
- **Paid**: After free quota, $5 per 1,000 searches

The free tier should be sufficient for development and testing.

---

## Quick Reference

**Where to get credentials:**
- **API Key**: https://console.cloud.google.com/apis/credentials
- **Search Engine ID**: https://programmablesearchengine.google.com/

**File to edit:**
- `talia-server/.env`

**Variables to add:**
```bash
GOOGLE_SEARCH_API_KEY=your-key-here
GOOGLE_SEARCH_ENGINE_ID=your-id-here
```

**After adding keys:**
```bash
cd talia-server && npm run restart
```

---

For more detailed information, see `GOOGLE-API-KEYS-SETUP.md`

