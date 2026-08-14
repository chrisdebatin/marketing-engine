import Link from "next/link";
import { Inbox, Mail } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  connectedAccount,
  inboxMails,
  outlookConfigured,
  type OutlookMail,
} from "@/lib/outlook";
import { splitPdlEmails } from "@/lib/pdl";
import type { Hub } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

function formatMailDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Postfach: liest den Posteingang des verbundenen Outlook-Kontos und hebt
 * Anfragen der Standorte (Absender = hinterlegte PDL-Adressen) hervor.
 */
export default async function PostfachPage() {
  await requireSession();

  if (!outlookConfigured()) {
    return (
      <Shell>
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Outlook ist noch nicht eingerichtet: App-Registrierung im
          Microsoft-365-Portal anlegen und <code>MS_CLIENT_ID</code>/
          <code>MS_CLIENT_SECRET</code> als Env-Variablen setzen (siehe
          .env.example). Danach im{" "}
          <Link href="/admin" className="text-primary underline">
            Admin
          </Link>{" "}
          das Konto verbinden.
        </p>
      </Shell>
    );
  }

  const account = await connectedAccount();
  if (!account) {
    return (
      <Shell>
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Noch kein Konto verbunden.{" "}
          <a
            href="/api/outlook/connect"
            className="font-medium text-primary underline"
          >
            Jetzt mit Microsoft anmelden
          </a>
        </p>
      </Shell>
    );
  }

  const admin = createAdminClient();
  const [{ data: hubRows }, mails] = await Promise.all([
    admin.from("hubs").select("*"),
    inboxMails(50),
  ]);

  // PDL-Adresse → Hub-Name, um Standort-Anfragen zu markieren.
  const hubByEmail = new Map<string, string>();
  for (const h of (hubRows ?? []) as Hub[]) {
    for (const e of splitPdlEmails(h.pdl_email)) {
      hubByEmail.set(e.toLowerCase(), h.name);
    }
  }

  if (mails === null) {
    return (
      <Shell account={account}>
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Postfach konnte nicht geladen werden — bitte im{" "}
          <Link href="/admin" className="text-primary underline">
            Admin
          </Link>{" "}
          das Konto neu verbinden.
        </p>
      </Shell>
    );
  }

  const standortMails = mails.filter((m) => hubByEmail.has(m.fromAddress));
  const otherMails = mails.filter((m) => !hubByEmail.has(m.fromAddress));

  return (
    <Shell account={account}>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">
          Anfragen der Standorte ({standortMails.length})
        </h2>
        {standortMails.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Mails von hinterlegten PDL-Adressen im Posteingang (letzte 50
            Mails geprüft).
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {standortMails.map((m) => (
              <MailRow key={m.id} mail={m} hub={hubByEmail.get(m.fromAddress)} />
            ))}
          </ul>
        )}
      </section>

      <details className="group">
        <summary className="cursor-pointer list-none text-sm font-semibold select-none">
          Weitere Mails im Posteingang ({otherMails.length})
          <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
            aufklappen
          </span>
        </summary>
        <ul className="mt-2 flex flex-col gap-2">
          {otherMails.map((m) => (
            <MailRow key={m.id} mail={m} />
          ))}
        </ul>
      </details>
    </Shell>
  );
}

function Shell({
  account,
  children,
}: {
  account?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8">
      <PageHeader
        icon={Inbox}
        title="Postfach"
        description={
          account
            ? `Posteingang von ${account} — Anfragen der Standorte zuerst.`
            : "Anfragen der Standorte per Outlook auslesen."
        }
      />
      {children}
    </main>
  );
}

function MailRow({ mail, hub }: { mail: OutlookMail; hub?: string }) {
  return (
    <li>
      <a
        href={mail.webLink || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col gap-0.5 rounded-xl border bg-card p-3.5 shadow-sm transition-colors hover:bg-accent/40"
      >
        <span className="flex flex-wrap items-center gap-2">
          <Mail
            className={`size-3.5 shrink-0 ${mail.isRead ? "text-muted-foreground" : "text-primary"}`}
          />
          <span
            className={`min-w-0 flex-1 truncate text-sm ${mail.isRead ? "" : "font-semibold"}`}
          >
            {mail.subject}
          </span>
          {hub && <Badge variant="secondary">{hub}</Badge>}
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatMailDate(mail.receivedAt)}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {mail.from} · {mail.preview}
        </span>
      </a>
    </li>
  );
}
