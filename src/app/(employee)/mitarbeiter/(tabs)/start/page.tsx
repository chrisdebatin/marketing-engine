import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Building2, UserPlus } from "lucide-react";
import { listAnnouncements } from "@/lib/employee/announcements";
import { requireEmployee } from "@/lib/employee/auth";
import { formatAnnouncementDate } from "@/lib/employee/format";

export const dynamic = "force-dynamic";

/**
 * Startseite. Aufbau folgt der Wichtigkeit:
 *  1. wichtigste Meldung (falls vorhanden)
 *  2. die beiden Empfehlungs-Aktionen — der eigentliche Zweck der App
 *  3. die letzten Meldungen
 */
export default async function StartPage() {
  const ctx = await requireEmployee();
  if (!ctx) redirect("/mitarbeiter");

  const announcements = await listAnnouncements(ctx.staff, 10).catch(() => []);
  const wichtig = announcements.find((a) => a.prioritaet === "wichtig");
  const rest = announcements.filter((a) => a.id !== wichtig?.id).slice(0, 3);

  return (
    <main className="px-4 pt-5">
      <header className="m-safe-top mb-6 px-1">
        <h1 className="text-[24px] font-bold text-foreground">
          Hallo, {ctx.staff.vorname}
        </h1>
      </header>

      {wichtig && (
        <Link
          href={`/mitarbeiter/news/${wichtig.id}`}
          className="mb-6 block overflow-hidden rounded-xl border-l-4 p-4"
          style={{
            borderLeftColor: "var(--m-warn)",
            background: "color-mix(in oklch, var(--m-warn) 8%, var(--card))",
          }}
        >
          <p
            className="text-[13px] font-bold uppercase tracking-wide"
            style={{ color: "var(--m-warn-strong)" }}
          >
            Wichtig
          </p>
          <p className="mt-1.5 line-clamp-2 text-[18px] font-semibold leading-snug text-foreground">
            {wichtig.titel}
          </p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {formatAnnouncementDate(wichtig.publish_at)}
          </p>
        </Link>
      )}

      <section className="mb-7">
        <h2 className="mb-3 px-1 text-[18px] font-semibold text-foreground">
          Empfehlen
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/mitarbeiter/empfehlen/kunde"
            className="flex flex-col justify-between rounded-xl border border-border bg-primary/[0.06] p-4"
            style={{ minHeight: 128 }}
          >
            <UserPlus size={26} className="text-primary" aria-hidden />
            <span className="mt-3 text-[17px] font-semibold leading-snug text-foreground">
              Kundin oder Kunden empfehlen
            </span>
          </Link>

          <Link
            href="/mitarbeiter/empfehlen/pflegedienst"
            className="flex flex-col justify-between rounded-xl border border-border bg-primary/[0.06] p-4"
            style={{ minHeight: 128 }}
          >
            <Building2 size={26} className="text-primary" aria-hidden />
            <span className="mt-3 text-[17px] font-semibold leading-snug text-foreground">
              Pflegedienst empfehlen
            </span>
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-[18px] font-semibold text-foreground">
            Neueste Meldungen
          </h2>
          <Link
            href="/mitarbeiter/news"
            className="text-[15px] font-semibold text-primary"
          >
            Alle ansehen
          </Link>
        </div>

        {rest.length === 0 ? (
          <p className="px-1 py-6 text-[15px] text-muted-foreground">
            Zurzeit gibt es keine weiteren Meldungen.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rest.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/mitarbeiter/news/${a.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
                >
                  {!a.gelesen && (
                    <>
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full bg-primary"
                      />
                      <span className="sr-only">Ungelesen</span>
                    </>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block line-clamp-2 text-[17px] font-medium leading-snug text-foreground">
                      {a.titel}
                    </span>
                    <span className="mt-1 block text-[13px] text-muted-foreground">
                      {formatAnnouncementDate(a.publish_at)}
                    </span>
                  </span>
                  <ChevronRight
                    size={20}
                    className="shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
