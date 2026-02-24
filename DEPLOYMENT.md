# Deployment Guide: Proxmox LXC with PM2

Deploy the Grocery App on a Proxmox 9 LXC container using PM2 and Cloudflare Tunnel — no Docker, nginx, or port forwarding required.

## Prerequisites

- Proxmox VE 9.1+
- A Cloudflare account with a domain (e.g., `grocery.yourdomain.com`)
- Basic familiarity with Linux commands

---

## Step 1: Create the LXC Container

### 1.1 Download Container Template

1. In Proxmox web UI, go to your storage (e.g., `local`)
2. Click **CT Templates** → **Templates**
3. Download: **Debian 13 (Trixie)**

### 1.2 Create the Container

**Via Web UI:**

1. Click **Create CT**
2. Configure:
   - **CT ID:** `111`
   - **Hostname:** `grocery-app`
   - **Password:** Set a strong root password
   - **Template:** Debian 13
   - **Disk:** 10GB minimum (20GB recommended)
   - **CPU:** 2 cores
   - **Memory:** 2048 MB (2GB minimum)
   - **Network:** DHCP or static IP

3. Check **Unprivileged container** (default)

**Via CLI:**
```bash
pveam update
pveam download local debian-13-standard_13.0-1_amd64.tar.zst

pct create 111 local:vztmpl/debian-13-standard_13.0-1_amd64.tar.zst \
  --hostname grocery-app \
  --memory 2048 \
  --cores 2 \
  --rootfs local-lvm:10 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 \
  --password

pct start 111
```

---

## Step 2: Initial Container Setup

```bash
pct enter 111
# Or: ssh root@<container-ip>
```

### 2.1 Update System

```bash
apt update && apt upgrade -y
```

### 2.2 Install Essential Tools

```bash
apt install -y curl wget git nano ca-certificates gnupg lsb-release
```

---

## Step 3: Install Node.js 24

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs

node -v   # should print v24.x
npm -v
```

---

## Step 4: Install PostgreSQL

### 4.1 Install

```bash
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql
```

### 4.2 Create Database and User

```bash
sudo -u postgres psql <<SQL
CREATE USER grocery_user WITH PASSWORD 'grocery_password';
CREATE DATABASE grocery_db OWNER grocery_user;
GRANT ALL PRIVILEGES ON DATABASE grocery_db TO grocery_user;
SQL
```

> Change the password in production and match it in your `.env` file.

### 4.3 Verify

```bash
sudo -u postgres psql -c "\l"
```

### 4.4 (Optional) Migrate Data from Existing Docker Deployment

If you have an existing Docker-based deployment and want to preserve your data:

```bash
# On the OLD server (Docker deployment), export the database:
docker compose exec postgres pg_dump -U grocery_user grocery_db > grocery_backup.sql

# Copy the backup to the new server:
scp grocery_backup.sql root@<new-server-ip>:/tmp/

# On the NEW server, import into native PostgreSQL:
sudo -u postgres psql grocery_db < /tmp/grocery_backup.sql
```

> If you're doing a fresh install, skip this step — the migration script in Step 6.4 will create all tables.

---

## Step 5: Install PM2

```bash
npm install -g pm2
pm2 startup   # generates a command to run — execute it so PM2 starts on boot
```

---

## Step 6: Deploy the Application

### 6.1 Clone the Repository

```bash
cd /opt
git clone <your-repo-url> grocery-app-web
cd grocery-app-web
```

Or copy files from your local machine:
```bash
scp -r grocery-app-web root@<container-ip>:/opt/
```

### 6.2 Configure Environment Variables

```bash
cd /opt/grocery-app-web

cat > .env << 'EOF'
NODE_ENV=production
DATABASE_URL=postgresql://grocery_user:grocery_password@localhost:5432/grocery_db
JWT_SECRET=your-super-secure-random-string-change-me-in-production
JWT_EXPIRES_IN=7d
GOOGLE_API_KEY=your-google-api-key-here
FRONTEND_URL=https://grocery.yourdomain.com
PORT=3001
EOF

