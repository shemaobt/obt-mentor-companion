#!/bin/bash
# Check which GitHub secrets are set and which are missing

echo "🔍 Checking GitHub Secrets for OBT Mentor Companion..."
echo ""

REQUIRED_SECRETS=(
  "GCP_PROJECT_ID"
  "GCP_WORKLOAD_IDENTITY_PROVIDER"
  "GCP_WORKLOAD_IDENTITY_SERVICE_ACCOUNT"
  "ARTIFACT_REGISTRY_REGION"
  "ARTIFACT_REGISTRY_REPOSITORY"
  "BACKEND_IMAGE_NAME"
  "FRONTEND_IMAGE_NAME"
  "CLOUD_RUN_REGION"
  "CLOUD_RUN_BACKEND_SERVICE"
  "CLOUD_RUN_FRONTEND_SERVICE"
  "FRONTEND_API_URL"
  "NEON_DATABASE_URL"
  "GOOGLE_API_KEY"
  "QDRANT_URL"
  "QDRANT_API_KEY"
  "SESSION_SECRET"
)

OPTIONAL_SECRETS=(
  "REPLIT_OIDC_CLIENT_ID"
  "REPLIT_OIDC_CLIENT_SECRET"
)

if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI."
    echo "Run: gh auth login"
    exit 1
fi

echo "📋 Required Secrets:"
MISSING_REQUIRED=()
for secret in "${REQUIRED_SECRETS[@]}"; do
    if gh secret list | grep -q "^${secret}\s"; then
        echo "  ✅ $secret"
    else
        echo "  ❌ $secret (MISSING)"
        MISSING_REQUIRED+=("$secret")
    fi
done

echo ""
echo "📋 Optional Secrets:"
for secret in "${OPTIONAL_SECRETS[@]}"; do
    if gh secret list | grep -q "^${secret}\s"; then
        echo "  ✅ $secret"
    else
        echo "  ⚠️  $secret (optional, not set)"
    fi
done

echo ""
if [ ${#MISSING_REQUIRED[@]} -eq 0 ]; then
    echo "✅ All required secrets are set!"
    echo ""
    echo "🚀 Ready to deploy! Push to main branch:"
    echo "   git push origin main"
else
    echo "❌ Missing ${#MISSING_REQUIRED[@]} required secret(s):"
    for secret in "${MISSING_REQUIRED[@]}"; do
        echo "   - $secret"
    done
    echo ""
    echo "Run ./setup-github-secrets.sh to set them automatically"
fi

