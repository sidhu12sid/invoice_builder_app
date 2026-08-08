# Invoice Generator

Form on the left, live A4 preview on the right. Save drafts, email the invoice
as a PDF, or print it. Styling is taken from `Invoice_Template.docx` — same navy
palette, Calibri, and layout.

```bash
npm run dev
```

## Getting around

A sidebar on the left switches between four sections. The chevron at its top
collapses it to an icon rail; that choice is remembered.

| Section | What it's for |
| --- | --- |
| **Create invoice** | Fill in a new invoice against the live preview |
| **Saved invoices** | Everything you've saved — preview, print, download, email |
| **Clients** | People you bill — pick one when invoicing and their details fill in |
| **My details** | Your name, address, phone, and bank/PAN details |

Fill in **My details** first: every new invoice starts pre-filled with it, so
you never retype your account number. Add a client under **Clients**, and a
"Pick a saved client" dropdown appears in the Bill To section.

Editing an invoice never writes back to the client or profile records — change
a client's address there and past invoices keep the address they were sent with.

## Where your previous invoices are

The **Saved invoices** section. Each row shows the invoice number, client,
status pill, date and total.

- **Preview** renders it on the right, with **Download PDF**, **Print** and
  **Email invoice** for that invoice.
- **Edit** loads it back into Create invoice.
- **Duplicate** copies it into a new invoice and bumps the invoice number —
  the usual monthly workflow.
- **Delete** removes it.

The list is empty until you press Save at least once. With Supabase connected
you can also see the rows in the dashboard under **Table Editor → invoices**.

Separately, whatever you're typing right now is kept as an autosaved draft, so
closing the tab by accident doesn't lose it. That's distinct from "Save draft",
which adds a row to the list.

## Storage

| Mode | When | Where invoices live |
| --- | --- | --- |
| **This browser only** | No Supabase env vars set | `localStorage` |
| **Synced** | `.env.local` filled in | Your Supabase Postgres |

The badge at the top of the form pane tells you which mode you're in.

### Drafts

Three states, shown as a pill on each saved row:

| Status | Set by |
| --- | --- |
| `draft` | **Save draft** — work in progress |
| `final` | **Save as final** — ready to send |
| `sent` | Set automatically once the email goes out, with the date and recipient |

Nothing is enforced between states — it's bookkeeping so you can tell at a
glance what's outstanding.

## Connecting Supabase

