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
