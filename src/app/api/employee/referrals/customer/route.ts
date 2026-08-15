import { NextResponse } from "next/server";
import { logAudit, requireEmployee } from "@/lib/employee/auth";
import { empDb } from "@/lib/employee/db";
import { customerReferralSchema, firstError } from "@/lib/employee/schemas";

export const runtime = "nodejs";

/**
 * Kunden-Empfehlung einreichen.
 *
 * staff_id und hub_id werden AUSSCHLIESSLICH aus der Session uebernommen.
 * Das Zod-Schema ist .strict() und kennt diese Felder nicht — ein
 * untergeschobenes "staff_id" fuehrt zu 400, nicht zu einer Fremdzuordnung.
 */
export async function POST(req: Request) {
  const ctx = await requireEmployee();
  if (!ctx) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = customerReferralSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }

  const input = parsed.data;
  const { data, error } = await empDb()
    .from("customer_referrals")
    .insert({
      // Identitaet ausschliesslich aus der Session:
      staff_id: ctx.staffId,
      hub_id: ctx.staff.hub_id,
      kunde_name: input.kunde_name,
      telefon: input.telefon ?? null,
      email: input.email ?? null,
      ort: input.ort ?? null,
      beziehung: input.beziehung ?? null,
      notiz: input.notiz ?? null,
      consent_version: "v1",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Das hat nicht geklappt. Bitte versuche es noch einmal." },
      { status: 500 },
    );
  }

  await logAudit(ctx.staffId, "referral_created", {
    ziel_art: "kunde",
    ziel_id: data.id,
  });

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}

/** Nur die EIGENEN Empfehlungen. Der Filter ist nicht optional. */
export async function GET() {
  const ctx = await requireEmployee();
  if (!ctx) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { data } = await empDb()
    .from("customer_referrals")
    .select("id, kunde_name, status, created_at")
    .eq("staff_id", ctx.staffId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ referrals: data ?? [] });
}
