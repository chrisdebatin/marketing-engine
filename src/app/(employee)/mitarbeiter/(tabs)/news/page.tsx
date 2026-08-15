import Link from "next/link";
import { redirect } from "next/navigation";
import { Newspaper } from "lucide-react";
import { MEmpty } from "@/components/m/m-states";
import { listAnnouncements } from "@/lib/employee/announcements";
import { requireEmployee } from "@/lib/employee/auth";
import { formatAnnouncementDate } from "@/lib/employee/format";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const ctx = await requireEmployee();
  if (!ctx) redirect("/mitarbeiter");

  const announcements = await listAnnouncements(ctx.staff, 30).catch(() => []);

  return (
    <main className="px-4 pt-5">
      <h1 className="m-safe-top mb-5 px-1 text-[24px] font-bold text-foreground">
        Meldungen
      </h1>

      {announcements.length === 0 ? (
        <MEmpty
          icon={<Newspaper size={48} aria-hidden />}
          title="Noch keine Meldungen"
          body="Sobald es Neuigkeiten gibt, findest du sie hier."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {announcements.map((a) => {
            const wichtig = a.prioritaet === "wichtig";
            return (
              <li key={a.id}>
                <Link
                  href={`/mitarbeiter/news/${a.id}`}
                  className="block overflow-hidden rounded-xl border border-border bg-card"
                  style={
                    wichtig
                      ? {
                          borderLeftWidth: 4,
                          borderLeftColor: "var(--m-warn)",
                          background:
                            "color-mix(in oklch, var(--m-warn) 8%, var(--card))",
                        }
                      : undefined
                  }
                >
                  {a.image_url && (
                    // Bewusst kein next/image: haelt die Mitarbeiter-App frei
                    // vom Vercel-Image-Optimizer (wichtig fuer Capacitor).
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.image_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="aspect-video w-full bg-muted object-cover"
                    />
                  )}

                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      {wichtig && (
                        <span
                          className="rounded-md px-2 py-0.5 text-[12px] font-bold"
                          style={{
                            background:
                              "color-mix(in oklch, var(--m-warn) 22%, transparent)",
                            color: "var(--m-warn-strong)",
                          }}
                        >
                          Wichtig
                        </span>
                      )}
                      {!a.gelesen && (
                        <>
                          <span
                            aria-hidden
                            className="size-2 rounded-full bg-primary"
                          />
                          <span className="sr-only">Ungelesen</span>
                        </>
                      )}
                    </div>

                    <h2 className="mt-2 line-clamp-2 text-[18px] font-semibold leading-snug text-foreground">
                      {a.titel}
                    </h2>
                    <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">
                      {a.body}
                    </p>
                    <p className="mt-2 text-[13px] text-muted-foreground">
                      {formatAnnouncementDate(a.publish_at)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