chmod 600 .env
```

> Generate a secure JWT secret:
> ```bash
> openssl rand -base64 32
> ```

### 6.3 Build and Start

A single script handles everything — dependencies, migrations, frontend build, and PM2:

```bash
cd /opt/grocery-app-web
chmod +x build.sh
./build.sh
```

This script is also safe to re-run for updates (it restarts PM2 instead of duplicating processes).

> **What `build.sh` does:** installs all dependencies, runs DB migrations and seed,
> builds the frontend, and starts (or restarts) the backend via PM2.

---

## Step 7: Set Up Cloudflare Tunnel

Cloudflare Tunnel exposes the app to the internet securely — no open inbound ports, SSL handled automatically by Cloudflare.

### 7.1 Install cloudflared

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  | tee /etc/apt/sources.list.d/cloudflared.list
apt update
apt install -y cloudflared
```

### 7.2 Authenticate

```bash
cloudflared tunnel login
```

This opens a URL — paste it into a browser, select your Cloudflare domain, and authorize.

### 7.3 Create the Tunnel

```bash
cloudflared tunnel create grocery-app
```

Note the tunnel ID printed (e.g., `abcd1234-...`).

### 7.4 Configure the Tunnel

```bash
mkdir -p /etc/cloudflared

cat > /etc/cloudflared/config.yml << EOF
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: grocery.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
EOF
```

Replace `<TUNNEL_ID>` with your actual tunnel ID and `grocery.yourdomain.com` with your domain.

### 7.5 Add DNS Record

```bash
cloudflared tunnel route dns grocery-app grocery.yourdomain.com
```

### 7.6 Run as a systemd Service

```bash
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
systemctl status cloudflared
```

The app is now accessible at **https://grocery.yourdomain.com** with full SSL.

---

## Step 8: Verify

```bash
# Local health check
curl http://localhost:3001/health

# External (after tunnel is running)
curl https://grocery.yourdomain.com/health

# From Proxmox host
pct exec 111 -- curl -s http://localhost:3001/health
```

---

## Maintenance Commands

### View Logs
```bash
pm2 logs grocery-backend
pm2 logs grocery-backend --lines 100
journalctl -u cloudflared --no-pager -n 50   # tunnel logs
```

### Restart / Stop / Start
```bash
pm2 restart grocery-backend
pm2 stop grocery-backend
pm2 start grocery-backend
```

### Monitor
```bash
pm2 monit
```

### Update Application
```bash
cd /opt/grocery-app-web
git pull
./build.sh
```

### Backup Database
```bash
pg_dump -U grocery_user grocery_db > backup_$(date +%Y%m%d).sql

# Restore
psql -U grocery_user grocery_db < backup_20240115.sql
```

### Reset Database (Destructive)
```bash
sudo -u postgres psql -c "DROP DATABASE grocery_db;"
sudo -u postgres psql -c "CREATE DATABASE grocery_db OWNER grocery_user;"
cd /opt/grocery-app-web/backend
node src/config/migrate.js
node src/config/seed.js
pm2 restart grocery-backend
```

---

## Troubleshooting

### Backend Not Starting
```bash
pm2 logs grocery-backend --lines 50
pm2 describe grocery-backend

# Check if port is in use
ss -tlnp | grep :3001
```

### PostgreSQL Connection Issues
```bash
systemctl status postgresql
sudo -u postgres psql -c "SELECT 1;"

# Check pg_hba.conf allows local connections
cat /etc/postgresql/*/main/pg_hba.conf | grep -v "^#"
```

### Cloudflare Tunnel Issues
```bash
systemctl status cloudflared
journalctl -u cloudflared --no-pager -n 50

# Test tunnel connectivity
cloudflared tunnel info grocery-app
```

### Health Check
```bash
curl http://localhost:3001/health
```

---

## Resource Requirements Summary

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU       | 1 core  | 2 cores     |
| RAM       | 1 GB    | 2 GB        |
| Disk      | 10 GB   | 20 GB       |
| Network   | NAT/Bridge | Bridge   |

---

## Security Checklist

- [ ] Change default JWT_SECRET
- [ ] Use a strong PostgreSQL password
- [ ] Set up Cloudflare Tunnel (no exposed ports needed)
- [ ] Regular backups enabled
- [ ] Keep system packages updated

Since Cloudflare Tunnel handles all inbound traffic, you can lock the firewall down completely:

```bash
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw enable
```

> No need to open ports 80/443 — `cloudflared` connects outbound to Cloudflare's edge network.
