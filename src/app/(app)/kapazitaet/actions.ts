"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { capacityWeekStart, clampPlaetze, clampScore } from "@/lib/capacity";
import { extractCapacityFromText } from "@/lib/capacity-ai";

/**
 * Freitext-Kapazitätsmeldung ("Dorsten 5 Plätze, 2 Beatmung; Velbert …")
 * per KI auslesen und als Wochen-Meldung je Standort eintragen. Bestehende
 * Meldungen der Woche werden überschrieben; nicht genannte Felder bleiben
 * bei einer bestehenden Meldung erhalten.
 */
export async function importCapacityFromText(input: {
  text?: string;
}): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, message: "Nur für Admins." };
  const text = (input.text ?? "").trim();
  if (!text) return { ok: false, message: "Bitte eine Meldung eintippen." };
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      message: "ANTHROPIC_API_KEY fehlt — KI-Auswertung nicht möglich.",
    };
  }

  const hubs = session.hubs;
  const extracted = await extractCapacityFromText(
    text,
    hubs.map((h) => h.name),
  );
  if (!extracted) {
    return {
      ok: false,
      message:
        "KI-Auswertung fehlgeschlagen (Zeitüberschreitung oder API-Fehler) — bitte erneut versuchen.",
    };
  }
  if (extracted.meldungen.length === 0) {
    return {
      ok: false,
      message:
        "Keine Standort-Angaben erkannt — bitte die Standorte beim Namen nennen.",
    };
  }

  const admin = createAdminClient();
  const week = capacityWeekStart();
  const { data: existingRows } = await admin
    .from("capacity_reports")
    .select("*")
    .eq("week_start", week);

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const findHub = (name: string) => {
    const n = norm(name);
    return (
      hubs.find((h) => norm(h.name) === n) ??
      hubs.find((h) => norm(h.name).includes(n) || n.includes(norm(h.name))) ??
      null
    );
  };

  const eingetragen: string[] = [];
  const unbekannt: string[] = [];
  for (const m of extracted.meldungen) {
    const hub = findHub(m.standort);
    if (!hub) {
      unbekannt.push(m.standort);
      continue;
    }
    // Nicht genannte Werte: bestehende Meldung der Woche behalten, sonst 0.
    const vorhanden = (existingRows ?? []).find((r) => r.hub_id === hub.id);
    const aufnahme =
      m.aufnahme_ab && /^\d{4}-\d{2}-\d{2}$/.test(m.aufnahme_ab)
        ? m.aufnahme_ab
        : (vorhanden?.aufnahme_ab ?? null);
    const base = {
      hub_id: hub.id,
      week_start: week,
      freie_plaetze: clampPlaetze(
        m.freie_plaetze ?? vorhanden?.freie_plaetze ?? 0,
      ),
      beatmung_plaetze: clampPlaetze(
        m.beatmung_plaetze ?? vorhanden?.beatmung_plaetze ?? 0,
      ),
      wg_plaetze: clampPlaetze(m.wg_plaetze ?? vorhanden?.wg_plaetze ?? 0),
      kinder_moeglich: m.kinder_moeglich ?? vorhanden?.kinder_moeglich ?? false,
      aufnahme_ab: aufnahme,
      notiz: (m.notiz ?? "").trim().slice(0, 500) || vorhanden?.notiz || null,
      updated_at: new Date().toISOString(),
    };
    const scores = {
      pflege_score:
        clampScore(m.pflege_score) ?? vorhanden?.pflege_score ?? null,
      alltagshilfe_score:
        clampScore(m.alltagshilfe_score) ??
        vorhanden?.alltagshilfe_score ??
        null,
      wundversorgung_score:
        clampScore(m.wundversorgung_score) ??
        vorhanden?.wundversorgung_score ??
        null,
    };
    let { error } = await admin
      .from("capacity_reports")
      .upsert({ ...base, ...scores }, { onConflict: "hub_id,week_start" });
    // Score-Spalten fehlen bis Migration 0043 — dann ohne sie speichern.
    if (error && (error.code === "PGRST204" || error.code === "42703")) {
      ({ error } = await admin
        .from("capacity_reports")
        .upsert(base, { onConflict: "hub_id,week_start" }));
    }
    if (error) {
      return {
        ok: false,
        message: `Speichern für ${hub.name} fehlgeschlagen.`,
      };
    }
    eingetragen.push(hub.name);
  }

  revalidatePath("/kapazitaet");
  const parts = [
    eingetragen.length > 0
      ? `Eingetragen (Woche ab ${week}): ${eingetragen.join(", ")}.`
      : "Nichts eingetragen.",
    unbekannt.length > 0
      ? `Nicht zugeordnet: ${unbekannt.join(", ")} — Standort-Name prüfen.`
      : "",
  ].filter(Boolean);
  return { ok: eingetragen.length > 0, message: parts.join(" ") };
}
