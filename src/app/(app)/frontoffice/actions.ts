"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAD_QUELLEN } from "@/lib/leads";
import { todayIso } from "@/lib/crm";
import { isMissingColumn, normName } from "@/lib/crm-log";
import { getFollowupWeeks } from "@/lib/settings";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Extraktions-Ergebnis → crm_todos-Zeilen. Ohne erkannte Aufgabe entsteht
 * ein bereits erledigter "Nur Info"-Eintrag — er markiert die Notiz als
 * ausgewertet (kein erneutes Analysieren) und bewahrt die Zusammenfassung.
 */
function todoRows(
  extracted: import("@/lib/crm-todos-ai").ExtractedTodos,
  base: { target_id: string; hub_id: string | null; contact_id: string | null },
): import("@/lib/types").Database["public"]["Tables"]["crm_todos"]["Insert"][] {
  const besprochen = extracted.zusammenfassung.slice(0, 1000) || null;
  if (extracted.todos.length === 0) {
    return [
      {
        ...base,
        art: "sonstiges",
        aufgabe: "Nur Info — keine Aufgabe erkannt",
        besprochen,
        status: "erledigt",
        done_at: new Date().toISOString(),
      },
    ];
  }
  return extracted.todos.map((t) => ({
    ...base,
    art: t.art,
    aufgabe: t.aufgabe.slice(0, 500),
    besprochen,
  }));
}

function revalidateFrontoffice() {
  revalidatePath("/frontoffice");
  revalidatePath("/crm");
  revalidatePath("/callcenter");
  revalidatePath("/f/[token]", "page");
  revalidatePath("/c/[token]", "page");
  revalidatePath("/ziele");
  revalidatePath("/crm");
}

/**
 * Institution zum Freitext "Welches Krankenhaus?" finden (fuzzy über den
 * normalisierten Namen) — verknüpft eingehende Leads mit dem CRM.
 */
async function matchTargetByName(
  name: string,
): Promise<{ id: string; hub_id: string | null } | null> {
  const n = normName(name);
  if (!n) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("crm_targets")
      .select("id, hub_id, name");
    return (
      (data ?? []).find((t) => {
        const h = normName(t.name);
        return (
          h === n ||
          (h.includes(n) && n.length >= 10) ||
          (n.includes(h) && h.length >= 10)
        );
      }) ?? null
    );
  } catch {
    return null;
  }
}

function missingTableError(code?: string): Result | null {
  if (code === "PGRST205" || code === "42P01") {
    return {
      ok: false,
      error:
        "Die Tabelle lead_calls fehlt noch — bitte supabase/apply_all_pending.sql im Supabase SQL-Editor ausführen.",
    };
  }
  return null;
}

/** Frontoffice: einen Interessenten-Anruf (Lead) loggen. */
export async function createLeadCall(input: {
  quelle?: string;
  bereich?: string;
  quelle_detail?: string;
  lead_name?: string;
  hub_id?: string;
  call_date?: string;
  notiz?: string;
  /** Wer hat den Lead erfasst (Belinda/Adelina/Davina/Chris) — wird als Bearbeiter gespeichert. */
  erfasser?: string;
}): Promise<Result> {
  await requireSession();

  const quelle = (input.quelle ?? "").trim();
  if (!LEAD_QUELLEN.some((q) => q.key === quelle)) {
    return { ok: false, error: "Bitte Quelle auswählen." };
  }
  // Einer der drei festen Bereiche — oder frei eingetragen ("Andere").
  const bereich = (input.bereich ?? "").trim().slice(0, 100);
  if (!bereich) {
    return { ok: false, error: "Bitte Bereich auswählen oder eintragen." };
  }
  const leadName = (input.lead_name ?? "").trim().slice(0, 200);
  if (!leadName) {
    return { ok: false, error: "Bitte den Namen des Interessenten eintragen." };
  }
  const date = (input.call_date ?? "").trim();

  const admin = createAdminClient();
  const quelleDetail = (input.quelle_detail ?? "").trim().slice(0, 200) || null;
  // Kommt der Lead über eine Institution (Klinik, Praxis …), im CRM verknüpfen.
  const target = quelleDetail ? await matchTargetByName(quelleDetail) : null;
  const callDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIso();
  // Erfasser = Bearbeiter: wer den Anruf annimmt, hat den Lead auch angefasst
  // (gleiches Verhalten wie "Inbound-Anruf loggen" im Team-Workspace).
  const erfasser = (input.erfasser ?? "").trim().slice(0, 100) || null;
  let { error } = await admin.from("lead_calls").insert({
    quelle,
    bereich,
    quelle_detail: quelleDetail,
    lead_name: leadName,
    hub_id: (input.hub_id ?? "").trim() || null,
    target_id: target?.id ?? null,
    call_date: callDate,
    notiz: (input.notiz ?? "").trim().slice(0, 500) || null,
    bearbeiter: erfasser,
  });
  // Spalte target_id fehlt bis 0041, bereich bis 0035 — dann ohne sie speichern.
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    ({ error } = await admin.from("lead_calls").insert({
      quelle,
      bereich,
      quelle_detail: quelleDetail,
      lead_name: leadName,
      hub_id: (input.hub_id ?? "").trim() || null,
      call_date: callDate,
      notiz: (input.notiz ?? "").trim().slice(0, 500) || null,
    }));
  }
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    ({ error } = await admin.from("lead_calls").insert({
      quelle,
      hub_id: (input.hub_id ?? "").trim() || null,
      call_date: callDate,
      notiz: (input.notiz ?? "").trim().slice(0, 500) || null,
    }));
  }
  if (error) {
    return (
      missingTableError(error.code) ?? {
        ok: false,
        error: "Speichern fehlgeschlagen.",
      }
    );
  }

  // Institutions-Historie: eingegangener Lead als Log-Eintrag am Ziel-Ort
  // (ohne die Follow-up-Termine der PDL anzufassen). Nice-to-have — darf
  // die Lead-Erfassung nie blockieren.
  if (target) {
    await admin.from("crm_contacts").insert({
      target_id: target.id,
      hub_id: target.hub_id,
      kontakt_art: "lead",
      note: `Lead eingegangen: ${leadName} (${bereich})`,
      contact_date: callDate,
    });
  }

  revalidateFrontoffice();
  return { ok: true };
}

