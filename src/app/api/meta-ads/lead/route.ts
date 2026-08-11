import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Lead-Status umschalten (offen / kontaktiert). */
export async function PATCH(req: Request) {
  const session = await requireSession();
  if (!session.isAdmin) {
    return Response.json({ error: "Nur für Admins." }, { status: 403 });
  }
  const { id, status } = (await req.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
  };
  if (!id || !["offen", "kontaktiert"].includes(status ?? "")) {
    return Response.json({ error: "Ungültige Angaben." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("meta_leads")
    .update({ status: status! })
    .eq("id", id);
  if (error) return Response.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  return Response.json({ ok: true });
}

/**
 * Lead löschen — als Soft-Delete (status 'geloescht'): Der Meta-Sync würde
 * eine hart gelöschte Zeile beim nächsten Lauf wieder anlegen.
 */
export async function DELETE(req: Request) {
  const session = await requireSession();
  if (!session.isAdmin) {
    return Response.json({ error: "Nur für Admins." }, { status: 403 });
  }
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return Response.json({ error: "ID fehlt." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("meta_leads")
    .update({ status: "geloescht" })
    .eq("id", id);
  if (error) {
    const constraint = error.code === "23514";
    return Response.json(
      {
        error: constraint
          ? "Status 'geloescht' fehlt noch — bitte supabase/apply_all_pending.sql im Supabase SQL-Editor ausführen."
          : "Löschen fehlgeschlagen.",
      },
      { status: 500 },
    );
  }
  return Response.json({ ok: true });
}
