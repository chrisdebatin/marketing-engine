import { createAdminClient } from "@/lib/supabase/admin";
import { normName } from "@/lib/crm-log";
import { CALLCENTER_QUELLEN, isDirectBookingHub } from "@/lib/leads";
import { isRecruitingLead } from "@/lib/lead-forward";
import { leadAddress, leadEmail, leadFullName, leadPhone } from "@/lib/meta-lead-fields";
import { hubCoords } from "@/lib/hub-coords";
import type { InboundLead, OutboundTarget } from "@/components/team-workspace";

// PLZ → Koordinaten (zippopotam.us, in-memory gecacht) → nächstgelegener
// Hub. Wichtig für Recare: die Klinik steht oft in einer Stadt ohne Hub,
// entscheidend ist die Patienten-PLZ aus der Anfrage.
const plzCache = new Map<string, [number, number] | null>();
async function plzToCoords(plz: string): Promise<[number, number] | null> {
  if (plzCache.has(plz)) return plzCache.get(plz)!;
  let coords: [number, number] | null = null;
  try {
    const res = await fetch(`https://api.zippopotam.us/de/${plz}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        places?: { latitude: string; longitude: string }[];
      };
      const p = json.places?.[0];
      if (p) coords = [Number(p.latitude), Number(p.longitude)];
    }
  } catch {
    /* offline/Timeout → kein Vorschlag */
  }
  plzCache.set(plz, coords);
  return coords;
}

function distKm(a: [number, number], b: [number, number]): number {
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(s));
}

/** Nächster Hub zur PLZ (max. 60 km, sonst kein Vorschlag). */
async function nearestHubByPlz(
  plz: string,
  hubRows: { id: string; name: string }[],
): Promise<string | null> {
  const coords = await plzToCoords(plz);
  if (!coords) return null;
  let best: { id: string; km: number } | null = null;
  for (const h of hubRows) {
    const hc = hubCoords(h.name);
    if (!hc) continue;
    const km = distKm(coords, hc);
    if (!best || km < best.km) best = { id: h.id, km };
  }
  return best && best.km <= 60 ? best.id : null;
}

/**
 * Inbound-Leads eines Teams zusammensetzen (SERVER ONLY) — gemeinsam
 * genutzt von den persönlichen Team-Seiten (/t) und den Team-Monitoren
 * auf /crm. Quelle bestimmt das Team: Call-Center = Recare, Kundenservice
 * = alles andere inkl. Meta-Kunden-Leads.
 */
export async function buildTeamInbound(
  team: "kundenservice" | "callcenter",
): Promise<InboundLead[]> {
  const admin = createAdminClient();
  const isCallcenter = team === "callcenter";

  const [{ data: callRows }, { data: metaRows }, { data: hubRows }] =
    await Promise.all([
      admin
        .from("lead_calls")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      !isCallcenter
        ? admin
            .from("meta_leads")
            .select("*")
            .neq("status", "geloescht")
            .order("created_time", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] as never[] }),
      admin.from("hubs").select("id, name, pdl_name, pdl_phone"),
    ]);

  const hubName = (id: string | null) =>
    (hubRows ?? []).find((h) => h.id === id)?.name ?? null;
  const hubPdl = (id: string | null) =>
    (hubRows ?? []).find((h) => h.id === id)?.pdl_name ?? null;
  const hubPdlPhone = (id: string | null) =>
    (hubRows ?? []).find((h) => h.id === id)?.pdl_phone ?? null;

  // Standort-Vorschlag: normalisierter Hub-Name im Lead-Text (Kampagne,
  // Klinik, Notiz) — "Kunden-BadOeynhausen-…" trifft "Bad Oeynhausen".
  const norm = (s: string) => s.toLowerCase().replace(/[^a-zä-ü0-9]/g, "");
  const suggestHub = (text: string): string | null => {
    const t = norm(text);
    if (t.length < 4) return null;
    for (const h of hubRows ?? []) {
      const hn = norm(h.name.replace(/^alltagshilfe\s+/i, ""));
      if (hn.length >= 4 && t.includes(hn)) return h.id;
    }
    return null;
  };

  // Offene To-dos je Lead (Wiedervorlage) — tolerant, falls Migration 0057 fehlt.
  const { data: todoRows } = await admin
    .from("lead_todos")
    .select("id, lead_kind, lead_id, text, faellig_am")
    .is("erledigt_at", null)
    .limit(500);
  const todosFor = (kind: "call" | "meta", id: string) =>
    (todoRows ?? [])
      .filter((t) => t.lead_kind === kind && t.lead_id === id)
      .map((t) => ({ id: t.id, text: t.text, faellig_am: t.faellig_am }));

  // ── Klinik-Beziehung für Recare-Leads: waren wir schon da, haben wir
  // schon angerufen, wie viele Patienten kamen bisher von dort? ──
  interface KontaktZeile {
    target_id: string | null;
    kontakt_art: string;
    ansprechpartner: string | null;
    contact_date: string;
  }
  const recareCalls = (callRows ?? []).filter(
    (c) => c.quelle === "recare" && c.quelle_detail,
  );
  let klinikKontakte = new Map<string, KontaktZeile[]>();
  const patStats = new Map<string, { total: number; aufgenommen: number }>();
  if (recareCalls.length > 0) {
    const targetIds = [
      ...new Set(recareCalls.map((c) => c.target_id).filter(Boolean)),
    ] as string[];
    const [kontakteRes, alleRecareRes] = await Promise.all([
      targetIds.length
        ? admin
            .from("crm_contacts")
            .select("target_id, kontakt_art, ansprechpartner, contact_date")
            .in("target_id", targetIds)
            .order("contact_date", { ascending: false })
            .limit(300)
        : Promise.resolve({ data: [] as KontaktZeile[] }),
      admin
        .from("lead_calls")
        .select("quelle_detail, status, pdl_bestaetigt_at, pdl_ergebnis")
        .eq("quelle", "recare")
        .not("quelle_detail", "is", null)
        .limit(1000),
    ]);
    klinikKontakte = new Map();
    for (const k of (kontakteRes.data ?? []) as KontaktZeile[]) {
      if (!k.target_id) continue;
      const arr = klinikKontakte.get(k.target_id) ?? [];
      arr.push(k);
      klinikKontakte.set(k.target_id, arr);
    }
    for (const r of alleRecareRes.data ?? []) {
      const key = normName(r.quelle_detail ?? "");
      if (!key) continue;
      const e = patStats.get(key) ?? { total: 0, aufgenommen: 0 };
      e.total++;
      if (
        r.status === "aufgenommen" ||
        (r.pdl_bestaetigt_at && !/nicht|kein/i.test(r.pdl_ergebnis ?? ""))
      ) {
        e.aufgenommen++;
      }
      patStats.set(key, e);
    }
  }
  const klinikInfoFor = (c: {
    quelle: string;
    quelle_detail: string | null;
    target_id: string | null;
  }): InboundLead["klinik_info"] => {
    if (c.quelle !== "recare" || !c.quelle_detail) return null;
    const stats = patStats.get(normName(c.quelle_detail)) ?? {
      total: 0,
      aufgenommen: 0,
    };
    const rows = c.target_id ? (klinikKontakte.get(c.target_id) ?? []) : [];
    const anruf = rows.find((k) => k.kontakt_art === "anruf");
    const besuch = rows.find((k) =>
      ["besuch", "box", "flyer"].includes(k.kontakt_art),
    );
    return {
      name: c.quelle_detail,
      letzter_anruf: anruf
        ? { datum: anruf.contact_date, ansprechpartner: anruf.ansprechpartner }
        : null,
      letzter_besuch: besuch
        ? { datum: besuch.contact_date, art: besuch.kontakt_art }
        : null,
      ansprechpartner: rows.find((k) => k.ansprechpartner)?.ansprechpartner ?? null,
      patienten: stats.total,
      aufgenommen: stats.aufgenommen,
    };
  };

  const inbound: InboundLead[] = [];
  for (const c of callRows ?? []) {
    const mine = isCallcenter
      ? CALLCENTER_QUELLEN.has(c.quelle)
      : !CALLCENTER_QUELLEN.has(c.quelle);
    if (!mine) continue;
    // Vorschlag: erst Namens-Match, bei Recare zusätzlich über die
    // Patienten-PLZ aus der Notiz ("Ort: 41189") → nächstgelegener Hub.
    const text = `${c.quelle_detail ?? ""} ${c.notiz ?? ""} ${c.lead_name ?? ""}`;
    let vorschlagId = suggestHub(text);
    if (!vorschlagId && c.quelle === "recare") {
      const plz = /\b(\d{5})\b/.exec(c.notiz ?? "")?.[1];
      if (plz) vorschlagId = await nearestHubByPlz(plz, hubRows ?? []);
    }
    inbound.push({
      kind: "call",
      id: c.id,
      name: c.lead_name || "(ohne Name)",
      telefon: c.telefon ?? null,
      email: c.email ?? null,
      // Adresse: eigenes Feld; Altbestand hat den Ort noch im Notiz-Freitext.
      adresse:
        (("adresse" in c ? (c as { adresse?: string | null }).adresse : null) ??
          /(?:^|· )Ort: ([^·]+)/.exec(c.notiz ?? "")?.[1]?.trim()) ||
        null,
      bereich: c.bereich ?? null,
      erstbearbeitet_at:
        ("erstbearbeitet_at" in c
          ? (c as { erstbearbeitet_at?: string | null }).erstbearbeitet_at
          : null) ?? null,
      quelle: c.quelle,
      quelle_detail: c.quelle_detail ?? null,
      datum: c.created_at ?? c.call_date,
      status: c.status ?? "offen",
      bearbeiter: c.bearbeiter ?? null,
      notiz: c.notiz ?? null,
      ergebnis: c.ergebnis ?? null,
      hub: hubName(c.hub_id),
      zugewiesen_hub_id: c.zugewiesen_hub_id ?? null,
      zugewiesen_hub: hubName(c.zugewiesen_hub_id ?? null),
      zugewiesen_pdl: hubPdl(c.zugewiesen_hub_id ?? null),
      zugewiesen_at: c.zugewiesen_at ?? null,
      pdl_bestaetigt_at: c.pdl_bestaetigt_at ?? null,
      pdl_ergebnis: c.pdl_ergebnis ?? null,
      vorschlag_hub_id: vorschlagId,
      vorschlag_hub: hubName(vorschlagId),
      vorschlag_pdl: hubPdl(vorschlagId),
      vorschlag_pdl_phone: hubPdlPhone(vorschlagId),
      direct_booking: isDirectBookingHub(
        hubName(c.zugewiesen_hub_id ?? null) ?? hubName(vorschlagId),
      ),
      todos: todosFor("call", c.id),
      klinik_info: klinikInfoFor(c),
    });
  }
  if (!isCallcenter) {
    for (const m of metaRows ?? []) {
      if (isRecruitingLead(m.campaign_name)) continue;
      inbound.push({
        kind: "meta",
        id: m.id,
        name: leadFullName(m.field_data) ?? "(ohne Name)",
        telefon: leadPhone(m.field_data),
        email: leadEmail(m.field_data),
        adresse:
          ("adresse" in m ? (m as { adresse?: string | null }).adresse : null) ??
          leadAddress(m.field_data),
        bereich: null,
        erstbearbeitet_at:
          ("erstbearbeitet_at" in m
            ? (m as { erstbearbeitet_at?: string | null }).erstbearbeitet_at
            : null) ?? null,
        quelle: "meta",
        quelle_detail: m.campaign_name,
        datum: m.created_time ?? m.created_at ?? "",
        status: m.status,
        bearbeiter: m.bearbeiter ?? null,
        notiz: m.notiz ?? null,
        ergebnis: m.ergebnis ?? null,
        hub: null,
        zugewiesen_hub_id: m.zugewiesen_hub_id ?? null,
        zugewiesen_hub: hubName(m.zugewiesen_hub_id ?? null),
        zugewiesen_pdl: hubPdl(m.zugewiesen_hub_id ?? null),
        zugewiesen_at: m.zugewiesen_at ?? null,
        pdl_bestaetigt_at: m.pdl_bestaetigt_at ?? null,
        pdl_ergebnis: m.pdl_ergebnis ?? null,
        vorschlag_hub_id: suggestHub(m.campaign_name ?? ""),
        vorschlag_hub: hubName(suggestHub(m.campaign_name ?? "")),
        vorschlag_pdl: hubPdl(suggestHub(m.campaign_name ?? "")),
        vorschlag_pdl_phone: hubPdlPhone(suggestHub(m.campaign_name ?? "")),
        direct_booking: isDirectBookingHub(
          hubName(m.zugewiesen_hub_id ?? null) ??
            hubName(suggestHub(m.campaign_name ?? "") ?? null),
        ),
        todos: todosFor("meta", m.id),
        klinik_info: null,
      });
    }
  }
  inbound.sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));
  return inbound;
}

export interface TeamAnruf {
  datum: string; // JJJJ-MM-TT
  erreicht: boolean;
  bearbeiter: string | null;
}

/**
 * Outbound-Anruf-Log eines Teams (letzte 7 Tage, SERVER ONLY) — für die
 * KPI-Zeile der Outbound-Ansicht (Tagesziel, Gesprächsquote, Wochen-Performance).
 * Team-Split über die Ziel-Kategorie wie bei der Anrufliste.
 */
export async function buildTeamAnrufe(
  team: "kundenservice" | "callcenter",
): Promise<TeamAnruf[]> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: contacts }, { data: targets }] = await Promise.all([
    admin
      .from("crm_contacts")
      .select("target_id, contact_date, note, bearbeiter")
      .eq("kontakt_art", "anruf")
      .gte("contact_date", cutoff),
    admin.from("crm_targets").select("id, kategorie"),
  ]);
  const excluded = team === "callcenter" ? "praxis" : "krankenhaus";
  const kat = new Map((targets ?? []).map((t) => [t.id, t.kategorie ?? "sonstiges"]));
  return (contacts ?? [])
    .filter((c) => kat.get(c.target_id ?? "") !== excluded)
    .map((c) => ({
      datum: c.contact_date,
      erreicht: !/^nicht erreicht/i.test(c.note ?? ""),
      bearbeiter: c.bearbeiter ?? null,
    }));
}

/**
 * Outbound-Anrufliste eines Teams (SERVER ONLY) — Kategorie-Split wie auf
 * den persönlichen Seiten: praxis exklusiv Kundenservice, krankenhaus
 * exklusiv Call-Center, alle übrigen Kategorien als gemeinsamer Pool.
 */
export async function buildTeamOutbound(
  team: "kundenservice" | "callcenter",
): Promise<OutboundTarget[]> {
  const admin = createAdminClient();
  const isCallcenter = team === "callcenter";
  const [{ data: targetRows }, { data: hubRows }, { data: todoRows }] = await Promise.all([
    admin
      .from("crm_targets")
      .select("*")
      .not("kategorie", "in", "(meta_kunde,meta_mitarbeiter)"),
    admin.from("hubs").select("id, name, pdl_name, pdl_phone"),
    // Offene KI-/manuelle To-dos an Kontakten — tolerant, falls 0059 fehlt.
    admin
      .from("lead_todos")
      .select("id, lead_id, text, faellig_am")
      .eq("lead_kind", "target")
      .is("erledigt_at", null)
      .limit(500),
  ]);
  // PDL-Aktivitäten (CM-Box beliefert / Flyer ausgelegt) den Institutionen
  // zuordnen — wer anruft, sieht sofort, dass ein Standort schon vor Ort war.
  const [{ data: actRows }, { data: profileRows }] = await Promise.all([
    admin
      .from("activities")
      .select("standort_name, type, occurred_on, hub_id, user_id")
      .order("occurred_on", { ascending: false })
      .limit(1000),
    admin.from("profiles").select("id, name"),
  ]);
  const acts = (actRows ?? [])
    .map((a) => ({ ...a, norm: normName(a.standort_name) }))
    .filter((a) => a.norm.length >= 5);
  const profileName = (id: string | null) =>
    (profileRows ?? []).find((p) => p.id === id)?.name ?? null;
  /** Jüngste Box-/Flyer-Aktivität je Institution (Namens-Match wie place-search). */
  const besucheFor = (targetName: string) => {
    const tn = normName(targetName);
    if (tn.length < 5) return [];
    const matches = acts.filter(
      (a) =>
        a.norm === tn ||
        (tn.length >= 8 && a.norm.includes(tn)) ||
        (a.norm.length >= 8 && tn.includes(a.norm)),
    );
    return (["box", "flyer"] as const).flatMap((art) => {
      const m = matches.find((a) => a.type === art);
      return m
        ? [
            {
              art,
              datum: m.occurred_on,
              von: profileName(m.user_id),
              hub: (hubRows ?? []).find((h) => h.id === m.hub_id)?.name ?? null,
            },
          ]
        : [];
    });
  };
  const hubOf = (id: string | null) => (hubRows ?? []).find((h) => h.id === id);
  const hubName = (id: string | null) => hubOf(id)?.name ?? null;
  const exclusive = isCallcenter ? "krankenhaus" : "praxis";
  const excluded = isCallcenter ? "praxis" : "krankenhaus";
  return (targetRows ?? [])
    .filter((t) => (t.kategorie ?? "sonstiges") !== excluded)
    .map((t) => ({
      id: t.id,
      name: t.name,
      kategorie: t.kategorie ?? "sonstiges",
      ort: t.ort ?? null,
      relevanz: t.relevanz ?? null,
      hub: hubName(t.hub_id),
      hub_pdl: hubOf(t.hub_id)?.pdl_name ?? null,
      hub_pdl_phone: hubOf(t.hub_id)?.pdl_phone ?? null,
      kurzinfo: ("kurzinfo" in t ? (t as { kurzinfo?: string | null }).kurzinfo : null) ?? null,
      letzter_besuch: t.letzter_besuch ?? null,
      letzte_kontakt_art: t.letzte_kontakt_art ?? null,
      naechster_besuch: t.naechster_besuch ?? null,
      besuchs_notiz: t.besuchs_notiz ?? null,
      exklusiv: (t.kategorie ?? "sonstiges") === exclusive,
      todos: (todoRows ?? [])
        .filter((td) => td.lead_id === t.id)
        .map((td) => ({ id: td.id, text: td.text, faellig_am: td.faellig_am })),
      besuche: besucheFor(t.name),
    }));
}
