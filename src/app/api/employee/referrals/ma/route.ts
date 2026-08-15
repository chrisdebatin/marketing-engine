import { NextResponse } from "next/server";
import { logAudit, requireEmployee } from "@/lib/employee/auth";
import { empDb } from "@/lib/employee/db";
import { firstError, maReferralSchema } from "@/lib/employee/schemas";

export const runtime = "nodejs";

/**
 * M&A-Empfehlung einreichen (Hinweis auf einen uebernahmefaehigen Pflegedienst).
 *
 * Wie bei den Kunden-Empfehlungen: Identitaet nur aus der Session, Schema
 * .strict() ohne staff_id. Einziges Pflichtfeld ist firma_name — auch ein
 * blosser Name ist fuer uns wertvoll.
 */
export async function POST(req: Request) {
  const ctx = await requireEmployee();
  if (!ctx) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = maReferralSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }

  const input = parsed.data;
  const { data, error } = await empDb()
    .from("ma_referrals")
    .insert({
      staff_id: ctx.staffId,
      hub_id: ctx.staff.hub_id,
      firma_name: input.firma_name,
      inhaber_name: input.inhaber_name ?? null,
      telefon: input.telefon ?? null,
      email: input.email ?? null,
      ort: input.ort ?? null,
      beziehung: input.beziehung ?? null,
      notiz: input.notiz ?? null,
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
    ziel_art: "ma",
    ziel_id: data.id,
  });

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}

/** Nur die EIGENEN Empfehlungen. */
export async function GET() {
  const ctx = await requireEmployee();
  if (!ctx) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { data } = await empDb()
    .from("ma_referrals")
    .select("id, firma_name, status, created_at")
    .eq("staff_id", ctx.staffId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ referrals: data ?? [] });
}
