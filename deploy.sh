#!/bin/bash
# Complete deployment script for OBT Mentor Companion
# This script handles the full deployment process

set -e

echo "🚀 OBT Mentor Companion - Complete Deployment Setup"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    exit 1
fi

# Source .env file
source .env

# Check required variables
if [ -z "$DATABASE_URL" ] || [ -z "$GEMINI_API_KEY" ] || [ -z "$QDRANT_URL" ] || [ -z "$QDRANT_API_KEY" ]; then
    echo -e "${RED}❌ Missing required environment variables in .env${NC}"
    echo "Required: DATABASE_URL, GEMINI_API_KEY, QDRANT_URL, QDRANT_API_KEY"
    exit 1
fi

echo -e "${GREEN}✅ All required secrets found in .env${NC}"
echo ""

# Step 1: Authenticate with Google Cloud
echo "📋 Step 1: Google Cloud Authentication"
if ! gcloud auth application-default print-access-token > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Need to authenticate with Google Cloud${NC}"
    echo "Run: gcloud auth application-default login"
    echo "Then run this script again."
    exit 1
fi

gcloud config set project gen-lang-client-0886209230
echo -e "${GREEN}✅ Google Cloud authenticated${NC}"
echo ""

# Step 2: Apply Terraform
echo "📋 Step 2: Applying Terraform Infrastructure"
cd ../tf/environments/obt-prod
export PATH="/opt/homebrew/opt/tfenv/bin:$PATH"

TF_VAR_backend_database_url="$DATABASE_URL" \
TF_VAR_google_api_key="$GEMINI_API_KEY" \
TF_VAR_qdrant_url="$QDRANT_URL" \
TF_VAR_qdrant_api_key="$QDRANT_API_KEY" \
terraform apply -var-file=obt-prod.tfvars -auto-approve

echo -e "${GREEN}✅ Terraform applied successfully${NC}"
echo ""

# Step 3: Get Terraform outputs
echo "📋 Step 3: Getting Terraform Outputs"
WORKLOAD_IDENTITY_PROVIDER=$(terraform output -raw workload_identity_provider)
GITHUB_SERVICE_ACCOUNT=$(terraform output -raw github_service_account_email)
SESSION_SECRET=$(terraform output -raw session_secret)
BACKEND_URL=$(terraform output -raw backend_service_url 2>/dev/null || echo "")

echo -e "${GREEN}✅ Terraform outputs retrieved${NC}"
echo ""

# Step 4: Set up GitHub secrets
echo "📋 Step 4: Setting up GitHub Secrets"
cd ../../../obt-mentor-companion

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI (gh) is not installed.${NC}"
    echo "Install it with: brew install gh"
    echo "Then authenticate with: gh auth login"
    echo ""
    echo "Or set secrets manually via GitHub web UI:"
    echo "https://github.com/shemaobt/obt-mentor-companion/settings/secrets/actions"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated with GitHub CLI.${NC}"
    echo "Run: gh auth login"
    exit 1
fi

echo "Setting GitHub secrets..."

# GCP Configuration
gh secret set GCP_PROJECT_ID --body "gen-lang-client-0886209230"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --body "$WORKLOAD_IDENTITY_PROVIDER"
gh secret set GCP_WORKLOAD_IDENTITY_SERVICE_ACCOUNT --body "$GITHUB_SERVICE_ACCOUNT"

# Artifact Registry
gh secret set ARTIFACT_REGISTRY_REGION --body "us-central1"
gh secret set ARTIFACT_REGISTRY_REPOSITORY --body "obt-mentor-app"
gh secret set BACKEND_IMAGE_NAME --body "backend"
gh secret set FRONTEND_IMAGE_NAME --body "frontend"

# Cloud Run
gh secret set CLOUD_RUN_REGION --body "us-central1"
gh secret set CLOUD_RUN_BACKEND_SERVICE --body "obt-mentor-backend"
gh secret set CLOUD_RUN_FRONTEND_SERVICE --body "obt-mentor-frontend"

# Application Secrets
gh secret set NEON_DATABASE_URL --body "$DATABASE_URL"
gh secret set GOOGLE_API_KEY --body "$GEMINI_API_KEY"
gh secret set SESSION_SECRET --body "$SESSION_SECRET"
gh secret set QDRANT_URL --body "$QDRANT_URL"
gh secret set QDRANT_API_KEY --body "$QDRANT_API_KEY"

# Frontend API URL
if [ -n "$BACKEND_URL" ]; then
    gh secret set FRONTEND_API_URL --body "$BACKEND_URL"
    echo -e "${GREEN}✅ Set FRONTEND_API_URL to $BACKEND_URL${NC}"
else
    echo -e "${YELLOW}⚠️  Backend URL not available yet - set FRONTEND_API_URL after first deployment${NC}"
fi

echo ""
echo -e "${GREEN}✅ All GitHub secrets configured!${NC}"
echo ""

# Step 5: Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Deployment Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Push to main branch to trigger deployment:"
echo "   git push origin main"
echo ""
echo "2. Monitor deployment:"
echo "   https://github.com/shemaobt/obt-mentor-companion/actions"
echo ""
if [ -n "$BACKEND_URL" ]; then
    echo "3. Backend URL: $BACKEND_URL"
    echo "   (Check Cloud Run console for frontend URL)"
else
    echo "3. Check Cloud Run console for service URLs:"
    echo "   https://console.cloud.google.com/run?project=gen-lang-client-0886209230"
fi
echo ""
echo "4. After first deployment, update FRONTEND_API_URL if needed:"
echo "   gh secret set FRONTEND_API_URL --body 'https://your-backend-url.run.app'"
echo ""

