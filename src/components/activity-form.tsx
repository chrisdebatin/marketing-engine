"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Package } from "lucide-react";
import { activityInputSchema, type ActivityInput } from "@/lib/schemas";
import { enqueueCreate, enqueueUpdate } from "@/lib/offline/queue";
import { cn } from "@/lib/utils";
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
import type { ActivityType } from "@/lib/types";

interface HubOption {
  id: string;
  name: string;
}
interface MaterialOption {
  id: string;
  name: string;
}
interface StandortSuggestion {
  hub_id: string;
  name: string;
}

export interface ActivityFormInitial {
  id: string;
  hub_id: string;
  standort_name: string;
  type: ActivityType;
  occurred_on: string;
  note: string | null;
  details: Record<string, unknown>;
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ActivityForm({
  hubs,
  materialTypes,
  standorte,
  mode = "create",
  initial,
}: {
  hubs: HubOption[];
  materialTypes: MaterialOption[];
  standorte: StandortSuggestion[];
  mode?: "create" | "edit";
  initial?: ActivityFormInitial;
}) {
  const router = useRouter();

  const [hubId, setHubId] = useState(initial?.hub_id ?? hubs[0]?.id ?? "");
  const [type, setType] = useState<ActivityType>(initial?.type ?? "flyer");
  const [standortName, setStandortName] = useState(initial?.standort_name ?? "");
  const [occurredOn, setOccurredOn] = useState(initial?.occurred_on ?? today());
  const [note, setNote] = useState(initial?.note ?? "");
  const [materialTypeId, setMaterialTypeId] = useState(
    (initial?.details?.material_type_id as string) ?? materialTypes[0]?.id ?? "",
  );
  const [menge, setMenge] = useState(
    initial?.details?.menge != null ? String(initial.details.menge) : "",
  );
  const [anzahlBoxen, setAnzahlBoxen] = useState(
    initial?.details?.anzahl_boxen != null
      ? String(initial.details.anzahl_boxen)
      : "",
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const hubSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          standorte.filter((s) => s.hub_id === hubId).map((s) => s.name),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [standorte, hubId],
  );

  function buildPayload(): ActivityInput | null {
    const base = {
      hub_id: hubId,
      standort_name: standortName,
      occurred_on: occurredOn,
      note,
    };
    const raw =
      type === "flyer"
        ? {
            ...base,
            type: "flyer" as const,
            details: { material_type_id: materialTypeId, menge },
          }
        : {
            ...base,
            type: "box" as const,
            details: { anzahl_boxen: anzahlBoxen },
          };

    const result = activityInputSchema.safeParse(raw);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        next[issue.path.join(".")] = issue.message;
      }
      setErrors(next);
      return null;
    }
    setErrors({});
    return result.data;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    if (!payload) return;

    setSubmitting(true);
    try {
      if (mode === "edit" && initial) {
        await enqueueUpdate(initial.id, payload);
        toast.success("Eintrag aktualisiert");
        router.push("/eintraege");
      } else {
        await enqueueCreate(payload);
        toast.success("Aktivität erfasst");
        // reset for fast repeated entry
        setStandortName("");
        setMenge("");
        setAnzahlBoxen("");
        setNote("");
      }
      router.refresh();
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  }

  const err = (k: string) =>
    errors[k] ? <p className="text-sm text-destructive">{errors[k]}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {hubs.length > 1 && (
        <div className="flex flex-col gap-2">
          <Label>Hub</Label>
          <Select
            items={Object.fromEntries(hubs.map((h) => [h.id, h.name]))}
            value={hubId}
            onValueChange={(v) => setHubId(v ?? "")}
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
          {err("hub_id")}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>Art der Aktivität</Label>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(
            [
              { v: "flyer", label: "Flyer/Aufsteller", Icon: FileText },
              { v: "box", label: "Box beliefert", Icon: Package },
            ] as const
          ).map(({ v, label, Icon }) => (
            <button
              key={v}
              type="button"
              onClick={() => setType(v)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                type === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="standort">Auslage-Ort</Label>
        <Input
          id="standort"
          list="standort-suggestions"
          value={standortName}
          onChange={(e) => setStandortName(e.target.value)}
          placeholder="z. B. Praxis Dr. Müller, Apotheke am Markt …"
          autoComplete="off"
        />
        <datalist id="standort-suggestions">
          {hubSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {err("standort_name")}
      </div>

      {type === "flyer" ? (
        <>
          <div className="flex flex-col gap-2">
            <Label>Material</Label>
            <Select
              items={Object.fromEntries(
                materialTypes.map((m) => [m.id, m.name]),
              )}
              value={materialTypeId}
              onValueChange={(v) => setMaterialTypeId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Material wählen" />
              </SelectTrigger>
              <SelectContent>
                {materialTypes.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("details.material_type_id")}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="menge">Menge</Label>
            <Input
              id="menge"
              type="number"
              inputMode="numeric"
              min={1}
              value={menge}
              onChange={(e) => setMenge(e.target.value)}
            />
            {err("details.menge")}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="anzahl">Anzahl Boxen</Label>
          <Input
            id="anzahl"
            type="number"
            inputMode="numeric"
            min={1}
            value={anzahlBoxen}
            onChange={(e) => setAnzahlBoxen(e.target.value)}
          />
          {err("details.anzahl_boxen")}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="datum">Datum</Label>
        <Input
          id="datum"
          type="date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
        />
        {err("occurred_on")}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="note">Notiz (optional)</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </div>

      <Button type="submit" disabled={submitting || !hubId}>
        {submitting
          ? "Speichern…"
          : mode === "edit"
            ? "Änderungen speichern"
            : "Erfassen"}
      </Button>
    </form>
  );
}
