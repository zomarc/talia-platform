# ngrok Status - External Access

## ✅ Current Status: OPERATIONAL

### External URL
**https://kelley-resistless-sniffingly.ngrok-free.dev/celestyal**

### Access Information
- **Full URL**: `https://kelley-resistless-sniffingly.ngrok-free.app/celestyal`
- **Local URL**: `http://localhost:5173/celestyal`
- **ngrok Dashboard**: `http://localhost:4040`

### Architecture
- ✅ **Frontend**: Exposed via ngrok
- ✅ **Backend**: Local-only (localhost:4000)
- ✅ **API Proxy**: `/celestyal/api/graphql` → `localhost:4000/graphql`

## Important Notes

### Free Plan Limitations
⚠️ **This URL will change** each time you restart ngrok. 

To get a stable URL, you have two options:

1. **Upgrade to Paid Plan** ($8/month)
   - Use `taliahub.com/celestyal` (custom domain)
   - Stable URL that never changes
   - More professional for clients

2. **Use Free Static Domain** (Free)
   - Reserve a free domain in ngrok dashboard
   - URL like: `yourname.ngrok-free.app/celestyal`
   - Stable URL without paying

### First Visit Warning
When users first visit the ngrok URL, they'll see an ngrok "Visit Site" page. This is normal for free plans. Users just need to click "Visit Site" once.

## Quick Commands

### Check Status
```bash
./scripts/check-ngrok-celestyal-status.sh
```

### Stop ngrok
```bash
pkill -f "ngrok http"
```

### Restart ngrok
```bash
./scripts/start-ngrok-free.sh
```

## Testing

### Test in Browser
Open: `https://kelley-resistless-sniffingly.ngrok-free.app/celestyal`

### Test API
```bash
curl https://kelley-resistless-sniffingly.ngrok-free.app/celestyal/api/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

## Next Steps

1. **Share the URL** with your client: `https://kelley-resistless-sniffingly.ngrok-free.app/celestyal`
2. **Monitor usage** in ngrok dashboard: http://localhost:4040
3. **Consider upgrading** if you need a stable URL for production use

