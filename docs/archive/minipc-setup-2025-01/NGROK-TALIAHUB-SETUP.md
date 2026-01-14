# ngrok taliahub.com Setup ✅

## Configuration

**Service**: `ngrok-taliahub.service`  
**Config File**: `~/.ngrok2/ngrok-taliahub.yml`  
**Domain**: `taliahub.com`  
**Local Port**: `5173` (Talia UI)

## Service Management

```bash
# Start service
sudo systemctl start ngrok-taliahub

# Stop service
sudo systemctl stop ngrok-taliahub

# Check status
sudo systemctl status ngrok-taliahub

# View logs
sudo journalctl -u ngrok-taliahub -f

# Restart service
sudo systemctl restart ngrok-taliahub
```

## Verify Tunnel

```bash
# Check tunnel status via API
curl -s http://localhost:4040/api/tunnels | python3 -m json.tool

# Check if taliahub.com is active
curl -s http://localhost:4040/api/tunnels | grep -o 'taliahub.com'

# Test public URL
curl -s https://taliahub.com | head -5
```

## Access URLs

- **Public URL**: https://taliahub.com
- **Local URL**: http://192.168.1.120:5173
- **ngrok Web UI**: http://localhost:4040

## Troubleshooting

### Service not starting
```bash
# Check logs
sudo journalctl -u ngrok-taliahub -n 50

# Verify config
cat ~/.ngrok2/ngrok-taliahub.yml

# Test manually
ngrok http --config ~/.ngrok2/ngrok-taliahub.yml talia-ui
```

### Custom domain not working
- Verify ngrok account has custom domain feature (paid plan required)
- Check domain is configured in ngrok dashboard: https://dashboard.ngrok.com/domains
- Ensure DNS is pointing to ngrok (if required)

### Tunnel not appearing
- Wait a few seconds after starting service
- Check ngrok web UI: http://localhost:4040
- Verify UI is running on port 5173: `curl http://localhost:5173`

---

**Status**: ✅ Service configured and running
