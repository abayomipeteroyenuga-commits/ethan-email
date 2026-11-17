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
## Ethan mailbox request notifications
Set `MAILBOX_ADMIN_EMAIL` (or use `BOOTSTRAP_ADMIN_EMAIL`) to choose the administrator who receives new mailbox-request alerts. Email alerts require a valid `RESEND_API_KEY` and a sender identity in `EMAIL_FROM` on a verified Resend domain. Requests are always saved to Neon and remain visible in **Administration → Mailbox requests**, even when the alert cannot be sent.

Assigning a Resend address reserves it in Ethan Email; it does not by itself prove that external email delivery works. Configure and test the Resend sending domain and incoming webhook before telling users that sending and receiving are ready.
