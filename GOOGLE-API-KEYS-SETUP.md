# Google API Keys Setup Guide

## Quick Setup Steps

### 1. Get Google Custom Search API Credentials

#### Step 1: Create/Select Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click **"New Project"** or select an existing project
4. Give it a name (e.g., "Talia Platform")
5. Click **"Create"**

#### Step 2: Enable Custom Search API
1. In the Google Cloud Console, go to **"APIs & Services"** > **"Library"**
2. Search for **"Custom Search API"**
3. Click on **"Custom Search API"**
4. Click **"Enable"** button
5. Wait for the API to be enabled (usually takes a few seconds)

#### Step 3: Create API Key
1. Go to **"APIs & Services"** > **"Credentials"**
2. Click **"Create Credentials"** at the top
3. Select **"API Key"**
4. Copy the API key that appears (you'll see a popup with your key)
5. **Optional but Recommended**: Click **"Restrict Key"** to secure it:
   - Under **"API restrictions"**, select **"Restrict key"**
   - Choose **"Custom Search API"** from the list
   - Click **"Save"**

#### Step 4: Create Custom Search Engine
1. Go to [Google Programmable Search Engine Control Panel](https://programmablesearchengine.google.com/)
2. Click **"Add"** button
3. Configure your search engine:
   - **Sites to search**: 
     - Option A: Enter specific websites (e.g., `example.com`, `example.org`)
     - Option B: Leave blank to search the entire web
   - **Name**: Give it a name (e.g., "Talia Search Engine")
   - **Language**: Select your preferred language
4. Click **"Create"**
5. On the next page, click **"Get Started"**
6. You'll see your **Search Engine ID** (also called "CX")
   - It looks like: `012345678901234567890:abc123def456`
   - **Copy this ID** - you'll need it!

#### Step 5: Configure Search Engine (Optional)
1. In the Search Engine control panel, click on your search engine
2. Go to **"Setup"** tab
3. Under **"Basics"**, you can:
   - Enable **"Search the entire web"** if you want broader results
   - Add/remove sites to search
   - Set search language
4. Go to **"Advanced"** tab to configure:
   - Image search
   - Safe search settings
   - Result formatting

---

### 2. Configure Environment Variables

#### Option A: Using .env File (Recommended for Development)

1. Navigate to the talia-server directory:
   ```bash
   cd talia-server
   ```

2. Check if a `.env` file exists:
   ```bash
   ls -la .env
   ```

3. If `.env` doesn't exist, create it from the example:
   ```bash
   cp env.example .env
   ```

4. Open the `.env` file in your editor:
   ```bash
   # On macOS/Linux:
   nano .env
   # or
   code .env  # if you have VS Code
   
   # On Windows:
   notepad .env
   ```

5. Add your Google API credentials at the end of the file:
   ```bash
   # Google Search API Configuration
   GOOGLE_SEARCH_API_KEY=your-actual-api-key-here
   GOOGLE_SEARCH_ENGINE_ID=your-actual-search-engine-id-here
   ```

   Replace:
   - `your-actual-api-key-here` with the API key from Step 3
   - `your-actual-search-engine-id-here` with the Search Engine ID from Step 4

6. Save the file

#### Option B: Using System Environment Variables (Alternative)

**macOS/Linux:**
```bash
export GOOGLE_SEARCH_API_KEY="your-actual-api-key-here"
export GOOGLE_SEARCH_ENGINE_ID="your-actual-search-engine-id-here"
```

**Windows (Command Prompt):**
```cmd
set GOOGLE_SEARCH_API_KEY=your-actual-api-key-here
set GOOGLE_SEARCH_ENGINE_ID=your-actual-search-engine-id-here
```

**Windows (PowerShell):**
```powershell
$env:GOOGLE_SEARCH_API_KEY="your-actual-api-key-here"
$env:GOOGLE_SEARCH_ENGINE_ID="your-actual-search-engine-id-here"
```

**Note**: Environment variables set this way are only available in that terminal session. Use `.env` file for persistence.

---

### 3. Verify Configuration

1. **Restart the GraphQL server** (if it's running):
   ```bash
   cd talia-server
   npm run restart
   ```

2. **Check server logs** for any configuration errors:
   ```bash
   # Check if the server started successfully
   tail -f server.log  # or check the terminal where server is running
   ```

3. **Test the Google Search component**:
   - Start the UI: `cd talia-ui && npm run dev`
   - Navigate to Test Page
   - Select "GoogleSearch" component
   - Enter a search query (e.g., "Example query")
   - If configured correctly, you should see search results

---

## Troubleshooting

### Error: "Google Custom Search API credentials not configured"
- **Cause**: Environment variables not loaded
- **Solution**: 
  - Make sure `.env` file exists in `talia-server/` directory
  - Verify variable names are correct (case-sensitive)
  - Restart the server after adding variables

### Error: "API key not valid" or "403 Forbidden"
- **Cause**: Invalid API key or API not enabled
- **Solution**:
  - Double-check your API key is copied correctly (no extra spaces)
  - Verify Custom Search API is enabled in Google Cloud Console
  - Check if API key has restrictions that might block the request

### Error: "Invalid Search Engine ID"
- **Cause**: Wrong Search Engine ID (CX)
- **Solution**:
  - Verify the Search Engine ID from Programmable Search Engine Control Panel
  - Make sure it's the full ID (format: `012345678901234567890:abc123def456`)

### No search results appearing
- **Cause**: Search engine might be too restricted
- **Solution**:
  - Check Search Engine settings in Control Panel
  - Enable "Search the entire web" if you want broader results
  - Try a different search query to test

---

## Security Best Practices

1. **Never commit `.env` file to git** - It should be in `.gitignore`
2. **Restrict API Key** - In Google Cloud Console, restrict the key to only Custom Search API
3. **Use separate keys for dev/prod** - Different keys for different environments
4. **Monitor usage** - Check Google Cloud Console for API usage and set quotas if needed

---

## Cost Information

- **Free Tier**: Google Custom Search API provides 100 free searches per day
- **Paid Tier**: After free quota, it's $5 per 1,000 searches (first 100 queries per day are free)

**Note**: The free tier should be sufficient for development and testing. For production, you may need to set up billing.

---

## Quick Reference

**Where to find credentials:**
- **API Key**: Google Cloud Console > APIs & Services > Credentials
- **Search Engine ID (CX)**: Programmable Search Engine Control Panel > Your Search Engine > Setup

**File locations:**
- Environment file: `talia-server/.env`
- Example file: `talia-server/env.example`
- Service code: `talia-server/src/services/google-search.js`

---

## Next Steps

Once configured, you can:
1. Test the Google Search component in the Test Page
2. Integrate it into your focuses/panels
3. Customize search options (date restrictions, result count, etc.)
4. Set up OAuth for private Google data (Analytics, Ads, etc.)

For more information, see `GOOGLE-SEARCH-IMPLEMENTATION.md`.

