"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import { copyText } from "@/lib/clipboard";

interface HubOption {
  id: string;
  name: string;
}

interface Row {
  hub_id: string;
  hub_input: string;
  flyer_count: string;
  box_count: string;
  aufsteller_count: string;
  note: string;
}

interface CreatedLink {
  hub_name: string;
  flyer_count: number;
  box_count: number;
  aufsteller_count: number;
  token: string;
  url: string;
}

export function DeliveryComposer({ hubs }: { hubs: HubOption[] }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedLink[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function parse() {
    if (!text.trim() || parsing) return;
    setParsing(true);
    setError(null);
    try {
      const res = await fetch("/api/deliveries/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Auswertung fehlgeschlagen.");
        return;
      }
      type Parsed = {
        hub_id: string | null;
        hub_input: string;
        flyer_count: number;
        box_count: number;
        aufsteller_count: number;
        note: string;
      };
      const next: Row[] = (data.deliveries as Parsed[]).map((d) => ({
        hub_id: d.hub_id ?? "",
        hub_input: d.hub_input,
        flyer_count: String(d.flyer_count),
        box_count: String(d.box_count),
        aufsteller_count: String(d.aufsteller_count ?? 0),
        note: d.note,
      }));
      setRows(next.length ? next : [emptyRow()]);
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setParsing(false);
    }
  }

  function emptyRow(): Row {
    return {
      hub_id: "",
      hub_input: "",
      flyer_count: "",
      box_count: "",
      aufsteller_count: "",
      note: "",
    };
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function create() {
    const valid = rows.filter((r) => r.hub_id);
    if (valid.length === 0) {
      setError("Bitte jeder Zeile einen Hub zuordnen.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveries: valid.map((r) => ({
            hub_id: r.hub_id,
            flyer_count: Number(r.flyer_count) || 0,
            box_count: Number(r.box_count) || 0,
            aufsteller_count: Number(r.aufsteller_count) || 0,
            note: r.note,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Anlegen fehlgeschlagen.");
        return;
      }
      const origin = window.location.origin;
      // One stable link per PDL (hub); merge multiple deliveries to the same hub.
      const byToken = new Map<string, CreatedLink>();
      for (const d of data.deliveries as Omit<CreatedLink, "url">[]) {
        const existing = byToken.get(d.token);
        if (existing) {
          existing.flyer_count += d.flyer_count;
          existing.aufsteller_count += d.aufsteller_count;
          existing.box_count += d.box_count;
        } else {
          byToken.set(d.token, { ...d, url: `${origin}/h/${d.token}` });
        }
      }
      setCreated([...byToken.values()]);
      setRows([]);
      setText("");
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setCreating(false);
    }
  }

  async function copy(url: string) {
    if (await copyText(url)) {
      toast.success("Link kopiert");
    } else {
      toast.error("Kopieren nicht möglich");
    }
  }

  if (created.length > 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Lieferungen angelegt. Schick jeder Pflege-Dienstleitung ihren festen
          Link – der bleibt pro PDL immer gleich. Dort trägt sie ein, wo Flyer
          ausgelegt und Boxen geliefert wurden.
        </p>
        {created.map((c) => (
          <Card key={c.token}>
            <CardHeader>
              <CardTitle className="text-base">
                {c.hub_name} · {c.flyer_count} Flyer · {c.aufsteller_count}{" "}
                Aufsteller · {c.box_count} Boxen
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input readOnly value={c.url} className="font-mono text-xs" />
              <Button type="button" onClick={() => copy(c.url)}>
                Link kopieren
              </Button>
            </CardContent>
          </Card>
        ))}
        <Button variant="outline" onClick={() => setCreated([])}>
          Weitere Lieferung erfassen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="text">Was hast du geliefert?</Label>
        <Textarea
          id="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="z. B. 50 Flyer, 2 Aufsteller und 3 Boxen an Dorsten, 20 Flyer an Hameln"
        />
        <div className="flex gap-2">
          <Button type="button" onClick={parse} disabled={parsing || !text.trim()}>
            {parsing ? "Werte aus…" : "Auswerten"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRows((r) => [...r, emptyRow()])}
          >
            Zeile manuell
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {rows.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Prüfe & korrigiere die Zuordnung, dann anlegen:
          </p>
          {rows.map((row, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Label className="mb-1 block text-xs">
                      Hub{row.hub_input ? ` (erkannt: „${row.hub_input}“)` : ""}
                    </Label>
                    <Select
                      items={Object.fromEntries(
                        hubs.map((h) => [h.id, h.name]),
                      )}
                      value={row.hub_id}
                      onValueChange={(v) => update(i, { hub_id: v ?? "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Hub wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {hubs.map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-5"
                    onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                    aria-label="Zeile entfernen"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="mb-1 block text-xs">Flyer</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={row.flyer_count}
                      onChange={(e) => update(i, { flyer_count: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs">Aufsteller</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={row.aufsteller_count}
                      onChange={(e) =>
                        update(i, { aufsteller_count: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs">Boxen</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={row.box_count}
                      onChange={(e) => update(i, { box_count: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button type="button" onClick={create} disabled={creating}>
            {creating ? "Lege an…" : "Lieferungen anlegen & Links erstellen"}
          </Button>
        </div>
      )}
    </div>
  );
}
