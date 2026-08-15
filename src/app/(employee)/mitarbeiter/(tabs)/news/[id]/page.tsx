import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  getAnnouncement,
  markAnnouncementRead,
} from "@/lib/employee/announcements";
import { requireEmployee } from "@/lib/employee/auth";
import { formatAnnouncementDate } from "@/lib/employee/format";

export const dynamic = "force-dynamic";

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireEmployee();
  if (!ctx) redirect("/mitarbeiter");

  // getAnnouncement liefert Entwuerfe/archivierte Meldungen nie aus.
  const announcement = await getAnnouncement(id, ctx.staff);
  if (!announcement) notFound();

  await markAnnouncementRead(announcement.id, ctx.staffId).catch(() => {});

  const wichtig = announcement.prioritaet === "wichtig";

  return (
    <main className="pb-6">
      <header className="m-safe-top sticky top-0 z-30 flex items-center gap-1 border-b border-border bg-card px-2 py-2">
        <Link
          href="/mitarbeiter/news"
          aria-label="Zurueck"
          className="m-tap flex items-center justify-center rounded-lg text-foreground"
        >
          <ChevronLeft size={24} aria-hidden />
        </Link>
        <span className="text-[17px] font-semibold text-foreground">Meldung</span>
      </header>

      {announcement.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={announcement.image_url}
          alt=""
          decoding="async"
          className="aspect-video w-full bg-muted object-cover"
        />
      )}

      <article className="px-5 pt-5">
        {wichtig && (
          <span
            className="inline-block rounded-md px-2 py-0.5 text-[12px] font-bold"
            style={{
              background: "color-mix(in oklch, var(--m-warn) 22%, transparent)",
              color: "var(--m-warn-strong)",
            }}
          >
            Wichtig
          </span>
        )}

        <h1 className="mt-2 text-[24px] font-bold leading-tight text-foreground">
          {announcement.titel}
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {formatAnnouncementDate(announcement.publish_at)}
        </p>

        <div className="mt-5 whitespace-pre-wrap text-[17px] leading-relaxed text-foreground">
          {announcement.body}
        </div>
      </article>
    </main>
  );
}