**1. Create the project.** Sign up at [supabase.com](https://supabase.com) →
**New project**. Give it a name, set a database password (save it in your
password manager — you won't need it for this app, but you can't view it again),
pick the region closest to you, and choose the Free plan. Provisioning takes a
minute or two.

**2. Create the table.** In the project, go to **SQL Editor → New query**. Open
[`supabase/schema.sql`](supabase/schema.sql), paste the whole file in, and press
**Run**. You should see "Success. No rows returned." This creates the `invoices`
table, enables row-level security, and adds the draft/final/sent columns. The
file is idempotent, so re-run it any time the app adds columns.

**3. Copy your credentials.** Go to **Settings → API Keys**.

- **Project URL** — looks like `https://abcdefgh.supabase.co`. It's on that page
  and in the **Connect** dialog. Not the `supabase.com/dashboard/...` address in
  your browser bar.
- **Publishable key** — starts with `sb_publishable_`. If there isn't one yet,
  click **Create new API keys**.

Do *not* use a secret key (`sb_secret_...`) or `service_role`. Those bypass
row-level security, and anything in a `NEXT_PUBLIC_` variable is shipped to the
browser.

**4. Configure the project.** Copy `.env.local.example` to `.env.local` in the
project root and fill in the two values:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
```

**5. Verify before running the app:**

```bash
npm run check:supabase
```

This checks the URL format, catches a secret key pasted by mistake, confirms the
table exists, and confirms RLS is actually blocking anonymous reads. Fix
anything it reports before moving on.

**6. Turn off email confirmation** (optional, recommended for a single-user
tool). **Authentication → Sign In / Providers → Email**, switch off **Confirm
email**. Otherwise you'll need to click a link in your inbox before the first
sign-in.

**7. Start the app.** `npm run dev`, then use **Create one** on the sign-in
screen to make your account. Save an invoice, then check **Table Editor →
invoices** in the dashboard — your row should be there.

Restart the dev server after any `.env.local` change; Next.js only reads it at
startup.

### Why there's a login

An invoice here carries your account number, IFSC and PAN. The publishable key
is public by design — it ships to the browser — so the only thing between that
key and your data is the RLS policy in `schema.sql`, which scopes every row to
`auth.uid()`. Don't disable it. `npm run check:supabase` verifies it's on.

### If something goes wrong

| Symptom | Cause |
| --- | --- |
| Sign-in screen never appears, badge says "This browser only" | `.env.local` missing or not picked up — restart the dev server |
| `relation "public.invoices" does not exist` | Step 2 wasn't run, or was run on a different project |
| `Invalid API key` | Key belongs to another project, or was truncated when copied |
| Sign-up succeeds but sign-in fails | Email confirmation is on — check your inbox, or turn it off in step 6 |
| Saved invoices vanish after a week away | The free-plan pause below — resume the project in the dashboard |

### The free-plan pause

Supabase pauses free projects after **7 days with no API requests**. Data is
retained, but you resume manually from the dashboard. Since invoicing is
monthly, expect to meet this most times you use the app. Either live with it
(one click), ping the project weekly to keep it awake, or move to a Postgres
that wakes on connection, e.g. Neon — only `lib/supabase.ts` and `lib/store.ts`
would change.

## Emailing invoices

**Email invoice** builds a PDF from the preview, opens a dialog with the
recipient, subject and message prefilled from the invoice, and sends it as an
attachment. Nothing is sent until you press **Send invoice**.

### Choosing a provider

Three are supported. Whichever key is present is the one used; set
`EMAIL_PROVIDER` to force the choice if several are. All settings are
server-side — never prefix them `NEXT_PUBLIC_`, or the credentials end up in
the browser bundle. Restart (or redeploy) after changing them.

| | Free tier | Setup | Good for |
| --- | --- | --- | --- |
| **Resend** | 3,000/mo, 100/day | Verify a **domain** via DNS | The default choice if you can add DNS records |
| **Brevo** | 300/day | Verify a **single address** — no DNS | When you don't control the domain's DNS |
| **SMTP** | n/a | Host, port, user, password | Existing mailbox; being retired by Microsoft |

On serverless, the HTTP providers are the better fit: no socket to hold open, no
cold-start handshake, and nothing that breaks when basic auth goes away.

**The catch that decides it:** Resend will not send to arbitrary recipients
until you verify a domain — the shared `onboarding@resend.dev` sender can only
email the address you signed up with. Fine for testing, useless for invoicing
clients. If you can add DNS records for your domain, Resend is the better
product. If you can't, Brevo lets you verify one sender address by clicking a
link in your inbox.

Brevo's free plan reportedly appends its branding to outgoing mail. Send
yourself a test before using it for client-facing invoices.

#### Option A — Resend

**1. Sign up** at [resend.com](https://resend.com).

**2. Add your domain.** **Domains → Add Domain**, enter it, pick the region
closest to you. Resend then shows a set of DNS records — typically an `MX` and
an SPF `TXT` on a `send.` subdomain, plus a DKIM `TXT` at
`resend._domainkey`. Add them **exactly as shown** in your DNS provider; the
values are specific to your account and region, so don't copy them from a
tutorial.

A note on hosts: some DNS panels want the name relative (`send`) and some want
it absolute (`send.yourdomain.com`). If verification fails, a duplicated domain
suffix in the record name is the usual reason.

**3. Verify.** Press **Verify** in Resend. Propagation is usually a few minutes;
it can take longer. The domain must reach status `verified` — until then you can
only email the address you signed up with.

**4. Create an API key.** **API Keys → Create API Key**. **Sending access** is
enough; it doesn't need full permissions.

**5. Configure.** In `.env.local`:

```
MAIL_FROM=Your Name <invoices@yourdomain.com>
RESEND_API_KEY=re_xxxxxxxx
```

`MAIL_FROM` must be on the verified domain. The mailbox part (`invoices@`)
doesn't need to exist as a real inbox — but use a real one if you want replies.
Set it to something clients can reply to, or add a `Reply-To` later.

**6. Check it**, before trusting it with a client invoice:

```bash
npm run check:email
```

That confirms the key is accepted, your domain is present in the account, and
its status is actually `verified`. Then send a real one to yourself:

```bash
npm run check:email -- --send you@yourdomain.com
```

This goes through `lib/mailer.ts` — the same code path the app uses — so a pass
means the app will send too. Check the spam folder as well as the inbox; a
brand-new sending domain has no reputation yet.

**7. Deploying?** Add `MAIL_FROM` and `RESEND_API_KEY` to the Vercel project's
environment variables and redeploy.

#### Option B — Brevo

1. Sign up at [brevo.com](https://www.brevo.com).
2. **Senders, Domains & Dedicated IPs → Senders → Add a Sender**. Confirm the
   address from the email they send you. No DNS needed.
3. **SMTP & API → API Keys → Generate a new API key**.

```
MAIL_FROM=Your Name <you@yourcompany.com>
BREVO_API_KEY=xkeysib-xxxxxxxx
```

`MAIL_FROM` must be the address you verified.

#### Option C — SMTP

```
MAIL_FROM=you@yourcompany.com
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=you@yourcompany.com
SMTP_PASS=your-app-password
```

Works on Vercel — only outbound port 25 is blocked, so 587 is fine.

### Outlook / Microsoft 365 — read this first

Which account you have decides whether SMTP works at all:

**Microsoft 365 work or school account** (`you@yourcompany.com`) — works today:

| Setting | Value |
| --- | --- |
| Host | `smtp.office365.com` |
| Port | `587` (STARTTLS — leave `SMTP_SECURE` unset) |
| User | your full email address |
| Pass | an app password, or your password if MFA is off |

Two things have to be true on the tenant, both admin-controlled:

1. **SMTP AUTH enabled for the mailbox** — Microsoft 365 admin centre → Users →
   your user → Mail → Manage email apps → tick *Authenticated SMTP*. It is off
   by default on newer tenants.
2. **App password available** — requires MFA (security defaults) to be on, at
   [My Security Info](https://mysignins.microsoft.com/security-info) → Add
   sign-in method → App password. If the option is missing, your admin has
   disabled app passwords and you'll need them to enable it or use a different
   sender.

**Personal outlook.com / hotmail.com / live.com** — effectively dead. Microsoft
now requires OAuth2 for personal mailboxes, app passwords have been withdrawn,
and accounts created in 2025–26 can't use SMTP AUTH at all. Use one of the
alternatives below.

### This has a deadline

Microsoft is retiring basic authentication for SMTP AUTH. **End of December
2026** it is disabled by default on existing tenants (an admin can re-enable it
for a while), and unavailable on new tenants. Final removal is expected to be
announced during the second half of 2027. App passwords go away with it, since
they *are* basic auth.

So SMTP via Outlook is a working answer with a shelf life of a few months, not
a permanent one. When it stops working, delete the `SMTP_*` variables and set
`RESEND_API_KEY` or `BREVO_API_KEY` instead — no code changes.

The remaining alternative, if mail *must* originate from the Outlook mailbox
itself, is OAuth2 against Microsoft Graph. That needs an Entra app registration
and a token flow in `lib/mailer.ts`. Considerably more work; only worth it for
that specific constraint.

### About the PDF

The PDF is a rasterised capture of the preview, so it matches what you see
exactly and there's only one layout to maintain — but the text isn't
selectable. Roughly 200 KB per page. If you need a vector PDF with selectable
text, use **Print → Save as PDF** instead.

## Layout

| Path | Purpose |
| --- | --- |
| `lib/invoice.ts` | Invoice type, defaults, totals, number formatting |
| `lib/store.ts` | Save/list/delete + status — Supabase or localStorage |
| `lib/clients.ts` | Client records |
| `lib/profile.ts` | Your own details, one row per user |
| `components/Sidebar.tsx` | Three-section navigation |
| `components/ClientsView.tsx` | Client list and editor |
| `components/ProfileView.tsx` | "My details" form |
| `lib/supabase.ts` | Client, and the "is it configured" check |
| `lib/pdf.ts` | Preview → PDF |
| `lib/mailer.ts` | Resend / Brevo / SMTP, chosen by env vars |
| `scripts/check-email.mts` | `npm run check:email` — config + live test send |
| `scripts/check-supabase.mjs` | `npm run check:supabase` — DB and RLS check |
| `app/api/send-invoice/route.ts` | Auth check, validation, send |
| `components/InvoiceApp.tsx` | State, session, autosave, toolbar |
| `components/InvoiceForm.tsx` | The inputs |
| `components/InvoicePreview.tsx` | The A4 sheet |
| `components/SavedList.tsx` | Saved-invoice sidebar |
| `components/SendDialog.tsx` | Email composer |
| `components/AuthPanel.tsx` | Sign in / sign up |
| `app/globals.css` | Template styling and print rules |

## How authentication works

Supabase Auth, email + password. No OAuth, no magic links.

| Step | Where |
| --- | --- |
| Sign up / sign in | `components/AuthPanel.tsx` → `auth.signUp()` / `auth.signInWithPassword()` |
| Session stored | `localStorage`, by supabase-js (`persistSession: true`) |
| Token refresh | Automatic (`autoRefreshToken: true`) |
| React state | `InvoiceApp` reads `auth.getSession()` on mount, subscribes to `onAuthStateChange` |
| Signed out | `<AuthPanel />` renders instead of the app |

**The sign-in screen is UX, not the security boundary.** The page is public
static HTML; the gate only decides what to render. The real boundary is Postgres:

- Every query from the browser carries the user's JWT.
- The RLS policy `using (auth.uid() = user_id)` filters rows to that user, so
  the publishable key alone returns nothing.
- `with check (auth.uid() = user_id)` stops anyone writing rows owned by
  someone else.

The one server-side check is `/api/send-invoice`. The browser sends
`Authorization: Bearer <access_token>`; the route calls `auth.getUser(token)`,
which validates it against the Auth server. Without that, the route would be an
open mail relay for anyone who found the URL.

With no Supabase env vars there is no auth at all — localStorage mode, and the
send route has nothing to verify against. Fine locally, not fine on a public URL.

### Known gaps

- **No password reset UI.** `resetPasswordForEmail` isn't wired up; if you
  forget the password, reset it from **Authentication → Users** in the
  dashboard.
- **Sessions live in `localStorage`**, so any XSS on the page could read them.
  The Next-idiomatic upgrade is `@supabase/ssr` with httpOnly cookies, which
  also enables server-rendered protected pages and middleware. Worth doing if
  this ever becomes multi-user or public-facing.

## Deploying to Vercel

**1. Push to GitHub.** Vercel deploys from a repo.

```bash
git init && git add -A && git commit -m "Invoice generator"
```

Create an empty repo on GitHub and push. `.env.local` is gitignored — check that
`git status` doesn't list it before you push.

**2. Import the project.** At [vercel.com/new](https://vercel.com/new), pick the
repo. Framework preset, build command and output directory are all detected —
leave them alone. Don't deploy yet.

**3. Add environment variables** before the first build, under
**Environment Variables**:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| `MAIL_FROM` | `Your Name <invoices@yourdomain.com>` |
| `RESEND_API_KEY` | `re_...` (or `BREVO_API_KEY`, or the `SMTP_*` set) |

Apply them to Production, Preview and Development.

**`NEXT_PUBLIC_` variables are inlined at build time**, not read at runtime.
Changing one later means triggering a **redeploy** — restarting won't do it.
This is the single most common way to get a deployment that mysteriously
ignores your new key.

**4. Deploy**, then open the URL and sign in.

**5. Point Supabase at the deployed URL.** In Supabase, **Authentication → URL
Configuration**, set **Site URL** to your Vercel domain. Confirmation and
password-reset links are built from it — left as `localhost:3000` they'll send
your users to a dead address.

### Things that bite on Vercel

**SMTP works, but HTTP is better here.** Vercel blocks outbound port 25 only, so
587 is fine — despite a lot of blog posts claiming otherwise. That said, Resend
or Brevo avoid the socket entirely, which suits short-lived functions better and
sidesteps the Microsoft deprecation.

**4.5 MB request body cap.** The PDF is ~200 KB per page, so a normal invoice is
nowhere near it. The route rejects anything over 3 MB with a readable message
rather than letting the platform return an opaque 413.

**Free-plan Supabase pausing** still applies, and now it pauses your deployed
app too, not just local use.

**Nothing is written to the filesystem**, so the read-only runtime is a
non-issue.
