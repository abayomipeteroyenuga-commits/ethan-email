ETHAN EMAIL — VERCEL PRODUCTION

Production site: https://email.ethandigitalacademy.org
Repository: abayomipeteroyenuga-commits/ethan-email
Production branch: main
Framework/runtime: Express / Node.js

Deploy from the repository root. Keep server.js, db.js, package.json, lib/, index.html, app.js, style.css, ethan-polish.css, install.js, manifest.webmanifest, sw.js, assets/ and icons/ in this application.

Required production environment:
- DATABASE_URL
- SESSION_SECRET (at least 32 characters)
- MAIL_CREDENTIALS_KEY
- REGISTRATION_MODE=open
- EMAIL_DOMAIN=ethandigitalacademy.org (used for native Ethan mailbox addresses, not account sign-in email validation)
- BOOTSTRAP_ADMIN_EMAIL

Optional mail features:
- RESEND_API_KEY for password-reset email and Resend provisioning
- EMAIL_FROM for the sender identity

The separate Ethan Kids website is deployed from its own Ethan-Kids repository. Do not point email.ethandigitalacademy.org to the Kids project or change DNS as part of this application deployment.

Do not place production secrets in Git.
