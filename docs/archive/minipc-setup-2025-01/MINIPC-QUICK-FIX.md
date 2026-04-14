# Quick Fix for Supabase CLI Installation on MiniPC

## You're Already SSH'd In - Run These Commands:

### Option 1: Install from Existing .deb File

```bash
ls -lh ~/supabase.deb
sudo dpkg -i ~/supabase.deb || sudo apt-get install -f -y
supabase --version
```

### Option 2: Use npm (recommended if Node is installed)

```bash
npm --version
sudo npm install -g supabase
supabase --version
```

### Option 3: Follow vendor docs

Install the Supabase CLI using the **getting started** instructions in Supabase’s own documentation (package names and URLs change over time).
