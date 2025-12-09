# OBT Mentor Companion - Deployment Setup Guide

## Current Status

✅ **Completed:**
- Terraform configuration ready
- GitHub Actions workflow configured
- Dockerfiles ready
- Setup scripts created

⏳ **Needs Manual Steps:**
1. Google Cloud authentication
2. Terraform apply
3. GitHub secrets setup
4. QDRANT credentials (if not in .env)

## Quick Setup Steps

### 1. Authenticate with Google Cloud

```bash
gcloud auth application-default login
gcloud config set project gen-lang-client-0886209230
```

### 2. Apply Terraform Infrastructure

```bash
cd /Users/lucas/Desktop/shemaobt/tf/environments/obt-prod
export PATH="/opt/homebrew/opt/tfenv/bin:$PATH"

# Apply with secrets from .env
TF_VAR_backend_database_url="postgresql://neondb_owner:***REMOVED***@ep-bitter-tree-aent8cr7.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require" \
TF_VAR_google_api_key="***REMOVED***" \
TF_VAR_qdrant_url="YOUR_QDRANT_URL" \
TF_VAR_qdrant_api_key="YOUR_QDRANT_API_KEY" \
terraform apply -var-file=obt-prod.tfvars
```

**Note:** Replace `YOUR_QDRANT_URL` and `YOUR_QDRANT_API_KEY` with your actual Qdrant credentials.

### 3. Set Up GitHub Secrets

After Terraform apply completes, run:

```bash
cd /Users/lucas/Desktop/shemaobt/obt-mentor-companion
./setup-github-secrets.sh
```

Or manually set secrets via GitHub web UI:
- Go to: https://github.com/shemaobt/obt-mentor-companion/settings/secrets/actions

### 4. Required GitHub Secrets

| Secret Name | Value Source |
|------------|--------------|
| `GCP_PROJECT_ID` | `gen-lang-client-0886209230` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | From `terraform output workload_identity_provider` |
| `GCP_WORKLOAD_IDENTITY_SERVICE_ACCOUNT` | From `terraform output github_service_account_email` |
| `ARTIFACT_REGISTRY_REGION` | `us-central1` |
| `ARTIFACT_REGISTRY_REPOSITORY` | `obt-mentor-app` |
| `BACKEND_IMAGE_NAME` | `backend` |
| `FRONTEND_IMAGE_NAME` | `frontend` |
| `CLOUD_RUN_REGION` | `us-central1` |
| `CLOUD_RUN_BACKEND_SERVICE` | `obt-mentor-backend` |
| `CLOUD_RUN_FRONTEND_SERVICE` | `obt-mentor-frontend` |
| `NEON_DATABASE_URL` | From your `.env` file |
| `GOOGLE_API_KEY` | From your `.env` file (GEMINI_API_KEY) |
| `SESSION_SECRET` | From `terraform output session_secret` |
| `QDRANT_URL` | **NEEDED** - Your Qdrant cluster URL |
| `QDRANT_API_KEY` | **NEEDED** - Your Qdrant API key |
| `FRONTEND_API_URL` | Backend URL (set after first deployment) |

### 5. Deploy

Once all secrets are set:

```bash
git add .
git commit -m "Setup deployment configuration"
git push origin main
```

GitHub Actions will automatically:
1. Build Docker images
2. Push to Artifact Registry
3. Deploy to Cloud Run
4. Configure environment variables

## Missing Secrets

You need to provide:

1. **QDRANT_URL** - Your Qdrant Cloud cluster URL
   - Format: `https://your-cluster.qdrant.io`
   - Get it from: https://cloud.qdrant.io

2. **QDRANT_API_KEY** - Your Qdrant API key
   - Get it from your Qdrant Cloud dashboard

## Troubleshooting

### Terraform Authentication Error
```bash
gcloud auth application-default login
```

### GitHub CLI Not Authenticated
```bash
brew install gh
gh auth login
```

### Check Terraform Outputs
```bash
cd /Users/lucas/Desktop/shemaobt/tf/environments/obt-prod
export PATH="/opt/homebrew/opt/tfenv/bin:$PATH"
terraform output
```

## Next Steps After Deployment

1. **Update FRONTEND_API_URL** secret with the backend URL from Cloud Run
2. **Run database migrations** if needed:
   ```bash
   npm run db:push
   ```
3. **Access the application** at the Cloud Run frontend URL

