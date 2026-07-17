import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PatientBatchManager,
  type ManagerBatch,
} from "@/components/patient-batch-manager";
import { PatientAiImport } from "@/components/patient-ai-import";
import type { PatientBatch, PatientRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PatientenPage() {
  const session = await requireSession();
  // `patient_*` haben RLS disabled und keinen anon-Grant → nur über den
  // Service-Role-Client lesbar (gleiches Muster wie `orders`).
  const admin = createAdminClient();

  // Zwei einfache Queries + JS-Join (keine embedded-relation selects).
  // Fallback ?? [] — fehlt die Migration 0013, darf die Seite nicht crashen.
  const [{ data: batchesData }, { data: recordsData }] = await Promise.all([
    admin
      .from("patient_batches")
      .select("id, hub_id, period, note, created_at")
      .order("period", { ascending: false })
      .order("created_at", { ascending: false }),
    admin
      .from("patient_records")
      .select(
        "id, batch_id, hub_id, display_name, reference_id, status, source, note, verified_at, created_at, updated_at",
      )
      .order("created_at", { ascending: true }),
  ]);

  // Auf die Hubs der Session filtern (Vorbereitung MD-Scoping).
  const hubIds = new Set(session.hubs.map((h) => h.id));
  const batches = ((batchesData ?? []) as PatientBatch[]).filter((b) =>
    hubIds.has(b.hub_id),
  );
  const records = (recordsData ?? []) as PatientRecord[];

  const byBatch = new Map<string, PatientRecord[]>();
  for (const r of records) {
    const arr = byBatch.get(r.batch_id);
    if (arr) arr.push(r);
    else byBatch.set(r.batch_id, [r]);
  }

  const hubName = (id: string) =>
    session.hubs.find((h) => h.id === id)?.name ?? "Unbekannter Hub";

  const managerBatches: ManagerBatch[] = batches.map((b) => ({
    id: b.id,
    hub_id: b.hub_id,
    hub_name: hubName(b.hub_id),
    period: b.period,
    note: b.note,
    created_at: b.created_at,
    records: (byBatch.get(b.id) ?? []).map((r) => ({
      id: r.id,
      display_name: r.display_name,
      reference_id: r.reference_id,
      status: r.status,
      source: r.source,
      note: r.note,
      verified_at: r.verified_at,
    })),
  }));

  const hubOptions = session.hubs.map((h) => ({ id: h.id, name: h.name }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Patienten-Verifizierung</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monatliche Patientenlisten pro Hub anlegen — die PDL bestätigt über
          ihren Hub-Link, wer noch da ist. Gespeichert werden nur Anzeigename
          und optionale Referenz-ID (Datenminimierung).
        </p>
      </div>

      <PatientAiImport hubs={hubOptions} />

      <PatientBatchManager hubs={hubOptions} batches={managerBatches} />
    </div>
  );
}
