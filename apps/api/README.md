# Apex TradeBill API – Environment Setup

1. Copy the example environment file:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```
2. Update the values as needed:
   - `SUPABASE_DB_URL` → connection string for your Supabase or PostgreSQL instance.
   - `APEX_TRADEBILL_JWT_SECRET` (and optional issuer/audience) → secret used to verify client JWTs.
   - `APEX_OMNI_*` → credentials and endpoints for the ApeX Omni REST/WebSocket APIs.

These variables are consumed by the Fastify server during startup. Credentials are ignored by Git (`.env` is listed in `.gitignore`), so store real values only in the copied `.env` file.
