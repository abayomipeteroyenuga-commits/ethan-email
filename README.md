# ETHAN EMAIL — Phase 4 Spaceship/Spacemail Edition

This build replaces the Hostinger-specific provisioning integration with a Spaceship **Spacemail** integration model for `ethandigitalacademy.org`.

## Included
- Multi-user Ethan Email app accounts
- PostgreSQL-backed users and sessions
- Encrypted per-user mailbox credentials
- Real IMAP inbox loading
- Real SMTP sending
- Spaceship Spacemail presets built into Mailbox Settings
- Admin mailbox directory to register/link existing Spacemail addresses to Ethan Email users
- PWA support and responsive UI

## Spacemail connection used
- IMAP host: `mail.spacemail.com`
- IMAP port: `993`
- IMAP security: SSL/TLS
- SMTP host: `mail.spacemail.com`
- SMTP port: `465`
- SMTP security: SSL/TLS
- Username: the full mailbox address, e.g. `support@ethandigitalacademy.org`
- Password: that mailbox's Spacemail password

## Important limitation
Spaceship publicly documents IMAP/SMTP/POP3 access, but this build does **not** assume an undocumented mailbox-provisioning API. Create/delete actual mailboxes in Spaceship → Spacemail Manager. The Ethan Email Admin screen registers and links existing Spacemail mailboxes inside the app only.

## Vercel / hosting environment variables
Add these server-side variables: `DATABASE_URL`, `DATABASE_SSL`, `SESSION_SECRET`, `MAIL_CREDENTIALS_KEY`, `EMAIL_DOMAIN`, and `REGISTRATION_MODE`. There are **no Hostinger variables** in this edition.

## DNS
If `ethandigitalacademy.org` uses Spaceship nameservers, Spacemail normally adds its mail DNS records automatically. If DNS is hosted elsewhere, configure Spacemail MX/SPF/DKIM/DMARC records in that DNS provider.
