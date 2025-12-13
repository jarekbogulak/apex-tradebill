#!/bin/bash
set -e

# Function to create a secret if it doesn't exist
create_secret() {
    local secret_id=$1
    local labels=$2
    
    echo "Creating secret: $secret_id"
    
    # Check if secret exists
    if gcloud secrets describe "$secret_id" >/dev/null 2>&1; then
        echo "  Secret $secret_id already exists. Skipping."
    else
        gcloud secrets create "$secret_id" \
            --replication-policy="automatic" \
            --labels="$labels"
        echo "  Successfully created $secret_id"
    fi
}

echo "Checking gcloud configuration..."
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "Error: No GCP project selected. Please run 'gcloud config set project YOUR_PROJECT_ID' first."
    exit 1
fi
echo "Using project: $PROJECT_ID"
echo ""

# 1. Dynamic Omni Secrets
echo "--- Creating Dynamic Omni Secrets ---"
create_secret "apex-omni-trading-api-key" "managed-by=omni-secrets,owner=security-engineering"
create_secret "apex-omni-trading-client-secret" "managed-by=omni-secrets,owner=security-engineering"
create_secret "apex-omni-trading-api-passphrase" "managed-by=omni-secrets,owner=security-engineering"
create_secret "apex-omni-webhook-shared-secret" "managed-by=omni-secrets,owner=platform-reliability"
create_secret "apex-omni-zk-signing-seed" "managed-by=omni-secrets,owner=security-engineering"

# 2. Environment Secrets
echo ""
echo "--- Creating Environment Secrets ---"
# SUPABASE_DB_URL must stay as a GSM env var so the DB pool can bootstrap before Omni Secrets loads
create_secret "apex-tradebill-prod-SUPABASE_DB_URL" "managed-by=env-vars"
create_secret "apex-tradebill-prod-JWT_SECRET" "managed-by=env-vars"
create_secret "apex-tradebill-prod-DEVICE_ACTIVATION_SECRET" "managed-by=env-vars"
create_secret "apex-tradebill-prod-OMNI_BREAKGLASS_PRIVATE_KEY" "managed-by=env-vars"
create_secret "apex-tradebill-prod-OMNI_BREAKGLASS_PUBLIC_KEY" "managed-by=env-vars"

echo ""
echo "All secret resources created (or already existed)."
echo "Next steps: Add secret versions using 'gcloud secrets versions add SECRET_ID --data-file=-'"
