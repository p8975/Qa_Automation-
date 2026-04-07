# APK Test Execution Engine - Setup & Deployment Guide

## Overview

This guide covers the complete setup and deployment of the APK Test Execution Engine, including Appium infrastructure, backend services, and frontend UI.

---

## Prerequisites

### System Requirements

- **Operating System**: macOS, Linux, or Windows with WSL2
- **Docker**: Version 20.10 or higher
- **Node.js**: Version 18 or higher
- **Python**: Version 3.10 or higher
- **Android SDK**: Platform tools installed
- **ADB**: Android Debug Bridge accessible via command line

### Development Tools

- Git for version control
- Code editor (VS Code recommended)
- Terminal/shell access

---

## Architecture Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Frontend      │─────▶│   Backend API    │─────▶│  Appium Server  │
│   (Next.js)     │      │   (FastAPI)      │      │   (Docker)      │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                │                            │
                                │                            │
                                ▼                            ▼
                         ┌──────────────┐          ┌─────────────────┐
                         │  Filesystem  │          │  Android Device │
                         │   Storage    │          │   /Emulator     │
                         └──────────────┘          └─────────────────┘
```

---

## Part 1: Appium Server Setup (Docker)

### Step 1: Build Appium Docker Image

```bash
cd backend
docker build -t qa-appium-server -f Dockerfile .
```

### Step 2: Start Appium Container

```bash
docker run -d \
  --name appium-server \
  -p 4723:4723 \
  qa-appium-server
```

### Step 3: Verify Appium is Running

```bash
curl http://localhost:4723/status
```

Expected output:
```json
{
  "value": {
    "ready": true,
    "message": "The server is ready to accept new sessions"
  }
}
```

### Troubleshooting Appium

**Container fails to start:**
```bash
# Check logs
docker logs appium-server

# Restart container
docker restart appium-server
```

**Port already in use:**
```bash
# Find process using port 4723
lsof -ti:4723

# Kill process or use different port
docker run -d --name appium-server -p 4724:4723 qa-appium-server
```

---

## Part 2: Backend API Setup

### Step 1: Install Dependencies

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 2: Configure Environment Variables

Create `.env` file in `backend/` directory:

```bash
# AI Configuration (REQUIRED)
API_KEY=your_stage_smart_router_api_key
BASE_URL=https://airouter.stage.in/v1

# Storage Configuration
STORAGE_ROOT=./storage
APPIUM_URL=http://localhost:4723

# Server Configuration
PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Step 3: Create Storage Directory

```bash
mkdir -p storage/{builds,test-cases,test-runs,element-maps}
```

### Step 4: Start Backend Server

```bash
cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 5: Verify Backend is Running

```bash
curl http://localhost:8000/health
```

Expected output:
```json
{
  "status": "healthy",
  "ai_configured": true,
  "model": "STAGE Smart Router (auto)",
  "base_url": "https://airouter.stage.in/v1",
  "timestamp": 1234567890.123
}
```

### Backend Troubleshooting

**Import errors:**
```bash
# Reinstall dependencies
pip install --upgrade -r requirements.txt
```

**Storage errors:**
```bash
# Ensure storage directory exists and has write permissions
chmod 755 storage
```

**AI API errors:**
```bash
# Verify API_KEY is set correctly
echo $API_KEY

# Test API endpoint directly
curl -H "Authorization: Bearer $API_KEY" $BASE_URL/models
```

---

## Part 3: Frontend Setup

### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

### Step 2: Configure Environment

Create `.env.local` file in `frontend/` directory:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Step 3: Start Frontend Server

```bash
npm run dev
```

### Step 4: Access Frontend

Open browser to: `http://localhost:3000`

You should see the main page with navigation to:
- **Generate Tests** - Test case generation from PRDs
- **Builds** - APK upload and management
- **Execute** - Test execution wizard
- **Results** - Test run results viewer

---

## Part 4: Android Device Setup

### Option A: Physical Device

1. **Enable Developer Options:**
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times

2. **Enable USB Debugging:**
   - Go to Settings > Developer Options
   - Enable "USB Debugging"

3. **Connect Device:**
   ```bash
   # Connect via USB
   adb devices
   ```

4. **Verify Connection:**
   ```bash
   adb shell getprop ro.build.version.release  # Check Android version
   ```

### Option B: Android Emulator

1. **Install Android Studio** (if not already installed)

2. **Create Emulator:**
   - Open Android Studio > AVD Manager
   - Create Virtual Device
   - Select device definition (e.g., Pixel 6)
   - Select system image (API 30+ recommended)
   - Finish setup

3. **Start Emulator:**
   ```bash
   # List available emulators
   emulator -list-avds

   # Start emulator
   emulator -avd Pixel_6_API_30 &
   ```

4. **Verify Connection:**
   ```bash
   adb devices
   # Should show emulator (e.g., emulator-5554)
   ```

---

## Part 5: Complete System Test

### 1. Upload APK Build

```bash
curl -X POST http://localhost:8000/api/builds/upload \
  -F "file=@/path/to/your/app.apk"
```

Or use the frontend at `http://localhost:3000/builds`

### 2. Check Devices

```bash
curl http://localhost:8000/api/devices
```

### 3. Generate Test Cases

Use the frontend at `http://localhost:3000` to upload a PRD and generate test cases.

### 4. Execute Test Run

Use the frontend at `http://localhost:3000/execution` to:
- Select build
- Select test cases
- Select device
- Start execution

### 5. View Results

Check results at `http://localhost:3000/results`

---

## Production Deployment

