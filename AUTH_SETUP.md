# Authentication setup

The application uses Supabase Auth for password hashing and email verification.
It never stores passwords or OTPs in a public table. Supabase manages the OTP
hash, expiration, single-use verification, and authentication rate limits.

## Required setup

1. Run `supabase/schema.sql` for a new database, then run
   `supabase/auth-migration.sql` in the Supabase SQL Editor. The migration creates
   `public.users`, backfills existing Auth users, installs the signup/confirmation
   trigger, and adds restrictive active-account policies to the existing tables.
2. Keep **Confirm email** enabled in Supabase Authentication → Providers → Email.
   Set Email OTP expiration to **600 seconds** (10 minutes), and the minimum
   password length to **12**. Configure Auth SMTP for reliable delivery; the app's
   invoice SMTP settings do not configure Supabase Auth email delivery.
3. Replace Authentication → Email Templates → Confirm signup with
   `supabase/confirmation-email.html`. It includes `{{ .Token }}` so users can
   enter the code on `/verify-email`. Set the subject to “Verify your email”.
4. Set `AUTH_SESSION_SECRET` on every deployment to a stable 64-character hex
   value generated with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   Keep it server-only. A local secret has been added to the ignored `.env.local`.
   Rotating this key signs everybody out. Restart the server after changing it.

## Flow and session behavior

`/signup` collects first name, last name, email and matching passwords. Supabase
sends the verification code. `/verify-email` verifies it, revokes the temporary
verification session, and redirects to `/login?verified=1`. Password login then
redirects to `/` (the invoice page).

Remember me uses an encrypted, authenticated HttpOnly cookie with an absolute
45-day expiry. Refreshing an access token does not extend that deadline.
Without Remember me, the cookie has no persistent expiry and the server enforces
a 12-hour maximum. Browsers that restore sessions may restore session cookies.
Supabase revocation or shorter project session limits may end a session earlier.

Refresh tokens are never returned to browser JavaScript. Short-lived access
tokens are obtained in memory from `/api/auth/session` for existing direct
Supabase data queries. All session responses disable caching. Cookies are Secure
in production; authentication and mail mutations check the request Origin.
Invoice access is checked on startup and each minute; database RLS enforces
ownership and active account status. Drafts are keyed by account ID. Older
unscoped browser drafts remain untouched and are not loaded into signed-in accounts.

## Forgot password

No additional database migration is required. In Supabase Authentication →
Email Templates → Reset password, paste `supabase/reset-password-email.html`
and save. This replaces the old numeric-code email with a verification link:

```html
<a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}">Verify email and reset password</a>
```

In Authentication → URL Configuration, add the exact reset URLs to Redirect URLs:
`http://localhost:3000/reset-password` for local development and
`https://YOUR-DOMAIN/reset-password` for production. Set Site URL to your app's
base URL. Supabase must allow the redirect supplied by the application so the
email points at the correct page. Keep Auth SMTP configured for delivery.

The sign-in page links to `/forgot-password`. Submitting the email stays on that
page and shows a generic confirmation, with a 60-second resend cooldown. It does
not create an account. The user clicks the emailed verification link, which opens
`/reset-password`. The link credential is removed from browser history and
verified server-side with `type: recovery`. Only then are the new-password fields
shown. Invalid, expired and already-used links offer a new-link request.

A dedicated encrypted HttpOnly recovery cookie permits password reset for ten
minutes and never authorizes invoice access. Saving validates matching passwords
of 12–128 characters, checks the recovery session against Supabase, updates the
password, clears the cookies and redirects to `/login?passwordReset=1`.
A failed password policy check lets the user retry within the original deadline.
Global signout is requested after saving; existing access JWTs can remain valid
until expiry. Password recovery does not reactivate disabled accounts.

Run `npm run test:auth` for session and recovery tests. After changing the email
template and redirect allowlist, use an existing account you control to test
email delivery, link verification, new-password login, expired links and resend.
No real-account password was changed during automated testing.

## User fields

`public.users`: `id`, `first_name`, `last_name`, `created_at`, `updated_at`, `is_active`.
`auth.users`: Supabase-managed email, password hash, confirmation and token data.
The application role can only read its own public user row. Only the database
administrator can deactivate accounts; clients cannot reactivate themselves.
Names are copied from signup metadata when the account is created.

## Verification checklist

- New signup creates an inactive user; wrong/expired codes cannot activate it.
- Successful verification activates the account and shows the login page.
- Unverified, wrong-password and inactive logins fail.
- A verified login opens invoices; refresh and a second browser session behave
  according to Remember me; logout clears the cookie and revokes the session.
- User A cannot read User B's records or recovered drafts.
- Deactivate a user in SQL and verify direct database reads/writes are denied.
- Verify resend, delivery and OTP expiry with an inbox you control.

The live project was checked: email/password auth is enabled, email confirmation
is enabled, and `public.users` was absent. Only a publishable API key is available
locally, which cannot execute SQL or update Auth email templates. Those dashboard
steps must be completed before login is usable with this migration.
