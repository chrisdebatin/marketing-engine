"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Package, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PLACE_KINDS, placeKindLabel } from "@/lib/places";

type Kind = "flyer" | "box";

interface Placement {
  id: string;
  standort_name: string;
  menge: number | null;
  kind?: string;
  place_kind?: string | null;
  ort?: string | null;
  adresse?: string | null;
}

/** Bekannter Standort als Eingabe-Vorschlag (Autocomplete). */
export interface PlacementSuggestion {
  name: string;
  adresse: string | null;
  ort: string | null;
}

// base-ui Select zeigt über `items` das Label statt des Rohwerts an.
const PLACE_ITEMS = Object.fromEntries(PLACE_KINDS.map((p) => [p.key, p.label]));

export function PlacementBoard({
  token,
  initial,
  endpoint = "/api/public/placement",
  allowBoxes = false,
  suggestions = [],
}: {
  token: string;
  initial: Placement[];
  endpoint?: string;
  /** When true, the PDL can log delivered case-management boxes as well as flyers. */
  allowBoxes?: boolean;
  /** Bekannte Standorte des Hubs als Eingabe-Vorschläge. */
  suggestions?: PlacementSuggestion[];
}) {
  const [placements, setPlacements] = useState<Placement[]>(initial);
  const [kind, setKind] = useState<Kind>("flyer");
  const [standort, setStandort] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ortschaft, setOrtschaft] = useState("");
  const [placeKind, setPlaceKind] = useState<string>("");
  const [menge, setMenge] = useState("");

  // Bei exaktem Vorschlags-Treffer Adresse/Ort automatisch übernehmen.
  function onStandortChange(value: string) {
    setStandort(value);
    const match = suggestions.find(
      (s) => s.name.toLowerCase() === value.trim().toLowerCase(),
    );
    if (match) {
      if (match.adresse && !adresse) setAdresse(match.adresse);
      if (match.ort && !ortschaft) setOrtschaft(match.ort);
    }
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Inline-Bearbeitung eines eingetragenen Ortes
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMenge, setEditMenge] = useState("");
  const [editAdresse, setEditAdresse] = useState("");
  const [editOrt, setEditOrt] = useState("");
  const [editPlaceKind, setEditPlaceKind] = useState<string>("");
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
        body: JSON.stringify({
          token,
          standort_name: name,
          menge,
          kind,
          place_kind: placeKind,
          ort: ortschaft,
          adresse,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setPlacements((p) => [data.placement as Placement, ...p]);
      setStandort("");
      setAdresse("");
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
    setEditAdresse(p.adresse ?? "");
    setEditOrt(p.ort ?? "");
    setEditPlaceKind(p.place_kind ?? "sonstiges");
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
          place_kind: editPlaceKind,
          ort: editOrt,
          adresse: editAdresse,
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
              ? "Wo wurde die Case-Management-Box geliefert? (Name der Einrichtung)"
              : "Wo wurden Flyer ausgelegt? (Name der Einrichtung)"}
          </Label>
          <Input
            id="ort"
            value={standort}
            onChange={(e) => onStandortChange(e.target.value)}
            placeholder={
              isBox
                ? "z. B. Pflegedienst Sonnenschein, Station 3"
                : "z. B. Apotheke am Markt, Praxis Dr. Weber"
            }
            autoComplete="off"
            list="standort-vorschlaege"
          />
          {suggestions.length > 0 && (
            <datalist id="standort-vorschlaege">
              {suggestions.map((s) => (
                <option key={s.name} value={s.name}>
                  {[s.adresse, s.ort].filter(Boolean).join(", ")}
                </option>
              ))}
            </datalist>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="adresse">Adresse (Straße + Hausnr.)</Label>
          <Input
            id="adresse"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="z. B. Marktstraße 12"
            autoComplete="off"
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground">
            Bitte immer mit Adresse — nur „Empfang&rdquo; o. Ä. reicht nicht,
            damit wir den Ort später wiederfinden.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ortschaft">
            {isBox ? "In welchem Ort wurde geliefert?" : "In welchem Ort wurde ausgelegt?"}
          </Label>
          <Input
            id="ortschaft"
            value={ortschaft}
            onChange={(e) => setOrtschaft(e.target.value)}
            placeholder="Stadt/Ortschaft, z. B. Dorsten"
            autoComplete="off"
            maxLength={120}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Art des Ortes</Label>
          <Select
            items={PLACE_ITEMS}
            value={placeKind}
            onValueChange={(v) => setPlaceKind(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="z. B. Krankenhaus, Apotheke…" />
            </SelectTrigger>
            <SelectContent>
              {PLACE_KINDS.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <Button
          type="submit"
          disabled={
            saving ||
            !standort.trim() ||
            !placeKind ||
            !ortschaft.trim() ||
            adresse.trim().length < 5
          }
        >
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
                      <span className="min-w-0">
                        <span className="block truncate">
                          {p.standort_name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {placeKindLabel(p.place_kind)}
                          {p.adresse ? ` · ${p.adresse}` : ""}
                          {p.ort ? ` · ${p.ort}` : ""}
                        </span>
                      </span>
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
                      <Input
                        value={editAdresse}
                        onChange={(e) => setEditAdresse(e.target.value)}
                        placeholder="Adresse, z. B. Marktstraße 12"
                        autoComplete="off"
                        maxLength={200}
                      />
                      <Input
                        value={editOrt}
                        onChange={(e) => setEditOrt(e.target.value)}
                        placeholder="Stadt/Ortschaft, z. B. Dorsten"
                        autoComplete="off"
                        maxLength={120}
                      />
                      <Select
                        items={PLACE_ITEMS}
                        value={editPlaceKind}
                        onValueChange={(v) => setEditPlaceKind(v ?? "")}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Art des Ortes" />
                        </SelectTrigger>
                        <SelectContent>
                          {PLACE_KINDS.map((pk) => (
                            <SelectItem key={pk.key} value={pk.key}>
                              {pk.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
