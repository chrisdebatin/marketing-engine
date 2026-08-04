import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { capacityWeekStart, clampPlaetze, clampScore } from "@/lib/capacity";

export const runtime = "nodejs";

/**
 * Wöchentliche Kapazitäts-Meldung der PDL (token-gated). Upsert je
 * Hub + Kalenderwoche — Korrekturen innerhalb der Woche überschreiben.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    freie_plaetze?: number | string;
    beatmung_plaetze?: number | string;
    wg_plaetze?: number | string;
    kinder_moeglich?: boolean;
    pflege_score?: number | string;
    alltagshilfe_score?: number | string;
    wundversorgung_score?: number | string;
    aufnahme_ab?: string;
    notiz?: string;
  };

  const token = (body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: hub } = await admin
    .from("hubs")
    .select("id")
    .eq("share_token", token)
    .single();
  if (!hub) {
    return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
  }

  const aufnahmeAb = (body.aufnahme_ab ?? "").trim();
  const base = {
    hub_id: hub.id,
    week_start: capacityWeekStart(),
    freie_plaetze: clampPlaetze(body.freie_plaetze),
    beatmung_plaetze: clampPlaetze(body.beatmung_plaetze),
    wg_plaetze: clampPlaetze(body.wg_plaetze),
    kinder_moeglich: Boolean(body.kinder_moeglich),
    aufnahme_ab: /^\d{4}-\d{2}-\d{2}$/.test(aufnahmeAb) ? aufnahmeAb : null,
    notiz: (body.notiz ?? "").trim().slice(0, 1000) || null,
    updated_at: new Date().toISOString(),
  };
  const scores = {
    pflege_score: clampScore(body.pflege_score),
    alltagshilfe_score: clampScore(body.alltagshilfe_score),
    wundversorgung_score: clampScore(body.wundversorgung_score),
  };
  let { data: report, error } = await admin
    .from("capacity_reports")
    .upsert({ ...base, ...scores }, { onConflict: "hub_id,week_start" })
    .select("*")
    .single();
  // Score-Spalten fehlen bis Migration 0043 — dann ohne sie speichern.
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    ({ data: report, error } = await admin
      .from("capacity_reports")
      .upsert(base, { onConflict: "hub_id,week_start" })
      .select("*")
      .single());
  }

  if (error || !report) {
    if (error?.code === "PGRST205" || error?.code === "42P01") {
      return NextResponse.json(
        { error: "Kapazitäts-Meldung ist noch nicht freigeschaltet — bitte beim Marketing-Team melden." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }
  return NextResponse.json({ report });
}
