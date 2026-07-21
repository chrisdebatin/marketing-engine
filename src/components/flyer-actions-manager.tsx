"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  createFlyerAction,
  deleteFlyerAction,
  updateFlyerAction,
} from "@/app/(app)/flyeraktionen/actions";

export interface FlyerActionRow {
  id: string;
  action_date: string;
  anzahl: number;
  plz: string;
  inhalt: string;
  note: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE");
}

/** Formularfelder für Anlegen und Bearbeiten (identisch). */
function ActionFields({
  date,
  setDate,
  anzahl,
  setAnzahl,
  plz,
  setPlz,
  inhalt,
  setInhalt,
  note,
  setNote,
}: {
  date: string;
  setDate: (v: string) => void;
  anzahl: string;
  setAnzahl: (v: string) => void;
  plz: string;
  setPlz: (v: string) => void;
  inhalt: string;
  setInhalt: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Datum</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-fit"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Anzahl Flyer</Label>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={anzahl}
            onChange={(e) => setAnzahl(e.target.value)}
            placeholder="z. B. 5000"
            className="w-32"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label className="text-xs">PLZ (mehrere mit Komma)</Label>
          <Input
            value={plz}
            onChange={(e) => setPlz(e.target.value)}
            placeholder="z. B. 40210, 40211, 40213"
            autoComplete="off"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Inhalt / Motiv</Label>
        <Textarea
          value={inhalt}
          onChange={(e) => setInhalt(e.target.value)}
          placeholder="Was war auf dem Flyer? z. B. Pflegeberatung-Kampagne, Motiv Sommer, QR-Code zur Website…"
          rows={3}
          maxLength={1000}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Notiz (optional)</Label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="z. B. Verteiler-Dienstleister, Rücklauf…"
          autoComplete="off"
          maxLength={1000}
        />
      </div>
    </>
  );
}

/** Flyeraktionen: neue Aktion loggen, bestehende bearbeiten oder löschen. */
export function FlyerActionsManager({ initial }: { initial: FlyerActionRow[] }) {
  const [pending, startTransition] = useTransition();

  // Anlegen
  const [date, setDate] = useState(todayIso());
  const [anzahl, setAnzahl] = useState("");
  const [plz, setPlz] = useState("");
  const [inhalt, setInhalt] = useState("");
  const [note, setNote] = useState("");

  // Bearbeiten
  const [editId, setEditId] = useState<string | null>(null);
  const [eDate, setEDate] = useState("");
  const [eAnzahl, setEAnzahl] = useState("");
  const [ePlz, setEPlz] = useState("");
  const [eInhalt, setEInhalt] = useState("");
  const [eNote, setENote] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const canCreate = date && anzahl.trim() && plz.trim() && inhalt.trim();

  function create() {
    startTransition(async () => {
      const res = await createFlyerAction({
        action_date: date,
        anzahl,
        plz,
        inhalt,
        note,
      });
      if (res.ok) {
        toast.success("Flyeraktion gespeichert");
        setAnzahl("");
        setPlz("");
        setInhalt("");
        setNote("");
      } else {
        toast.error(res.error);
      }
    });
  }

  function startEdit(a: FlyerActionRow) {
    setEditId(a.id);
    setEDate(a.action_date);
    setEAnzahl(String(a.anzahl));
    setEPlz(a.plz);
    setEInhalt(a.inhalt);
    setENote(a.note ?? "");
    setConfirmDeleteId(null);
  }

  function saveEdit() {
    if (!editId) return;
    startTransition(async () => {
      const res = await updateFlyerAction(editId, {
        action_date: eDate,
        anzahl: eAnzahl,
        plz: ePlz,
        inhalt: eInhalt,
        note: eNote,
      });
      if (res.ok) {
        toast.success("Flyeraktion aktualisiert");
        setEditId(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteFlyerAction(id);
      if (res.ok) {
        toast.success("Flyeraktion gelöscht");
        setConfirmDeleteId(null);
        if (editId === id) setEditId(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  const totalFlyer = initial.reduce((s, a) => s + a.anzahl, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Neue Aktion */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold">
          <Megaphone className="size-4 text-primary" />
          Neue Flyeraktion loggen
        </h2>
        <ActionFields
          date={date}
          setDate={setDate}
          anzahl={anzahl}
          setAnzahl={setAnzahl}
          plz={plz}
          setPlz={setPlz}
          inhalt={inhalt}
          setInhalt={setInhalt}
          note={note}
          setNote={setNote}
        />
        <Button
          type="button"
          className="self-start"
          disabled={pending || !canCreate}
          onClick={create}
        >
          <Plus className="size-4" />
          {pending ? "Speichere…" : "Aktion speichern"}
        </Button>
      </div>

      {/* Liste */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">
          Durchgeführte Aktionen ({initial.length}
          {initial.length > 0 &&
            ` · ${totalFlyer.toLocaleString("de-DE")} Flyer gesamt`}
          )
        </h2>
        {initial.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Flyeraktionen geloggt.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {initial.map((a) => {
              const editing = editId === a.id;
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {formatDate(a.action_date)} ·{" "}
                        {a.anzahl.toLocaleString("de-DE")} Flyer
                      </p>
                      <p className="mt-1 text-sm">{a.inhalt}</p>
                      {a.note && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          „{a.note}&rdquo;
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {a.plz.split(/,\s*/).map((p) => (
                          <Badge key={p} variant="outline" className="tabular-nums">
                            PLZ {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        disabled={pending}
                        onClick={() =>
                          editing ? setEditId(null) : startEdit(a)
                        }
                        aria-label="Aktion bearbeiten"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {confirmDeleteId === a.id ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={pending}
                          onClick={() => remove(a.id)}
                        >
                          {pending ? "Lösche…" : "Wirklich löschen?"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={pending}
                          onClick={() => setConfirmDeleteId(a.id)}
                          aria-label="Aktion löschen"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {editing && (
                    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
                      <ActionFields
                        date={eDate}
                        setDate={setEDate}
                        anzahl={eAnzahl}
                        setAnzahl={setEAnzahl}
                        plz={ePlz}
                        setPlz={setEPlz}
                        inhalt={eInhalt}
                        setInhalt={setEInhalt}
                        note={eNote}
                        setNote={setENote}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={saveEdit}
                        >
                          {pending ? "Speichere…" : "Speichern"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => setEditId(null)}
                        >
                          Abbrechen
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
