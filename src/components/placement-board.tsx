"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Kind = "flyer" | "box";

interface Placement {
  id: string;
  standort_name: string;
  menge: number | null;
  kind?: string;
}

export function PlacementBoard({
  token,
  initial,
  endpoint = "/api/public/placement",
  allowBoxes = false,
}: {
  token: string;
  initial: Placement[];
  endpoint?: string;
  /** When true, the PDL can log delivered case-management boxes as well as flyers. */
  allowBoxes?: boolean;
}) {
  const [placements, setPlacements] = useState<Placement[]>(initial);
  const [kind, setKind] = useState<Kind>("flyer");
  const [standort, setStandort] = useState("");
  const [menge, setMenge] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBox = kind === "box";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = standort.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, standort_name: name, menge, kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setPlacements((p) => [data.placement as Placement, ...p]);
      setStandort("");
      setMenge("");
      toast.success(isBox ? "Box gespeichert" : "Ort gespeichert");
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={add}
        className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
      >
        {allowBoxes && (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(
              [
                { k: "flyer", label: "Flyer ausgelegt", Icon: FileText },
                { k: "box", label: "Box geliefert", Icon: Package },
              ] as const
            ).map(({ k, label, Icon }) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  kind === k
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="ort">
            {isBox
              ? "Wo wurde die Case-Management-Box geliefert?"
              : "Wo wurden Flyer ausgelegt?"}
          </Label>
          <Input
            id="ort"
            value={standort}
            onChange={(e) => setStandort(e.target.value)}
            placeholder={
              isBox
                ? "z. B. Pflegedienst Sonnenschein, Station 3"
                : "z. B. Wartezimmer, Empfang, Apotheke am Markt"
            }
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="menge">Anzahl (optional)</Label>
          <Input
            id="menge"
            type="number"
            min={0}
            inputMode="numeric"
            value={menge}
            onChange={(e) => setMenge(e.target.value)}
            className="max-w-40"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving || !standort.trim()}>
          {saving
            ? "Speichere…"
            : isBox
              ? "Box hinzufügen"
              : "Ort hinzufügen"}
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">
          Eingetragen ({placements.length})
        </h2>
        {placements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch nichts eingetragen.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {placements.map((p) => {
              const box = p.kind === "box";
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md",
                        box
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      {box ? (
                        <Package className="size-4" />
                      ) : (
                        <FileText className="size-4" />
                      )}
                    </span>
                    <span className="truncate">{p.standort_name}</span>
                  </span>
                  {p.menge != null && (
                    <span className="shrink-0 text-muted-foreground">
                      {p.menge} Stück
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
