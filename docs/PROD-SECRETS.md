# Production Secrets & Deployment Steps

_Last updated: 5 Oct 2025_

## Why this document exists
VendAI POS depends on several third-party services (payments, credit scoring, Firebase admin access). This guide consolidates every production-only secret, how to provision it, and where it must be stored so that new deployments ship with a hardened baseline.

## Secrets inventory

| Area | Variable(s) | Source of truth | Notes |
| --- | --- | --- | --- |
| M-Pesa Daraja | `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORT_CODE`, `MPESA_ENV` | Safaricom Developer Portal (production app) | `MPESA_ENV` must be `production`; Passkey comes from Lipa na M-PESA online setup. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → API keys / Webhooks | Webhook secret should match the production endpoint configured in Stripe. |
| Flutterwave | `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_SECRET_KEY` | Flutterwave Dashboard → Settings → API | Keep both keys in sync; public key is required by the client when initiating charges. |
| Credit Engine | `CREDIT_ENGINE_API_URL`, `CREDIT_ENGINE_API_KEY` | Credit platform admin console | URL should point to production cluster (e.g. `https://credit.vendai.africa/api`). |
| Firebase Admin | `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Console → Project Settings → Service accounts → Generate new private key | Store the private key exactly as delivered (wrap in quotes and keep newline escapes). |

The same variable names are present in [`.env.example`](../.env.example) for local parity.

## Where to store these secrets

### Vercel (Next.js app)
1. Open the VendAI POS Vercel project.
2. Navigate to **Settings → Environment Variables**.
3. Add each secret above under the **Production** environment.
4. For multiline `FIREBASE_ADMIN_PRIVATE_KEY`, paste the value as a single line with `\n` escapes (example already shown in `.env.example`).
5. Trigger a redeploy or use "Redeploy with existing build" once values are saved.

### Firebase Functions (background workers)
1. Authenticate with the production Firebase project:  
   `firebase login` *(one time)*.
2. Set each secret using `firebase functions:config:set`:
   ```bash
   firebase functions:config:set \
     mpesa.consumer_key="$MPESA_CONSUMER_KEY" \
     mpesa.consumer_secret="$MPESA_CONSUMER_SECRET" \
     mpesa.passkey="$MPESA_PASSKEY" \
     mpesa.short_code="$MPESA_SHORT_CODE" \
     stripe.secret_key="$STRIPE_SECRET_KEY" \
     stripe.webhook_secret="$STRIPE_WEBHOOK_SECRET" \
     flutterwave.public_key="$FLUTTERWAVE_PUBLIC_KEY" \
     flutterwave.secret_key="$FLUTTERWAVE_SECRET_KEY" \
     credit.api_url="$CREDIT_ENGINE_API_URL" \
     credit.api_key="$CREDIT_ENGINE_API_KEY" \
     firebase.admin_project_id="$FIREBASE_ADMIN_PROJECT_ID" \
     firebase.admin_client_email="$FIREBASE_ADMIN_CLIENT_EMAIL" \
     firebase.admin_private_key="$FIREBASE_ADMIN_PRIVATE_KEY"
   ```
3. Deploy function configs: `firebase deploy --only functions:config`.
4. Verify with `firebase functions:config:get` before promoting the release.

### GitHub Actions / Task runners (optional)
If CI pipelines need to call Firebase or payment providers directly, mirror the same variables inside the GitHub repository secrets. Prefix environment-specific copies (e.g. `PROD_MPESA_CONSUMER_KEY`).

## Deployment checklist
- [ ] Secrets updated in Vercel Production environment.
- [ ] `firebase functions:config:set` executed and verified.
- [ ] `firebase deploy --only functions` run after config changes.
- [ ] Deployment notes added to `PRODUCTION-CHECKLIST.md` (owner + date).

## Rotation & auditing
- Rotate payment provider credentials every 90 days (align with provider policy).
- Store rotation dates and contacts in the internal password manager.
- Re-run the deployment checklist after each rotation.
- Revoke old Firebase service account keys immediately after generating replacements.

## Appendix: quick verification commands
```bash
# Confirm secrets visible in Cloud Functions runtime
firebase functions:config:get | jq

# Confirm Vercel envs (requires Vercel CLI login)
vercel env ls production
```

Document owner: **Platform Engineering** (update this file whenever credentials change or new services are added).
