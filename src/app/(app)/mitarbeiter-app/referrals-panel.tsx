import { formatShortDate } from "@/lib/employee/format";
import type { ReferralWithStaff } from "@/lib/employee/admin";
import { setReferralStatus } from "./actions";

const CUSTOMER_STATUS = [
  "submitted",
  "contacted",
  "qualified",
  "converted",
  "rejected",
  "bonus_eligible",
  "bonus_paid",
];

const MA_STATUS = [
  "submitted",
  "reviewing",
  "contacted",
  "qualified",
  "negotiating",
  "acquired",
  "rejected",
  "bonus_eligible",
  "bonus_paid",
];

const LABEL: Record<string, string> = {
  submitted: "Eingegangen",
  reviewing: "In Pruefung",
  contacted: "Kontaktiert",
  qualified: "Qualifiziert",
  negotiating: "In Verhandlung",
  converted: "Gewonnen",
  acquired: "Uebernommen",
  rejected: "Abgelehnt",
  bonus_eligible: "Praemie offen",
  bonus_paid: "Praemie gezahlt",
};

function Table({
  rows,
  art,
  statuses,
  nameLabel,
}: {
  rows: ReferralWithStaff[];
  art: "kunde" | "ma";
  statuses: string[];
  nameLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Noch keine Empfehlungen eingegangen.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-3 font-medium">{nameLabel}</th>
            <th className="py-2 pr-3 font-medium">Kontakt</th>
            <th className="py-2 pr-3 font-medium">Ort</th>
            <th className="py-2 pr-3 font-medium">Eingereicht von</th>
            <th className="py-2 pr-3 font-medium">Hub</th>
            <th className="py-2 pr-3 font-medium">Datum</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60 align-top">
              <td className="py-2 pr-3">
                <span className="font-medium text-foreground">{r.name}</span>
                {r.notiz && (
                  <span className="mt-0.5 block max-w-[260px] text-xs text-muted-foreground">
                    {r.notiz}
                  </span>
                )}
                {r.beziehung && (
                  <span className="mt-0.5 block max-w-[260px] text-xs italic text-muted-foreground">
                    {r.beziehung}
                  </span>
                )}
              </td>
              <td className="py-2 pr-3 text-muted-foreground">
                {r.telefon && <span className="block">{r.telefon}</span>}
                {r.email && <span className="block">{r.email}</span>}
                {!r.telefon && !r.email && "—"}
              </td>
              <td className="py-2 pr-3 text-muted-foreground">{r.ort ?? "—"}</td>
              <td className="py-2 pr-3 font-medium text-foreground">
                {r.staff_name}
              </td>
              <td className="py-2 pr-3 text-muted-foreground">
                {r.hub_name ?? "—"}
              </td>
              <td className="py-2 pr-3 text-muted-foreground">
                {formatShortDate(r.created_at)}
              </td>
              <td className="py-2">
                <form action={setReferralStatus} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="art" value={art} />
                  <select
                    name="status"
                    defaultValue={r.status}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {LABEL[s] ?? s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="h-8 rounded-md border border-input px-2 text-xs font-medium"
                  >
                    Speichern
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReferralsPanel({
  customer,
  ma,
}: {
  customer: ReferralWithStaff[];
  ma: ReferralWithStaff[];
}) {
  return (
    <>
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-[17px] font-semibold text-foreground">
          Kunden-Empfehlungen
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {customer.length}
          </span>
        </h2>
        <div className="mt-4">
          <Table
            rows={customer}
            art="kunde"
            statuses={CUSTOMER_STATUS}
            nameLabel="Empfohlene Person"
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-[17px] font-semibold text-foreground">
          Pflegedienst-Empfehlungen (M&amp;A)
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {ma.length}
          </span>
        </h2>
        <div className="mt-4">
          <Table
            rows={ma}
            art="ma"
            statuses={MA_STATUS}
            nameLabel="Pflegedienst"
          />
        </div>
      </section>
    </>
  );
}
