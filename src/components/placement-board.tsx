"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Package, Pencil, Trash2 } from "lucide-react";
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
  // Inline-Bearbeitung eines eingetragenen Ortes
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMenge, setEditMenge] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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

  function startEdit(p: Placement) {
    setEditId(p.id);
    setEditName(p.standort_name);
    setEditMenge(p.menge != null ? String(p.menge) : "");
  }

  async function removeEntry(p: Placement) {
    if (editSaving) return;
    setEditSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, id: p.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      setPlacements((prev) => prev.filter((x) => x.id !== p.id));
      setEditId(null);
      toast.success("Eintrag gelöscht");
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setEditSaving(false);
    }
  }

  async function saveEdit() {
    const name = editName.trim();
    if (!name || !editId || editSaving) return;
    setEditSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          id: editId,
          standort_name: name,
          menge: editMenge,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setPlacements((prev) =>
        prev.map((p) =>
          p.id === editId ? { ...p, ...(data.placement as Placement) } : p,
        ),
      );
      setEditId(null);
      toast.success("Eintrag aktualisiert");
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setEditSaving(false);
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
              const editing = editId === p.id;
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
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
                    <span className="flex shrink-0 items-center gap-2">
                      {p.menge != null && (
                        <span className="text-muted-foreground">
                          {p.menge} Stück
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => (editing ? setEditId(null) : startEdit(p))}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Eintrag bearbeiten"
                        aria-label={`${p.standort_name} bearbeiten`}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </span>
                  </div>

                  {editing && (
                    <div className="flex flex-col gap-2 border-t pt-2.5">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Ort"
                          autoComplete="off"
                          className="sm:flex-1"
                        />
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={editMenge}
                          onChange={(e) => setEditMenge(e.target.value)}
                          placeholder="Anzahl (optional)"
                          className="sm:w-40"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={editSaving || !editName.trim()}
                          onClick={() => void saveEdit()}
                        >
                          {editSaving ? "Speichere…" : "Speichern"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={editSaving}
                          onClick={() => setEditId(null)}
                        >
                          Abbrechen
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={editSaving}
                          onClick={() => void removeEntry(p)}
                        >
                          <Trash2 className="size-3.5" />
                          Eintrag löschen
                        </Button>
                      </div>
                    </div>
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
