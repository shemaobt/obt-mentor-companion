#!/bin/bash
# Script to set up GitHub secrets for OBT Mentor Companion deployment
# Run this after Terraform apply completes

set -e

echo "🔐 Setting up GitHub secrets for OBT Mentor Companion..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Install it with: brew install gh"
    echo "Then authenticate with: gh auth login"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI."
    echo "Run: gh auth login"
    exit 1
fi

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="$PROJECT_ROOT/tf/environments/obt-prod"
export PATH="/opt/homebrew/opt/tfenv/bin:$PATH"

# Get Terraform outputs
cd "$TF_DIR"
echo "📋 Getting Terraform outputs..."
WORKLOAD_IDENTITY_PROVIDER=$(terraform output -raw workload_identity_provider 2>/dev/null || echo "")
GITHUB_SERVICE_ACCOUNT=$(terraform output -raw github_service_account_email 2>/dev/null || echo "")
SESSION_SECRET=$(terraform output -raw session_secret 2>/dev/null || echo "")
BACKEND_URL=$(terraform output -raw backend_service_url 2>/dev/null || echo "")

if [ -z "$WORKLOAD_IDENTITY_PROVIDER" ] || [ -z "$GITHUB_SERVICE_ACCOUNT" ]; then
    echo "❌ Terraform outputs not found. Please run 'terraform apply' first."
    exit 1
fi

# Read secrets from .env file
cd "$SCRIPT_DIR"
if [ ! -f .env ]; then
    echo "❌ .env file not found in obt-mentor-companion directory"
    exit 1
fi

source .env

# Set GitHub secrets
echo "🔑 Setting GitHub secrets..."

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
gh secret set GOOGLE_API_KEY --body "${GEMINI_API_KEY:-$GOOGLE_API_KEY}"
gh secret set SESSION_SECRET --body "${SESSION_SECRET:-$SESSION_SECRET}"

# QDRANT (required)
if [ -n "$QDRANT_URL" ]; then
    gh secret set QDRANT_URL --body "$QDRANT_URL"
    echo "✅ Set QDRANT_URL"
else
    echo "⚠️  QDRANT_URL not found in .env - you'll need to set this manually"
fi

if [ -n "$QDRANT_API_KEY" ]; then
    gh secret set QDRANT_API_KEY --body "$QDRANT_API_KEY"
    echo "✅ Set QDRANT_API_KEY"
else
    echo "⚠️  QDRANT_API_KEY not found in .env - you'll need to set this manually"
fi

# Replit OIDC (optional)
if [ -n "$REPLIT_OIDC_CLIENT_ID" ]; then
    gh secret set REPLIT_OIDC_CLIENT_ID --body "$REPLIT_OIDC_CLIENT_ID"
fi

if [ -n "$REPLIT_OIDC_CLIENT_SECRET" ]; then
    gh secret set REPLIT_OIDC_CLIENT_SECRET --body "$REPLIT_OIDC_CLIENT_SECRET"
fi

# Frontend API URL (will be set after first deployment)
if [ -n "$BACKEND_URL" ]; then
    gh secret set FRONTEND_API_URL --body "$BACKEND_URL"
else
    echo "⚠️  Backend URL not available yet - set FRONTEND_API_URL after first deployment"
fi

echo ""
echo "✅ GitHub secrets configured!"
echo ""
echo "📝 Next steps:"
echo "1. If QDRANT_URL/QDRANT_API_KEY are missing, add them manually:"
echo "   gh secret set QDRANT_URL --body 'your-qdrant-url'"
echo "   gh secret set QDRANT_API_KEY --body 'your-qdrant-key'"
echo ""
echo "2. After first deployment, update FRONTEND_API_URL with the backend URL"
echo ""
echo "3. Push to main branch to trigger deployment:"
echo "   git push origin main"

