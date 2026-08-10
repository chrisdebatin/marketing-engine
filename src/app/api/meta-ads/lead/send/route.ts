import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverMail, mailConfigured } from "@/lib/mailer";
import { bodyToHtml } from "@/lib/followup-ai";

function leadEmail(fd: unknown): string | null {
  if (!Array.isArray(fd)) return null;
  const f = (fd as { name?: string; values?: string[] }[]).find((x) =>
    x.name?.toLowerCase().includes("mail"),
  );
  return f?.values?.[0]?.trim() ?? null;
}

/**
 * Follow-up eines Meta-Leads senden oder verwerfen. Versand ausschließlich
 * nach explizitem Klick — nie automatisch. Subject/Body kommen aus dem UI
 * (dort ggf. editiert) und werden als endgültige Fassung gespeichert.
 */
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session.isAdmin) {
    return Response.json({ error: "Nur für Admins." }, { status: 403 });
  }
  const { id, action, subject, body } = (await req.json().catch(() => ({}))) as {
    id?: string;
    action?: string;
    subject?: string;
    body?: string;
  };
  if (!id || !["send", "discard"].includes(action ?? "")) {
    return Response.json({ error: "Ungültige Angaben." }, { status: 400 });
  }
  const admin = createAdminClient();

  if (action === "discard") {
    const { error } = await admin
      .from("meta_leads")
      .update({ followup_status: "verworfen" })
      .eq("id", id);
    if (error) return Response.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
    return Response.json({ ok: true, status: "verworfen" });
  }

  if (!subject?.trim() || !body?.trim()) {
    return Response.json({ error: "Betreff und Text dürfen nicht leer sein." }, { status: 400 });
  }
  if (!mailConfigured()) {
    return Response.json(
      { error: "Kein Versandweg eingerichtet — Outlook verbinden oder SMTP-Zugangsdaten setzen." },
      { status: 503 },
    );
  }

  const { data: lead, error: loadError } = await admin
    .from("meta_leads")
    .select("id, field_data, followup_status")
    .eq("id", id)
    .single();
  if (loadError || !lead) return Response.json({ error: "Lead nicht gefunden." }, { status: 404 });
  if (lead.followup_status === "gesendet") {
    return Response.json({ error: "Follow-up wurde bereits gesendet." }, { status: 409 });
  }
  const to = leadEmail(lead.field_data);
  if (!to || !to.includes("@")) {
    return Response.json({ error: "Lead hat keine gültige E-Mail-Adresse." }, { status: 400 });
  }

  const res = await deliverMail({
    to: [to],
    subject: subject.trim(),
    html: bodyToHtml(body.trim()),
  });

  const update = res.ok
    ? {
        followup_subject: subject.trim(),
        followup_body: body.trim(),
        followup_status: "gesendet",
        followup_sent_at: new Date().toISOString(),
        followup_error: null,
      }
    : { followup_status: "fehlgeschlagen", followup_error: res.ok ? null : res.error };
  await admin.from("meta_leads").update(update).eq("id", id);

  if (!res.ok) return Response.json({ error: res.error }, { status: 502 });
  return Response.json({ ok: true, status: "gesendet", via: res.via });
}