### Docker Compose Setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  appium:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "4723:4723"
    restart: unless-stopped

  backend:
    build:
      context: ./backend
    ports:
      - "8000:8000"
    environment:
      - API_KEY=${API_KEY}
      - BASE_URL=${BASE_URL}
      - STORAGE_ROOT=/app/storage
      - APPIUM_URL=http://appium:4723
    volumes:
      - ./storage:/app/storage
    depends_on:
      - appium
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
    depends_on:
      - backend
    restart: unless-stopped
```

Deploy:
```bash
docker-compose up -d
```

### Environment Variables for Production

```bash
# Production .env
API_KEY=your_production_api_key
BASE_URL=https://airouter.stage.in/v1
STORAGE_ROOT=/data/storage
APPIUM_URL=http://appium:4723
PORT=8000
CORS_ORIGINS=https://yourdomain.com
```

---

## API Endpoints Reference

### Build Management
- `POST /api/builds/upload` - Upload APK
- `GET /api/builds` - List builds
- `GET /api/builds/{build_id}` - Get build details
- `DELETE /api/builds/{build_id}` - Delete build

### Test Case Management
- `POST /api/test-cases` - Save test case
- `GET /api/test-cases` - List test cases
- `GET /api/test-cases/{tc_id}` - Get test case
- `PUT /api/test-cases/{tc_id}` - Update test case
- `DELETE /api/test-cases/{tc_id}` - Delete test case

### Device Management
- `GET /api/devices` - List devices
- `GET /api/devices/{device_id}` - Get device info

### Test Execution
- `POST /api/test-runs` - Start execution
- `GET /api/test-runs/{run_id}` - Get run status/results
- `GET /api/test-runs/{run_id}/logs` - Get logs
- `POST /api/test-runs/{run_id}/cancel` - Cancel run
- `GET /api/builds/{build_id}/test-runs` - List runs for build

### Element Inspection
- `POST /api/inspect-elements` - Inspect screen elements

### Scheduler
- `POST /api/schedules` - Schedule test run
- `GET /api/schedules` - List schedules
- `DELETE /api/schedules/{schedule_id}` - Delete schedule

---

## Common Issues & Solutions

### Issue: "No devices found"

**Solution:**
```bash
# Restart ADB server
adb kill-server
adb start-server

# Check devices
adb devices
```

### Issue: "Appium connection refused"

**Solution:**
```bash
# Check if Appium container is running
docker ps | grep appium

# Restart Appium
docker restart appium-server

# Check logs
docker logs appium-server
```

### Issue: "Test execution hangs"

**Solution:**
- Check device is still connected: `adb devices`
- Check Appium logs: `docker logs appium-server`
- Verify app is installed: `adb shell pm list packages | grep your.package`
- Restart device/emulator

### Issue: "AI translation fails"

**Solution:**
- Verify API_KEY is valid
- Check BASE_URL is correct
- Test API directly:
  ```bash
  curl -H "Authorization: Bearer $API_KEY" \
       -H "Content-Type: application/json" \
       -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "test"}]}' \
       $BASE_URL/chat/completions
  ```

### Issue: "Frontend cannot connect to backend"

**Solution:**
- Verify backend is running: `curl http://localhost:8000/health`
- Check CORS settings in backend `.env`
- Check NEXT_PUBLIC_API_URL in frontend `.env.local`
- Clear browser cache and restart frontend

---

## Performance Optimization

### Backend
- Increase worker processes for uvicorn:
  ```bash
  uvicorn app.main:app --workers 4
  ```

### Appium
- Use persistent sessions for faster test execution
- Cache element locations in ElementMapRepository

### Storage
- Implement cleanup policy for old test runs:
  ```python
  # Delete runs older than 30 days
  # Add to scheduled task
  ```

---

## Security Considerations

### Production Checklist

- [ ] Change default API keys
- [ ] Enable HTTPS (use reverse proxy like nginx)
- [ ] Implement authentication (JWT tokens)
- [ ] Restrict CORS origins to production domains
- [ ] Set up firewall rules (allow only necessary ports)
- [ ] Regular security updates for dependencies
- [ ] Encrypt sensitive data in storage
- [ ] Implement rate limiting on API endpoints
- [ ] Use secrets management (HashiCorp Vault, AWS Secrets Manager)

---

## Monitoring & Logging

### Backend Logs
```bash
# View real-time logs
tail -f backend.log

# Search for errors
grep ERROR backend.log
```

### Appium Logs
```bash
# Real-time Appium logs
docker logs -f appium-server
```

### Test Run Logs
- Stored in: `storage/test-runs/{run_id}/logs.txt`
- Accessible via API: `GET /api/test-runs/{run_id}/logs`

---

## Backup & Recovery

### Backup Storage Directory
```bash
# Create backup
tar -czf storage-backup-$(date +%Y%m%d).tar.gz storage/

# Restore from backup
tar -xzf storage-backup-20261210.tar.gz
```

### Database Migration (Future)
When migrating to PostgreSQL:
1. Export filesystem data to JSON
2. Create database schema
3. Import data using migration script
4. Update repository implementations
5. Test thoroughly before switching

---

## Support & Resources

- **Documentation**: See `README.md` in project root
- **Issues**: Report bugs on GitHub/Jira
- **Appium Docs**: http://appium.io/docs/en/
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **Next.js Docs**: https://nextjs.org/docs

---

## Changelog

- **v1.0.0** (2026-03-10) - Initial release
  - APK upload and management
  - AI-powered test case generation
  - Appium-based test execution
  - Element inspection
  - Test scheduling
  - Results viewer with screenshots and logs