/**
 * Call-Center: aktiven Anruf bei einer Institution loggen. Schreibt ins
 * Kontakt-Log und terminiert das Follow-up — bei "nicht erreicht" schon
 * in 3 Tagen wieder. Optional wird ein neuer Ansprechpartner gespeichert.
 */
export async function logCallcenterCall(input: {
  target_id?: string;
  ansprechpartner?: string;
  note?: string;
  erreicht?: boolean;
  neue_person?: {
    name?: string;
    funktion?: string;
    telefon?: string;
    email?: string;
  };
}): Promise<Result> {
  await requireSession();
  const targetId = (input.target_id ?? "").trim();
  if (!targetId) return { ok: false, error: "Institution fehlt." };
  const erreicht = input.erreicht !== false;
  const ansprechpartner = (input.ansprechpartner ?? "").trim().slice(0, 200);
  const note = (input.note ?? "").trim().slice(0, 1000);
  if (erreicht && !note) {
    return { ok: false, error: "Kurze Gesprächsnotiz eintragen." };
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("crm_targets")
    .select("id, hub_id, intervall_wochen, name")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return { ok: false, error: "Institution nicht gefunden." };

  const today = todayIso();
  const next = new Date();
  if (erreicht) {
    const followup = await getFollowupWeeks();
    const weeks = followup.anruf ?? target.intervall_wochen ?? 4;
    next.setDate(next.getDate() + weeks * 7);
  } else {
    next.setDate(next.getDate() + 3);
    // Wiedervorlage nie am Wochenende — das Call-Center arbeitet werktags.
    if (next.getDay() === 6) next.setDate(next.getDate() + 2);
    else if (next.getDay() === 0) next.setDate(next.getDate() + 1);
  }
  const logNote = erreicht ? note : ["Nicht erreicht", note].filter(Boolean).join(" — ");

  const base = {
    letzter_besuch: today,
    naechster_besuch: next.toISOString().slice(0, 10),
    besuchs_notiz: logNote || null,
  };
  let { error: updErr } = await admin
    .from("crm_targets")
    .update({
      ...base,
      letzte_kontakt_art: "anruf",
      ...(ansprechpartner ? { ansprechpartner } : {}),
    })
    .eq("id", target.id);
  if (updErr && isMissingColumn(updErr)) {
    ({ error: updErr } = await admin
      .from("crm_targets")
      .update(base)
      .eq("id", target.id));
  }
  if (updErr) return { ok: false, error: "Speichern fehlgeschlagen." };

  const { data: logRow, error: logErr } = await admin
    .from("crm_contacts")
    .insert({
      target_id: target.id,
      hub_id: target.hub_id,
      kontakt_art: "anruf",
      ansprechpartner: ansprechpartner || null,
      note: logNote || null,
      contact_date: today,
    })
    .select("id")
    .single();
  if (logErr) {
    return {
      ok: false,
      error:
        "Anruf-Historie konnte nicht gespeichert werden — bitte erneut speichern.",
    };
  }

  const personName = (input.neue_person?.name ?? "").trim().slice(0, 200);
  if (personName) {
    await admin.from("crm_persons").insert({
      target_id: target.id,
      name: personName,
      funktion: (input.neue_person?.funktion ?? "").trim().slice(0, 120) || null,
      telefon: (input.neue_person?.telefon ?? "").trim().slice(0, 60) || null,
      email: (input.neue_person?.email ?? "").trim().slice(0, 200) || null,
    });
  }

  // KI: Notiz auswerten und To-dos für die PDL anlegen (nice-to-have —
  // darf das Loggen nie blockieren; ohne Tabelle 0042 passiert nichts).
  if (erreicht && note) {
    const { extractTodosFromCallNote } = await import("@/lib/crm-todos-ai");
    const extracted = await extractTodosFromCallNote({
      note,
      targetName: target.name,
      ansprechpartner,
    });
    if (extracted) {
      await admin
        .from("crm_todos")
        .insert(
          todoRows(extracted, {
            target_id: target.id,
            hub_id: target.hub_id,
            contact_id: logRow?.id ?? null,
          }),
        );
      // Genannter Termin ("ruf an nächsten Montag") schlägt den
      // Standard-Rhythmus: die Klinik taucht an dem Tag wieder in der
      // Tagesliste auf.
      const wv = extracted.wiedervorlage;
      if (wv && /^\d{4}-\d{2}-\d{2}$/.test(wv) && wv > today) {
        await admin
          .from("crm_targets")
          .update({ naechster_besuch: wv })
          .eq("id", target.id);
      }
    }
  }

  revalidateFrontoffice();
  return { ok: true };
}

/**
 * Bestehende Call-Center-Notizen nachträglich mit KI auswerten: legt für
 * Anrufe der letzten 30 Tage To-dos an, die noch keine haben. Admin-Button
 * auf der Call-Center-Seite.
 */
export async function analyzeCallNotes(): Promise<{
  ok: boolean;
  message: string;
}> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, message: "Nur für Admins." };
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      message: "ANTHROPIC_API_KEY fehlt — KI-Auswertung nicht möglich.",
    };
  }

  const admin = createAdminClient();
  const cutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  const [{ data: contacts }, { data: existing, error: todoErr }] =
    await Promise.all([
      admin
        .from("crm_contacts")
        .select("id, target_id, hub_id, ansprechpartner, note, contact_date")
        .eq("kontakt_art", "anruf")
        .gte("contact_date", cutoff)
        .not("note", "is", null)
        .order("contact_date", { ascending: false })
        .limit(200),
      admin.from("crm_todos").select("contact_id").limit(2000),
    ]);
  if (todoErr) {
    return {
      ok: false,
      message:
        "Tabelle crm_todos fehlt — bitte supabase/apply_all_pending.sql im Supabase SQL-Editor ausführen.",
    };
  }

  const done = new Set((existing ?? []).map((t) => t.contact_id));
  const offen = (contacts ?? []).filter(
    (c) =>
      !done.has(c.id) &&
      (c.note ?? "").trim() &&
      !(c.note ?? "").startsWith("Nicht erreicht"),
  );
  if (offen.length === 0) {
    return { ok: true, message: "Nichts zu tun — alle Notizen sind bereits ausgewertet." };
  }

  // 24 Notizen pro Klick, in 8er-Wellen parallel — bleibt unter dem
  // 60s-Limit der Vercel-Function.
  const batch = offen.slice(0, 24);
  const targetIds = [...new Set(batch.map((c) => c.target_id))];
  const { data: targetRows } = await admin
    .from("crm_targets")
    .select("id, name")
    .in("id", targetIds);
  const nameOf = new Map((targetRows ?? []).map((t) => [t.id, t.name]));

  const { extractTodosFromCallNote } = await import("@/lib/crm-todos-ai");
  let created = 0;
  let analysiert = 0;
  for (let i = 0; i < batch.length; i += 8) {
    const welle = batch.slice(i, i + 8);
    const results = await Promise.all(
      welle.map(async (c) => {
        const extracted = await extractTodosFromCallNote({
          note: c.note ?? "",
          targetName: nameOf.get(c.target_id),
          ansprechpartner: c.ansprechpartner,
        });
        if (!extracted) return null;
        const { error } = await admin
          .from("crm_todos")
          .insert(
            todoRows(extracted, {
              target_id: c.target_id,
              hub_id: c.hub_id,
              contact_id: c.id,
            }),
          );
        return error ? null : extracted.todos.length;
      }),
    );
    for (const r of results) {
      if (r !== null) {
        analysiert++;
        created += r;
      }
    }
  }

  revalidateFrontoffice();
  const rest = offen.length - batch.length;
  return {
    ok: true,
    message: `${analysiert} Notizen ausgewertet, ${created} To-dos angelegt.${
      rest > 0 ? ` ${rest} weitere offen — Button erneut klicken.` : ""
    }`,
  };
}

/** Lead-Eintrag löschen (Vertipper). */
export async function deleteLeadCall(id: string): Promise<Result> {
  await requireSession();
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Eintrag fehlt." };

  const admin = createAdminClient();
  const { error } = await admin.from("lead_calls").delete().eq("id", cleanId);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };
  revalidatePath("/frontoffice");
  revalidatePath("/crm");
  return { ok: true };
}
