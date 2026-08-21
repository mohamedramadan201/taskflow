# TaskFlow

TaskFlow is a multi-workspace task-management application built with Next.js 16, Prisma 7, PostgreSQL, Auth.js, and Supabase.

## Features

- Secure credentials authentication and workspace roles: Owner, Admin, Member, and Viewer.
- Kanban, list, and calendar views with filtering and drag-and-drop status updates.
- Task details, assignees, priorities, due dates, comments, checklists, and activity history.
- Recurring daily, weekly, and monthly tasks.
- Workspace invitations, membership management, and workspace switching.
- In-app reminders, optional email delivery, and per-user notification preferences.
- Workspace reports covering completion, overdue work, priority, workload, and CSV export.
- A metadata-only Gmail inbox with sender/receiver rules, configurable schedules, health monitoring, and atomic email-to-task conversion.

## Local setup with Supabase

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env`.
3. In Supabase, open **Connect > ORM > Prisma** and copy:
   - Transaction pooler URL to `DATABASE_URL`.
   - Session pooler URL to `DIRECT_URL` for migrations.
4. Replace the password placeholder in both URLs with your database password.
5. Generate the Prisma client with `pnpm db:generate`.
6. Apply migrations with `pnpm db:migrate` when working against a development database. The hosted project used by this workspace is managed through reviewed Supabase migrations.
7. Seed the demo data with `pnpm db:seed` when needed.
8. Start TaskFlow with `pnpm dev`, then open `http://localhost:3000`.

Do not commit `.env` or expose database passwords, Auth secrets, SMTP credentials, or service-role keys.

## Demo accounts

Seeded accounts use the password `Taskflow123!`:

- `owner@taskflow.local`
- `admin@taskflow.local`
- `member@taskflow.local`
- `viewer@taskflow.local`

## Reminders and email

Immediate reminders are processed during the request. Scheduled reminders are stored in TaskFlow and processed through `POST /api/reminders/process` with `Authorization: Bearer <CRON_SECRET>`, or through the authenticated Apps Script email queue when `EMAIL_DELIVERY_MODE=apps_script`.

Email delivery defaults to `log` mode and writes JSON lines to `EMAIL_DELIVERY_LOG_PATH`. Set `EMAIL_DELIVERY_MODE=smtp` and configure the SMTP variables to send through SMTP, or set `EMAIL_DELIVERY_MODE=apps_script` to queue invitations, assignments, and reminders for the central Google Apps Script.

## Gmail metadata connector

The connector uses Google Apps Script and the Gmail metadata scope. It does not request attachments, raw messages, full HTML, or message bodies.

1. Sign in as a workspace Owner or Admin and open **Email Inbox > Connections**.
2. Create a connection for the Gmail address. The generated connector token is shown only once.
3. Deploy TaskFlow at a public HTTPS URL (or use a secure HTTPS tunnel for temporary local testing). Google Apps Script cannot reach `localhost` or private network addresses. Set `TASKFLOW_PUBLIC_URL` to that public origin before generating setup values.
4. Open the supplied Google Apps Script links and copy `Code.gs` and `appsscript.json` into a new standalone script owned by that Gmail account.
5. In **Project Settings > Script Properties**, add the displayed `TASKFLOW_BASE_URL`, `TASKFLOW_CONNECTOR_ID`, and `TASKFLOW_CONNECTOR_TOKEN` values.
6. Select the no-argument `configureTaskFlow` function in the Apps Script editor, click **Run**, and approve the metadata-only permission.
7. Return to TaskFlow. The heartbeat should appear within one minute. The same trigger also processes queued TaskFlow email when Apps Script delivery is enabled.
8. Configure exact-address or domain rules for senders and receivers. Exclusion rules always win; sender and receiver inclusion groups must both match.

If the one-time token is lost or the connection must be reconfigured, use **Generate setup values** on the connection card. This rotates the connector token and invalidates the previous value.

The Apps Script trigger wakes every minute, while TaskFlow controls the effective Gmail sync interval (1, 5, 10, 15, 30, or 60 minutes). Pausing, resuming, changing the interval, and requesting **Sync now** do not require reinstalling the Google trigger. The first successful run establishes a Gmail history cursor and imports only future messages. Apps Script email delivery is scoped to the connector's workspace and uses the Google account that owns the script as the sender.

## Validation

Run:

```sh
pnpm test
pnpm lint
pnpm build
pnpm verify:email-schema
```

The production build regenerates the Prisma client automatically.
