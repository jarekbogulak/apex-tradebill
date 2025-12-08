# Cloud Run Deployment Plan

This guide outlines the steps to deploy the `apex-tradebill-api` to Google Cloud Run.

## Prerequisites

1.  **Google Cloud SDK**: Ensure `gcloud` is installed and authenticated.
2.  **Project Selection**: Ensure you are working against the correct project: `apex-tradebill-api-479611`.
3.  **Secrets**:
    *   Run the helper script to create the required Secret Manager resources:
        ```bash
        ./apps/api/create_secrets.sh
        ```
    *   **Important**: The script only creates the secret *containers*. You must manually add the secret *versions* (values) for each secret created.
        ```bash
        # Example:
        echo -n "super-secret-value" | gcloud secrets versions add apex-tradebill-prod-JWT_SECRET --data-file=-
        ```
    *   **Secret catalog**:
        - Dynamic Omni (GSM, read at runtime): `apex-omni-trading-api-key`, `apex-omni-trading-client-secret`, `apex-omni-trading-api-passphrase`, `apex-omni-webhook-shared-secret`, `apex-omni-zk-signing-seed`.
        - Env-injected (GSM env vars for bootstrapping): `apex-tradebill-prod-SUPABASE_DB_URL`, `apex-tradebill-prod-JWT_SECRET`, `apex-tradebill-prod-OMNI_BREAKGLASS_PRIVATE_KEY`, `apex-tradebill-prod-OMNI_BREAKGLASS_PUBLIC_KEY`.
    *   **Database Seeding**: After deploying and running migrations, you must run the seed script to populate the `omni_secret_metadata` table, which maps internal secret types to these GSM IDs.
        ```bash
        # Run this against the production database (e.g., via Cloud SQL Proxy)
        npm run db:seed:omni-secrets
        ```

## Deployment Steps

### 1. Authenticate and Set Project

```bash
gcloud auth login
gcloud config set project apex-tradebill-api-479611
```

### 2. Build the Container Image

The `Dockerfile` is located in `apps/api/Dockerfile`, but it requires the **monorepo root** as the build context to copy shared packages and workspace configuration.

Run this command from the **root** of your repository:

```bash
gcloud builds submit --tag gcr.io/apex-tradebill-api-479611/apex-tradebill-api:latest --file apps/api/Dockerfile .
```

> **Note**: This command submits the build to Cloud Build. It will upload your source code, build the image, and push it to Google Container Registry (GCR).

### 3. Deploy to Cloud Run

Once the image is built and pushed, deploy the service using the `service.yaml` configuration.

Run this command from the **root** of your repository:

```bash
gcloud run services replace apps/api/service.yaml
```

### 4. Verify Deployment

After deployment, check the status:

```bash
gcloud run services describe apex-tradebill-api-prod --region us-central1
```

You can also view logs to ensure the application started correctly and successfully fetched secrets:

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=apex-tradebill-api-prod" --limit 20
```
