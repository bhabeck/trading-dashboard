# Habeck Trading Dashboard

Multi-asset technical analysis signal dashboard. Displays buy/sell signals from 6 concurrent indicators (RSI, MACD, Bollinger Bands, EMA Crossover, Volume Spike, Stochastic RSI) with confluence scoring.

**Frontend:** React + TradingView Lightweight Charts — deployed on Cloudflare Pages  
**Backend:** Python signal engine + Flask API — deployed on AWS EC2

---

## Deployment Guide

### Step 1 — Generate your API token

On your Mac, run:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```
Copy the output. You'll use this token in both the backend config and Cloudflare environment variables.

---

### Step 2 — Deploy the Backend to EC2

**2a.** SSH into your server:
```bash
ssh -i /Users/benhabeck/algo-trading-app/btc-algo-key.pem ubuntu@3.131.135.86
```

**2b.** Stop the old algo script:
```bash
pkill -f btc_dip_buyer.py
```

**2c.** Install new dependencies:
```bash
cd ~/algo-trader
pip3 install flask flask-cors gunicorn --break-system-packages
```

**2d.** Exit SSH:
```bash
exit
```

**2e.** Upload the new backend files (run from your Mac):
```bash
scp -i /Users/benhabeck/algo-trading-app/btc-algo-key.pem \
  signal_engine.py watchlist.json \
  ubuntu@3.131.135.86:~/algo-trader/
```

**2f.** Update config.py on the server — SSH back in and add the API_TOKEN:
```bash
ssh -i /Users/benhabeck/algo-trading-app/btc-algo-key.pem ubuntu@3.131.135.86
nano ~/algo-trader/config.py
```
Add this line at the bottom of config.py:
```python
API_TOKEN = "paste-your-generated-token-here"
```
Save: `Ctrl+O`, `Enter`, `Ctrl+X`

**2g.** Start the signal engine:
```bash
cd ~/algo-trader
nohup python3 signal_engine.py > output.log 2>&1 &
```

**2h.** Verify it's running:
```bash
curl http://localhost:5000/api/health
```
You should see `{"status": "ok", ...}`

Then: `Ctrl+C`, `exit`

---

### Step 3 — Open Port 5000 on AWS

1. Go to AWS Console → EC2 → Security Groups
2. Find the security group attached to your instance
3. Edit Inbound Rules → Add Rule:
   - **Type:** Custom TCP
   - **Port Range:** 5000
   - **Source:** 0.0.0.0/0 (or restrict to Cloudflare IPs for security)
   - **Description:** Signal Engine API
4. Save

---

### Step 4 — Set Up `api.benhabeck.com` in Cloudflare

1. Go to Cloudflare Dashboard → benhabeck.com → DNS
2. Add a new **A record**:
   - **Name:** `api`
   - **IPv4 Address:** `3.131.135.86`
   - **Proxy status:** Proxied (orange cloud ON)
3. Save

4. Go to **Rules** → **Origin Rules** → Create Rule:
   - **When:** Hostname equals `api.benhabeck.com`
   - **Then:** Override destination port → `5000`
   - Save and deploy

Now `https://api.benhabeck.com/api/health` should return the health check.

---

### Step 5 — Push Frontend to GitHub

**5a.** Create a new GitHub repo called `trading-dashboard` (private recommended)

**5b.** From your Mac, inside the `trading-dashboard` folder:
```bash
cd trading-dashboard
git init
git add .
git commit -m "Initial trading dashboard"
git branch -M main
git remote add origin https://github.com/benhabeck/trading-dashboard.git
git push -u origin main
```

---

### Step 6 — Connect Cloudflare Pages

1. Go to Cloudflare Dashboard → **Workers & Pages** → **Create**
2. Select **Pages** → **Connect to Git**
3. Select your `trading-dashboard` repo
4. Configure build:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** (leave blank)
5. Add **Environment Variables**:
   - `VITE_API_URL` = `https://api.benhabeck.com`
   - `VITE_API_TOKEN` = `paste-your-generated-token-here`
6. Save and Deploy

---

### Step 7 — Set Custom Domain

1. After the first deploy, go to your Pages project → **Custom Domains**
2. Add `benhabeck.com/trading` as a custom path
   
   **Note:** If Cloudflare doesn't support path-based custom domains for your plan, use a subdomain instead:
   - Add `trading.benhabeck.com` as a custom domain (Cloudflare auto-creates the DNS record)
   - Then add a redirect rule: `benhabeck.com/trading/*` → `https://trading.benhabeck.com/$1`

---

## Local Development

```bash
cd trading-dashboard
npm install
npm run dev
```

Create a `.env` file:
```
VITE_API_URL=http://localhost:5000
VITE_API_TOKEN=your-dev-token
```

The dev server runs at `http://localhost:5173`

---

## Architecture

```
benhabeck.com/trading  ←→  api.benhabeck.com
   (Cloudflare Pages)        (EC2 via Cloudflare proxy)
   React + Charts            Flask API + Signal Engine
                             ↓
                          Alpaca Markets (data)
                          Telegram (alerts)
```

---

## Updating

**Frontend changes:**
```bash
git add .
git commit -m "description of change"
git push
```
Cloudflare Pages auto-deploys on push.

**Backend changes:**
```bash
scp -i /Users/benhabeck/algo-trading-app/btc-algo-key.pem \
  signal_engine.py ubuntu@3.131.135.86:~/algo-trader/

ssh -i /Users/benhabeck/algo-trading-app/btc-algo-key.pem ubuntu@3.131.135.86
pkill -f signal_engine.py
cd ~/algo-trader && nohup python3 signal_engine.py > output.log 2>&1 &
exit
```
