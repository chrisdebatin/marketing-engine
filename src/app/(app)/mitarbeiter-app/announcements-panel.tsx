import { formatShortDate } from "@/lib/employee/format";
import type { Announcement } from "@/lib/types";
import { saveAnnouncement, setAnnouncementStatus } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  published: "Veroeffentlicht",
  archived: "Archiviert",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-slate-100 text-slate-500",
};

export function AnnouncementsPanel({
  announcements,
}: {
  announcements: Announcement[];
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-[17px] font-semibold text-foreground">Meldungen</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Veroeffentlichte Meldungen erscheinen sofort in der App der
        Mitarbeitenden.
      </p>

      <form action={saveAnnouncement} className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          name="titel"
          required
          maxLength={160}
          placeholder="Titel"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm md:col-span-2"
        />
        <textarea
          name="body"
          required
          rows={4}
          placeholder="Text der Meldung"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
        />
        <input
          name="image_url"
          placeholder="Bild-URL (optional)"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm md:col-span-2"
        />
        <select
          name="prioritaet"
          defaultValue="normal"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="normal">Normal</option>
          <option value="wichtig">Wichtig</option>
        </select>
        <select
          name="status"
          defaultValue="published"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="draft">Als Entwurf speichern</option>
          <option value="published">Sofort veroeffentlichen</option>
        </select>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Meldung anlegen
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Titel</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Prioritaet</th>
              <th className="py-2 pr-3 font-medium">Datum</th>
              <th className="py-2 font-medium">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {announcements.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-muted-foreground">
                  Noch keine Meldungen angelegt.
                </td>
              </tr>
            ) : (
              announcements.map((a) => (
                <tr key={a.id} className="border-b border-border/60">
                  <td className="max-w-[280px] truncate py-2 pr-3 font-medium text-foreground">
                    {a.titel}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        STATUS_CLASS[a.status] ?? ""
                      }`}
                    >
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {a.prioritaet === "wichtig" ? (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Wichtig
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Normal</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {formatShortDate(a.publish_at)}
                  </td>
                  <td className="py-2">
                    <form action={setAnnouncementStatus} className="flex gap-2">
                      <input type="hidden" name="id" value={a.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={a.status === "published" ? "draft" : "published"}
                      />
                      <button
                        type="submit"
                        className="h-8 rounded-md border border-input px-3 text-xs font-medium"
                      >
                        {a.status === "published"
                          ? "Zurueckziehen"
                          : "Veroeffentlichen"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
