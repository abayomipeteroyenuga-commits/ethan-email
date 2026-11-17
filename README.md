# Ethan Email

Ethan Email is the email application for Ethan Digital Academy.

## Production
- Production URL: https://email.ethandigitalacademy.org
- Runtime: Express on Vercel
- Database: Neon Postgres
- Mail transport: per-account SMTP/IMAP settings

## Account registration
Users can register with any valid email address and a password of at least 10 characters. New accounts are approved automatically while public registration is open. An `@ethandigitalacademy.org` mailbox address is requested separately from the account sign-in email.

## Deployment
Vercel builds this repository from its root. Keep the Email homepage, Email client, API server and supporting assets together. The Ethan Kids website is maintained in its separate `Ethan-Kids` repository and Vercel project.

Never commit environment secrets. Production requires `DATABASE_URL`, `SESSION_SECRET`, `MAIL_CREDENTIALS_KEY`, `REGISTRATION_MODE`, `EMAIL_DOMAIN`, and `BOOTSTRAP_ADMIN_EMAIL`. Password-reset delivery and Resend provisioning also require a valid `RESEND_API_KEY`.
