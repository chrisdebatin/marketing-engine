"use client";

import { useState } from "react";
import type { StaffWithHub } from "@/lib/employee/admin";
import { createStaff, generateCode, resetAccess, setStaffStatus } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  eingeladen: "Eingeladen",
  aktiv: "Aktiv",
  gesperrt: "Gesperrt",
  ausgeschieden: "Ausgeschieden",
};

const STATUS_CLASS: Record<string, string> = {
  eingeladen: "bg-amber-100 text-amber-800",
  aktiv: "bg-emerald-100 text-emerald-800",
  gesperrt: "bg-red-100 text-red-800",
  ausgeschieden: "bg-slate-100 text-slate-600",
};

/**
 * Mitarbeitende und Zugaenge.
 *
 * Der erzeugte Aktivierungscode wird EINMALIG angezeigt — danach existiert
 * nur noch sein Hash. Deshalb bleibt er bis zum Schliessen im Dialog stehen.
 */
export function StaffPanel({
  staff,
  hubs,
}: {
  staff: StaffWithHub[];
  hubs: { id: string; name: string }[];
}) {
  const [code, setCode] = useState<{ name: string; value: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function onGenerate(s: StaffWithHub) {
    setBusy(s.id);
    try {
      const value = await generateCode(s.id);
      setCode({ name: `${s.vorname} ${s.nachname}`, value });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-[17px] font-semibold text-foreground">
        Mitarbeitende &amp; Zugaenge
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {staff.length}
        </span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Der Aktivierungscode wird nur einmal angezeigt. Er geht ueber die
        Hubleitung an die Mitarbeitenden.
      </p>

      {code && (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-900">
            Aktivierungscode fuer <strong>{code.name}</strong> — bitte jetzt
            notieren, er wird nicht erneut angezeigt:
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-[0.12em] text-emerald-950">
            {code.value}
          </p>
          <button
            onClick={() => setCode(null)}
            className="mt-3 h-8 rounded-md border border-emerald-300 bg-white px-3 text-xs font-medium text-emerald-900"
          >
            Schliessen
          </button>
        </div>
      )}

      <form action={createStaff} className="mt-4 grid gap-3 md:grid-cols-5">
        <input
          name="vorname"
          required
          placeholder="Vorname"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          name="nachname"
          required
          placeholder="Nachname"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          name="personalnr"
          placeholder="Personalnr. (optional)"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          name="hub_id"
          defaultValue=""
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Hub waehlen …</option>
          {hubs.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Anlegen
        </button>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Hub</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">PIN gesetzt</th>
              <th className="py-2 pr-3 font-medium">Offener Code</th>
              <th className="py-2 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-muted-foreground">
                  Noch keine Mitarbeitenden angelegt.
                </td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium text-foreground">
                    {s.vorname} {s.nachname}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {s.hub_name ?? "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        STATUS_CLASS[s.status] ?? ""
                      }`}
                    >
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {s.has_pin ? "Ja" : "Nein"}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                    {s.open_code_hint ? `…${s.open_code_hint}` : "—"}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => onGenerate(s)}
                        disabled={busy === s.id}
                        className="h-8 rounded-md border border-input px-3 text-xs font-medium disabled:opacity-50"
                      >
                        {busy === s.id ? "…" : "Code erzeugen"}
                      </button>

                      <form action={resetAccess}>
                        <input type="hidden" name="staff_id" value={s.id} />
                        <button
                          type="submit"
                          className="h-8 rounded-md border border-input px-3 text-xs font-medium"
                          title="Alle Geraete und Sitzungen entwerten"
                        >
                          Zugang zuruecksetzen
                        </button>
                      </form>

                      <form action={setStaffStatus} className="flex gap-1">
                        <input type="hidden" name="staff_id" value={s.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={s.status === "gesperrt" ? "aktiv" : "gesperrt"}
                        />
                        <button
                          type="submit"
                          className="h-8 rounded-md border border-input px-3 text-xs font-medium"
                        >
                          {s.status === "gesperrt" ? "Entsperren" : "Sperren"}
                        </button>
                      </form>
                    </div>
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
