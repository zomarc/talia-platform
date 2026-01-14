# Phase 1: OpenVPN Credentials Setup

## Important: OpenVPN Username Format

According to the config file, to explicitly connect to UK#11 (IP 149.40.48.92), you need to append `:10` to your OpenVPN username.

**Format**: `YOUR_OPENVPN_USERNAME:10`

For example, if your OpenVPN username is `brn2jL80fIN3pNBA+b`, use: `brn2jL80fIN3pNBA+b:10`

## Where to Find Your OpenVPN Credentials

1. Go to: https://account.protonvpn.com/login
2. Navigate to: **Downloads** → **OpenVPN configuration files**
3. Look for your **OpenVPN username** (usually displayed near the config download area)
4. Your **OpenVPN password** is different from your Proton account password

## Once You Have Credentials

The username should be in format: `YOUR_USERNAME:10` (with `:10` suffix for UK#11)

I'll create the auth file and test the connection!
