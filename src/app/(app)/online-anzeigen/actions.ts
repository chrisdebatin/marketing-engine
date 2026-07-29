"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const KEYS = {
  laeuft: "online_ads_freitext",
  soll: "online_ads_soll",
} as const;

export type FreitextKey = keyof typeof KEYS;

/** Freitext speichern: "Was läuft gerade?" bzw. "Was soll laufen?". */
export async function saveOnlineAdsFreitext(
  key: FreitextKey,
  text: string,
): Promise<{ ok: boolean; error?: string; updatedAt?: string }> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, error: "Nur für Admins." };
  if (!(key in KEYS)) return { ok: false, error: "Unbekanntes Feld." };

  const updatedAt = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert({
    key: KEYS[key],
    value: { text: (text ?? "").slice(0, 5000), updated_at: updatedAt },
    updated_at: updatedAt,
  });
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return {
        ok: false,
        error:
          "Tabelle app_settings fehlt — bitte supabase/apply_all_pending.sql ausführen.",
      };
    }
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }
  revalidatePath("/online-anzeigen");
  return { ok: true, updatedAt };
}

/** Freitext laden. */
export async function loadOnlineAdsFreitext(
  key: FreitextKey,
): Promise<{ text: string; updatedAt: string | null }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", KEYS[key])
    .maybeSingle();
  const v = (data?.value ?? {}) as { text?: string; updated_at?: string };
  return { text: v.text ?? "", updatedAt: v.updated_at ?? null };
}

/**
 * KI-Erfassung: den "Was soll laufen?"-Freitext in einzelne Kampagnen-To-dos
 * zerlegen (Standort wird erkannt) und als offene Anfragen ins Kanban legen.
 */
export async function extractSollTodos(
  text: string,
): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, message: "Nur für Admins." };

  const clean = (text ?? "").trim().slice(0, 5000);
  if (clean.length < 5) {
    return { ok: false, message: "Bitte zuerst Text eintragen." };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, message: "KI derzeit nicht verfügbar (API-Key fehlt)." };
  }

  const admin = createAdminClient();
  const { data: hubs } = await admin.from("hubs").select("id, name").order("name");
  const hubList = (hubs ?? []).map((h, i) => `${i}: ${h.name}`).join("\n");

  // KI: Freitext → strukturierte Aufgaben (erzwungener Tool-Call)
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  let items: { standort_index: number; aufgabe: string }[] = [];
  try {
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
      max_tokens: 1200,
      tool_choice: { type: "tool", name: "todos" },
      tools: [
        {
          name: "todos",
          description: "Zerlegt den Planungs-Freitext in einzelne Kampagnen-Aufgaben.",
          input_schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    standort_index: {
                      type: "integer",
                      description:
                        "Index aus der Standort-Liste, wenn die Aufgabe eindeutig einem Standort zuzuordnen ist — sonst -1.",
                    },
                    aufgabe: {
                      type: "string",
                      description:
                        "Die Aufgabe als kurzer, vollständiger Satz (inkl. Plattform/Details aus dem Text).",
                    },
                  },
                  required: ["standort_index", "aufgabe"],
                },
              },
            },
            required: ["items"],
          },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Der Marketing-Leiter notiert frei, welche Anfragen der Standorte anstehen (Online-Anzeigen, Zeitungsanzeigen, Material-Wünsche, Flyer, Sonstiges). Zerlege den Text in einzelne Aufgaben und ordne sie den Standorten zu.

Standorte (Index: Name):
${hubList}

Freitext:
"""
${clean}
"""

Jede Anfrage/Aufgabe einzeln. Erfinde nichts dazu.`,
        },
      ],
    });
    const toolUse = msg.content.find(
      (c): c is import("@anthropic-ai/sdk").Anthropic.ToolUseBlock =>
        c.type === "tool_use",
    );
    items = ((toolUse?.input as { items?: typeof items })?.items ?? []).filter(
      (i) => i && typeof i.aufgabe === "string" && i.aufgabe.trim(),
    );
  } catch (err) {
    console.error("extractSollTodos: KI fehlgeschlagen", err);
    return {
      ok: false,
      message: "KI konnte den Text gerade nicht verarbeiten — bitte erneut versuchen.",
    };
  }
  if (items.length === 0) {
    return { ok: false, message: "Keine Aufgaben im Text erkannt." };
  }

  // Bestehende offene Anfragen laden (Dedupe) + Thema auflösen/anlegen.
  let { data: topic } = await admin
    .from("note_topics")
    .select("id")
    .ilike("title", "Kampagnen-Anfragen")
    .maybeSingle();
  if (!topic) {
    ({ data: topic } = await admin
      .from("note_topics")
      .insert({ title: "Kampagnen-Anfragen" })
      .select("id")
      .single());
  }
  if (!topic) return { ok: false, message: "Thema konnte nicht angelegt werden." };

  const { data: existing } = await admin
    .from("hub_notes")
    .select("hub_id, text")
    .eq("topic_id", topic.id)
    .is("done_at", null);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-zäöüß0-9]+/g, " ").trim();
  const seen = new Set(
    (existing ?? []).map((e) => `${e.hub_id}|${norm(e.text)}`),
  );

  let created = 0;
  let dup = 0;
  const unmatched: string[] = [];
  for (const item of items.slice(0, 20)) {
    const hub = (hubs ?? [])[item.standort_index];
    if (!hub) {
      unmatched.push(item.aufgabe.trim().slice(0, 80));
      continue;
    }
    const key = `${hub.id}|${norm(item.aufgabe)}`;
    if (seen.has(key)) {
      dup++;
      continue;
    }
    const { error } = await admin.from("hub_notes").insert({
      hub_id: hub.id,
      text: item.aufgabe.trim().slice(0, 2000),
      is_todo: true,
      topic_id: topic.id,
    });
    if (!error) {
      created++;
      seen.add(key);
    }
  }

  revalidatePath("/online-anzeigen");
  revalidatePath("/hubs");
  revalidatePath("/");
  const parts = [
    `${created} To-do${created === 1 ? "" : "s"} erstellt`,
    dup > 0 ? `${dup} schon vorhanden` : "",
    unmatched.length > 0
      ? `ohne erkennbaren Standort übersprungen: ${unmatched.join("; ")}`
      : "",
  ].filter(Boolean);
  return { ok: created > 0 || dup > 0, message: parts.join(" · ") };
}
