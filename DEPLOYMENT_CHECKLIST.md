# Deployment Checklist

Complete guide for deploying the AI QA Automation Platform to production.

---

## Pre-Deployment

### Local Testing
- [ ] Backend runs successfully on http://localhost:8000
- [ ] Frontend runs successfully on http://localhost:3000
- [ ] Health check endpoint works: `curl http://localhost:8000/health`
- [ ] Sample PRD generates test cases successfully
- [ ] Test case quality meets 70%+ target
- [ ] Export to JSON works
- [ ] Export to CSV works
- [ ] All error states display properly

### Code Review
- [ ] No hardcoded API keys in code
- [ ] Environment variables properly configured
- [ ] No console.log statements in production code
- [ ] Error handling implemented for all API calls
- [ ] CORS configured with correct origins

---

## Backend Deployment (Railway)

### Step 1: Prepare Repository
```bash
cd /Users/prakashkumar/qa-automation-platform
git init
git add .
git commit -m "Initial commit: AI QA Automation Platform MVP"
```

### Step 2: Push to GitHub
```bash
# Create new repo on GitHub: qa-automation-platform
git remote add origin https://github.com/YOUR_USERNAME/qa-automation-platform.git
git push -u origin main
```

### Step 3: Deploy to Railway

1. **Create Railway Account**
   - Visit https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `qa-automation-platform` repository
   - Select `backend` directory as root

3. **Configure Environment Variables**
   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   CORS_ORIGINS=https://your-frontend.vercel.app
   PORT=8000
   ```

4. **Configure Build Settings**
   - Root Directory: `/backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Note the Railway URL (e.g., `https://qa-automation-api.up.railway.app`)

6. **Verify Deployment**
   ```bash
   curl https://qa-automation-api.up.railway.app/health
   ```

### Railway Checklist
- [ ] Railway account created
- [ ] Repository connected
- [ ] Environment variables configured
- [ ] Build settings configured
- [ ] Deployment successful
- [ ] Health check endpoint works
- [ ] Backend URL noted for frontend config

---

## Frontend Deployment (Vercel)

### Step 1: Install Vercel CLI (Optional)
```bash
npm install -g vercel
```

### Step 2: Deploy via Vercel Dashboard

1. **Create Vercel Account**
   - Visit https://vercel.com
   - Sign up with GitHub

2. **Import Project**
   - Click "Add New" → "Project"
   - Import `qa-automation-platform` repository
   - Select `frontend` directory as root

3. **Configure Project**
   - Framework Preset: Next.js
   - Root Directory: `frontend`
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

4. **Configure Environment Variables**
   ```
   NEXT_PUBLIC_API_URL=https://qa-automation-api.up.railway.app
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Note the Vercel URL (e.g., `https://qa-automation-platform.vercel.app`)

6. **Update Backend CORS**
   - Go back to Railway
   - Update `CORS_ORIGINS` environment variable:
     ```
     CORS_ORIGINS=https://qa-automation-platform.vercel.app
     ```
   - Redeploy backend

7. **Verify Deployment**
   - Open `https://qa-automation-platform.vercel.app`
   - Upload sample PRD
   - Generate test cases
   - Verify end-to-end flow works

### Vercel Checklist
- [ ] Vercel account created
- [ ] Repository connected
- [ ] Root directory configured
- [ ] Environment variable configured
- [ ] Deployment successful
- [ ] Backend CORS updated
- [ ] End-to-end flow tested

---

## Alternative: Deploy via CLI

### Railway CLI
```bash
cd backend

# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Set environment variables
railway variables set OPENAI_API_KEY=sk-...
railway variables set CORS_ORIGINS=https://your-frontend.vercel.app

# Deploy
railway up
```

### Vercel CLI
```bash
cd frontend

# Deploy
vercel

# Follow prompts, then set environment variable:
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://qa-automation-api.up.railway.app

# Redeploy with new env var
vercel --prod
```

---

## Post-Deployment

### Testing
- [ ] Test with sample PRD on production
- [ ] Test with PDF upload
- [ ] Test with DOCX upload
- [ ] Test with Markdown upload
- [ ] Test export to JSON
- [ ] Test export to CSV
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices

### Monitoring
- [ ] Check Railway logs for errors
- [ ] Check Vercel logs for errors
- [ ] Monitor OpenAI API usage
- [ ] Monitor response times

### Documentation Updates
- [ ] Update README with production URLs
- [ ] Update QUICK_START with production info
- [ ] Document any deployment issues encountered

---

## Troubleshooting

### Backend Issues

**Deployment fails:**
- Check requirements.txt has all dependencies
- Verify Python version compatibility
- Check Railway logs for errors

**CORS errors:**
- Verify CORS_ORIGINS includes frontend URL
- Check for trailing slashes in URLs
- Redeploy backend after changing env vars

**OpenAI API errors:**
- Verify API key is valid
- Check OpenAI account has credits
- Monitor rate limits

### Frontend Issues

**Build fails:**
- Check for TypeScript errors
- Verify all dependencies in package.json
- Check Vercel logs for details

**API connection fails:**
- Verify NEXT_PUBLIC_API_URL is correct
- Check backend is running
- Test backend health endpoint directly

**Environment variable not working:**
- Redeploy after adding env vars
- Use NEXT_PUBLIC_ prefix for client-side vars
- Check spelling of environment variable

---

## Rollback Plan

### If Deployment Fails

**Backend:**
```bash
# Via Railway dashboard:
1. Go to Deployments
2. Click on previous successful deployment
3. Click "Redeploy"
```

**Frontend:**
```bash
# Via Vercel dashboard:
1. Go to Deployments
2. Click on previous successful deployment
3. Click "Promote to Production"
```

---

## Production URLs

After deployment, update these:

**Backend API:**
```
https://qa-automation-api.up.railway.app
```

**Frontend App:**
```
https://qa-automation-platform.vercel.app
```

**API Documentation:**
```
https://qa-automation-api.up.railway.app/docs
```

---

## Security Checklist

- [ ] No API keys in frontend code
- [ ] CORS properly configured
- [ ] HTTPS enabled on both services
- [ ] Environment variables not exposed
- [ ] File upload size limit enforced (10MB)
- [ ] Rate limiting considered for production use

---

## Cost Monitoring

### Railway
- Monitor usage at https://railway.app/account/usage
- Free tier: $5 credit/month
- Upgrade if needed

### Vercel
- Monitor usage at https://vercel.com/account/usage
- Free tier: 100GB bandwidth/month
- Upgrade if needed

### OpenAI
- Monitor usage at https://platform.openai.com/usage
- Estimated cost: $0.02 per generation
- Set spending limits to avoid surprises

---

## Next Steps After Deployment

1. **Share with QA Team**
   - Provide production URL
   - Share sample PRDs for testing
   - Collect feedback on quality

2. **Measure Success**
   - Track usage metrics
   - Measure quality (Good/Needs Edit/Useless ratio)
   - Document pain points

3. **Decide on Next Phase**
   - If 70%+ quality → proceed to full build
   - If 50-70% → iterate on prompts
   - If < 50% → reassess approach

---

**Deployment Checklist Complete!**

Ready to ship? Follow these steps in order and you'll be live in ~30 minutes.
