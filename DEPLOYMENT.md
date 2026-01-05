# Deployment Guide: Proxmox LXC with Docker

This guide walks you through deploying the Grocery App on a Proxmox LXC container.

## Prerequisites

- Proxmox VE 7.x or 8.x
- Access to Proxmox web interface or CLI
- Basic familiarity with Linux commands

---

## Step 1: Create the LXC Container

### 1.1 Download Container Template

1. In Proxmox web UI, go to your storage (e.g., `local`)
2. Click **CT Templates** → **Templates**
3. Download: **Debian 12 (Bookworm)** or **Ubuntu 22.04 LTS**

> 💡 **Recommended:** Debian 12 - lightweight, stable, excellent Docker support

### 1.2 Create the Container

**Via Web UI:**

1. Click **Create CT**
2. Configure:
   - **Hostname:** `grocery-app`
   - **Password:** Set a strong root password
   - **Template:** Select Debian 12 or Ubuntu 22.04
   - **Disk:** 10GB minimum (20GB recommended)
   - **CPU:** 2 cores
   - **Memory:** 2048 MB (2GB minimum)
   - **Network:** DHCP or static IP
   
3. ⚠️ **Important:** Check **Unprivileged container** (default)
4. Under **Options** tab after creation, enable:
   - **Features → Nesting:** ✅ (required for Docker)
   - **Features → keyctl:** ✅ (recommended)

**Via CLI:**
```bash
# Download template
pveam update
pveam download local debian-12-standard_12.2-1_amd64.tar.zst

# Create container
pct create 100 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname grocery-app \
  --memory 2048 \
  --cores 2 \
  --rootfs local-lvm:10 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 \
  --features nesting=1,keyctl=1 \
  --password

# Start container
pct start 100
```

### 1.3 Enable Nesting (If Not Done During Creation)

```bash
# On Proxmox host
pct set 100 --features nesting=1,keyctl=1
pct stop 100
pct start 100
```

---

## Step 2: Initial Container Setup

```bash
# Enter the container
pct enter 100

# Or SSH into it
ssh root@<container-ip>
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

## Step 3: Install Docker

### 3.1 Add Docker Repository

**For Debian 12:**
```bash
# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Add repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
```

**For Ubuntu 22.04:**
```bash
# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Add repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### 3.2 Install Docker Engine

```bash
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 3.3 Verify Installation

```bash
docker --version
docker compose version
docker run hello-world
```

---

## Step 4: Deploy the Application

### 4.1 Clone the Repository

```bash
cd /opt
git clone <your-repo-url> grocery-app-web
cd grocery-app-web
```

Or copy files from your local machine:
```bash
# From your local machine
scp -r grocery-app-web root@<container-ip>:/opt/
```

### 4.2 Configure Environment Variables

```bash
cd /opt/grocery-app-web

# Create .env file
cat > .env << 'EOF'
# JWT Secret - CHANGE THIS!
JWT_SECRET=your-super-secure-random-string-change-me-in-production

# Google AI API Key (for grocery parsing)
GOOGLE_API_KEY=your-google-api-key-here
EOF

# Secure the file
chmod 600 .env
```

> 🔐 **Generate a secure JWT secret:**
> ```bash
> openssl rand -base64 32
> ```

### 4.3 Build and Start Services

```bash
cd /opt/grocery-app-web

# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### 4.4 Initialize Database

The database is automatically migrated and seeded on first startup. Verify:

```bash
docker compose logs migrate
```

---

## Step 5: Access the Application

The app is now available at:
- **http://<container-ip>/** - Main application

### 5.1 Find Container IP

```bash
# Inside container
hostname -I

# From Proxmox host
pct exec 100 -- hostname -I
```

---

## Step 6: (Optional) Reverse Proxy with SSL

### 6.1 Install Nginx

```bash
apt install -y nginx
```

### 6.2 Configure Nginx

```bash
cat > /etc/nginx/sites-available/grocery-app << 'EOF'
server {
    listen 80;
    server_name grocery.yourdomain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/grocery-app /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 6.3 Add SSL with Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d grocery.yourdomain.com
```

---

## Step 7: Maintenance Commands

### View Logs
```bash
cd /opt/grocery-app-web
docker compose logs -f              # All services
docker compose logs -f backend      # Backend only
docker compose logs -f postgres     # Database only
```

### Restart Services
```bash
docker compose restart              # Restart all
docker compose restart backend      # Restart backend only
```

### Update Application
```bash
cd /opt/grocery-app-web
git pull                            # If using git
docker compose down
docker compose up -d --build
```

### Backup Database
```bash
# Create backup
docker compose exec postgres pg_dump -U grocery_user grocery_db > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup_20240115.sql | docker compose exec -T postgres psql -U grocery_user grocery_db
```

### Reset Database (⚠️ Destructive)
```bash
docker compose down -v              # Remove volumes
docker compose up -d --build        # Fresh start
```

---

## Troubleshooting

### Docker Not Starting
```bash
# Check if nesting is enabled
cat /proc/1/status | grep CapEff

# Should see non-zero capability mask
# If zero, enable nesting on Proxmox host:
pct set 100 --features nesting=1
pct reboot 100
```

### Permission Errors
```bash
# For Docker socket
chmod 666 /var/run/docker.sock

# Or add user to docker group (if not using root)
usermod -aG docker $USER
```

### Container Health Check
```bash
# Check all containers
docker compose ps

# Check health
curl http://localhost:3001/health
```

### View Resource Usage
```bash
docker stats
```

---

## Resource Requirements Summary

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU       | 1 core  | 2 cores     |
| RAM       | 1 GB    | 2 GB        |
| Disk      | 10 GB   | 20 GB       |
| Network   | NAT/Bridge | Bridge    |

---

## Security Checklist

- [ ] Change default JWT_SECRET
- [ ] Use strong database password (if changed from default)
- [ ] Enable firewall (only expose ports 80/443)
- [ ] Set up SSL with Let's Encrypt
- [ ] Regular backups enabled
- [ ] Keep system and Docker updated

```bash
# Basic firewall setup
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

