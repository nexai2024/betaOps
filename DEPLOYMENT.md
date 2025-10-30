# BetaOps Deployment Guide

Complete guide for deploying BetaOps to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Database Setup](#database-setup)
4. [GitHub App Configuration](#github-app-configuration)
5. [AI Provider Setup](#ai-provider-setup)
6. [Deployment Options](#deployment-options)
7. [Environment Variables](#environment-variables)
8. [Post-Deployment](#post-deployment)

---

## Prerequisites

- **Node.js**: v18 or later
- **pnpm/npm**: Latest version
- **PostgreSQL**: v14 or later
- **GitHub Account**: For OAuth and GitHub App
- **AI Provider API Key**: OpenAI, Anthropic, or local model setup

## Local Development

### 1. Clone and Install

```bash
git clone https://github.com/your-org/betaops.git
cd betaops
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [Environment Variables](#environment-variables))

### 3. Database Setup

#### Using Docker (Recommended for Local Dev)

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Alternatively, use docker directly
docker run --name betaops-postgres \
  -e POSTGRES_PASSWORD=betaops \
  -e POSTGRES_DB=betaops \
  -p 5432:5432 \
  -d postgres:15
```

#### Using Local PostgreSQL

```bash
# Create database
createdb betaops
createdb betaops_shadow  # For migrations
```

### 4. Run Migrations and Seed

```bash
# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed sample data
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and sign in with:
- **Email**: `alice@betaops.dev`
- **Password**: `password123`

---

## Database Setup

### Production Database Options

#### Option 1: Neon (Serverless Postgres)

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy connection string to `DATABASE_URL`
4. Neon handles connection pooling automatically

```env
DATABASE_URL="postgresql://user:password@ep-cool-grass-123456.us-east-2.aws.neon.tech/betaops?sslmode=require"
```

#### Option 2: PlanetScale (Serverless MySQL-Compatible)

1. Sign up at [planetscale.com](https://planetscale.com)
2. Create database
3. Get connection string
4. Update `schema.prisma` to use `mysql` provider

```env
DATABASE_URL="mysql://user:password@aws.connect.psdb.cloud/betaops?sslaccept=strict"
```

#### Option 3: Supabase

1. Sign up at [supabase.com](https://supabase.com)
2. Create project
3. Get Postgres connection string

```env
DATABASE_URL="postgresql://postgres:password@db.project.supabase.co:5432/postgres"
```

### Database Migrations

```bash
# Development - auto-apply migrations
npm run db:migrate

# Production - generate migration
npx prisma migrate deploy
```

---

## GitHub App Configuration

BetaOps requires a GitHub App for repository integration.

### 1. Create GitHub App

1. Go to GitHub Settings → Developer Settings → GitHub Apps → **New GitHub App**

2. **App Name**: `BetaOps` (or your preferred name)

3. **Homepage URL**: `https://your-domain.com`

4. **Webhook URL**: `https://your-domain.com/api/github/webhook`

5. **Webhook Secret**: Generate a random secret
   ```bash
   openssl rand -hex 20
   ```

6. **Permissions**:
   - Repository permissions:
     - Contents: Read
     - Issues: Read & Write
     - Pull requests: Read & Write
     - Checks: Read & Write
     - Metadata: Read
   - Organization permissions: None

7. **Subscribe to events**:
   - Push
   - Pull request
   - Issues

8. **Where can this GitHub App be installed?**: Any account

9. Click **Create GitHub App**

### 2. Generate Private Key

1. In your new GitHub App settings
2. Scroll to "Private keys"
3. Click "Generate a private key"
4. Download the `.pem` file
5. Convert to single-line format for `.env`:
   ```bash
   awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' your-app.pem
   ```

### 3. Get App ID

- Copy the **App ID** from your GitHub App settings

### 4. Install App

1. In GitHub App settings, click "Install App"
2. Choose account/organization
3. Select repositories (All or specific)
4. Copy the **Installation ID** from URL: `https://github.com/settings/installations/{installation_id}`

### 5. Configure OAuth (for user login)

1. In GitHub Settings → Developer Settings → OAuth Apps → **New OAuth App**
2. **Application name**: `BetaOps Login`
3. **Homepage URL**: `https://your-domain.com`
4. **Authorization callback URL**: `https://your-domain.com/api/auth/callback/github`
5. Create app and copy **Client ID** and **Client Secret**

### 6. Update Environment Variables

```env
GITHUB_APP_ID="123456"
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMII...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET="your-webhook-secret"
GITHUB_CLIENT_ID="your-oauth-client-id"
GITHUB_CLIENT_SECRET="your-oauth-client-secret"
```

---

## AI Provider Setup

### Option 1: OpenAI

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Create API key
3. Configure:

```env
AI_PROVIDER="openai"
AI_API_KEY="sk-..."
AI_DEFAULT_MODEL="gpt-4-turbo-preview"
```

**Costs**: ~$0.01-0.03 per test case generation

### Option 2: Anthropic Claude

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Create API key
3. Configure:

```env
AI_PROVIDER="anthropic"
AI_API_KEY="sk-ant-..."
AI_DEFAULT_MODEL="claude-3-sonnet-20240229"
```

### Option 3: Local Models (Ollama)

1. Install Ollama: `curl https://ollama.ai/install.sh | sh`
2. Pull model: `ollama pull llama2`
3. Start server: `ollama serve`
4. Configure:

```env
AI_PROVIDER="local"
AI_BASE_URL="http://localhost:11434"
AI_DEFAULT_MODEL="llama2"
```

**Pros**: No API costs, data privacy
**Cons**: Requires GPU, slower, lower quality

---

## Deployment Options

### Option 1: Vercel (Recommended)

Best for Next.js, automatic scaling, edge functions.

#### Setup

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login:
   ```bash
   vercel login
   ```

3. Link project:
   ```bash
   vercel link
   ```

4. Set environment variables:
   ```bash
   vercel env add DATABASE_URL
   vercel env add NEXTAUTH_SECRET
   vercel env add GITHUB_APP_ID
   # ... add all required env vars
   ```

5. Deploy:
   ```bash
   vercel --prod
   ```

#### Automatic Deployments

1. Push to GitHub
2. Import project in Vercel dashboard
3. Configure environment variables
4. Auto-deploy on push to `main`

### Option 2: Railway

Simple deployment, managed Postgres included.

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Create project
railway init

# Add Postgres
railway add postgresql

# Deploy
railway up
```

### Option 3: Fly.io

Full control, multiple regions, managed Postgres.

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app
fly launch

# Create Postgres
fly postgres create

# Attach to app
fly postgres attach betaops-db

# Deploy
fly deploy
```

### Option 4: Docker Self-Hosted

#### Create `docker-compose.yml`

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://betaops:password@db:5432/betaops
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - GITHUB_APP_ID=${GITHUB_APP_ID}
    depends_on:
      - db
    
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: betaops
      POSTGRES_USER: betaops
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

#### Deploy

```bash
docker-compose up -d
```

---

## Environment Variables

### Required

```env
# Database
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_SECRET="random-secret-32-chars"
NEXTAUTH_URL="https://your-domain.com"

# GitHub
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
GITHUB_APP_ID="..."
GITHUB_APP_PRIVATE_KEY="..."
GITHUB_WEBHOOK_SECRET="..."

# AI Provider
AI_PROVIDER="openai"
AI_API_KEY="..."
```

### Optional

```env
# Email
SMTP_HOST="..."
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."

# File Storage
AWS_S3_BUCKET="..."
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."

# Observability
SENTRY_DSN="..."
OTEL_EXPORTER_OTLP_ENDPOINT="..."

# Notifications
SLACK_WEBHOOK_URL="..."
```

---

## Post-Deployment

### 1. Run Migrations

```bash
npx prisma migrate deploy
```

### 2. Create Admin User

Access the app and sign up, or use Prisma Studio:

```bash
npx prisma studio
```

### 3. Configure GitHub Webhook

1. In GitHub App settings
2. Verify webhook URL: `https://your-domain.com/api/github/webhook`
3. Test webhook delivery
4. Check webhook logs in app

### 4. Install GitHub App

1. Navigate to your GitHub App
2. Install on target organization/repositories
3. In BetaOps, create a project and connect the repository

### 5. Verify Integrations

- [ ] GitHub webhook receives push events
- [ ] AI provider generates test cases
- [ ] Database queries are fast (< 100ms)
- [ ] File uploads work (if configured)
- [ ] Email notifications send (if configured)

### 6. Set Up Monitoring

#### Sentry

```bash
npx @sentry/wizard@latest -i nextjs
```

#### Vercel Analytics

Already included via `@vercel/analytics`

### 7. Configure Custom Domain

#### Vercel

```bash
vercel domains add your-domain.com
```

#### Others

- Update DNS A/CNAME records
- Configure SSL certificate
- Update `NEXTAUTH_URL` environment variable

---

## Infrastructure as Code

### Terraform Example (AWS)

```hcl
# main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# RDS PostgreSQL
resource "aws_db_instance" "betaops" {
  identifier        = "betaops-db"
  engine            = "postgres"
  engine_version    = "15"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  
  db_name  = "betaops"
  username = var.db_username
  password = var.db_password
  
  skip_final_snapshot = true
}

# S3 for attachments
resource "aws_s3_bucket" "attachments" {
  bucket = "betaops-attachments"
}

# Outputs
output "database_url" {
  value     = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.betaops.endpoint}/betaops"
  sensitive = true
}
```

Apply:
```bash
terraform init
terraform plan
terraform apply
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL

# Check connection pool
# Add ?connection_limit=10 to DATABASE_URL

# Enable query logging
DATABASE_URL="...?sslmode=require&connection_limit=5"
```

### GitHub Webhook Not Working

1. Check webhook secret matches `.env`
2. Verify webhook URL is publicly accessible
3. Check GitHub webhook delivery logs
4. Test with: `curl -X POST https://your-domain.com/api/github/webhook`

### AI Generation Failures

1. Verify API key is valid
2. Check API quota/rate limits
3. Test with: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $AI_API_KEY"`
4. Review error logs for specific errors

### Performance Issues

1. Add database indexes:
   ```sql
   CREATE INDEX idx_project_members ON "ProjectMember"("projectId", "userId");
   CREATE INDEX idx_test_cycles ON "TestCycle"("projectId", "status");
   ```

2. Enable database connection pooling
3. Use Redis for session storage (optional)

---

## Security Checklist

- [ ] Strong `NEXTAUTH_SECRET` (32+ characters)
- [ ] Secure GitHub webhook secret
- [ ] Database uses SSL (`?sslmode=require`)
- [ ] API keys stored in environment variables, not code
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] CSP headers set
- [ ] Regular dependency updates
- [ ] Audit logs enabled for compliance projects

---

## Scaling Considerations

### Database

- **Connection Pooling**: Use PgBouncer or Prisma Data Proxy
- **Read Replicas**: For analytics queries
- **Indexes**: Add for common query patterns

### Application

- **Caching**: Redis for session storage and frequent queries
- **Background Jobs**: Use Queue system (Bull, BullMQ) for AI generation
- **CDN**: CloudFlare or Vercel for static assets

### File Storage

- **Direct Uploads**: Pre-signed URLs to S3
- **Image Optimization**: Use Next.js Image Optimization
- **CDN**: CloudFront for S3 objects

---

## Maintenance

### Backups

```bash
# Database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20240101.sql
```

### Updates

```bash
# Update dependencies
npm update

# Check for security vulnerabilities
npm audit

# Update Prisma
npx prisma migrate dev
```

### Monitoring

- Database query performance (Prisma slow query log)
- API response times (Sentry performance)
- Error rates (Sentry)
- User activity (Analytics)

---

## Support

- **Documentation**: https://betaops.dev/docs
- **GitHub Issues**: https://github.com/your-org/betaops/issues
- **Discord**: https://discord.gg/betaops
- **Email**: support@betaops.dev

---

**Last Updated**: 2025-10-30
**Version**: 1.0.0
