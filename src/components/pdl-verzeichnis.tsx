"use client";

import { useState } from "react";
import { Mail, MapPin, Phone, Search, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PdlEintrag {
  id: string;
  name: string;
  region: string | null;
  pdl: string | null;
  telefon: string | null;
  email: string | null;
  adresse: string | null;
}

/**
 * Durchsuchbares Standort-Verzeichnis. Telefon und E-Mail sind Links —
 * am Handy startet ein Tippen direkt den Anruf.
 */
export function PdlVerzeichnis({
  eintraege,
  ohneTelefon,
}: {
  eintraege: PdlEintrag[];
  ohneTelefon: number;
}) {
  const [suche, setSuche] = useState("");

  const q = suche.trim().toLowerCase();
  const gefiltert = q
    ? eintraege.filter((e) =>
        [e.name, e.pdl, e.region, e.telefon, e.email, e.adresse]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : eintraege;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Standort, PDL-Name oder Ort suchen…"
          className="h-11 pl-9"
        />
      </div>

      {ohneTelefon > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Bei <b>{ohneTelefon}</b> von {eintraege.length} Standorten fehlt die
            Telefonnummer. Ergänzen lässt sie sich unter{" "}
            <span className="font-medium">Hubs</span> — dann steht sie hier
            automatisch.
          </span>
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        {gefiltert.length} von {eintraege.length} Standorten
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {gefiltert.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="min-w-0">
              <p className="font-semibold">{e.name}</p>
              <p className="text-sm text-muted-foreground">
                {e.pdl ? `PDL ${e.pdl}` : "keine PDL hinterlegt"}
                {e.region ? ` · ${e.region}` : ""}
              </p>
            </div>

            <div className="mt-auto flex flex-col gap-1.5 border-t pt-2 text-sm">
              {e.telefon ? (
                <a
                  href={`tel:${e.telefon.replace(/\s/g, "")}`}
                  className="flex items-center gap-2 font-medium text-primary hover:underline"
                >
                  <Phone className="size-3.5 shrink-0" />
                  {e.telefon}
                </a>
              ) : (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-3.5 shrink-0" />
                  keine Nummer hinterlegt
                </span>
              )}
              {e.email && (
                <a
                  href={`mailto:${e.email}`}
                  className="flex items-center gap-2 truncate font-medium text-primary hover:underline"
                  title={e.email}
                >
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{e.email}</span>
                </a>
              )}
              {e.adresse && (
                <span className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  {e.adresse}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {gefiltert.length === 0 && (
        <p className={cn("rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm")}>
          Kein Standort gefunden. Suchbegriff prüfen oder Suche leeren.
        </p>
      )}
    </div>
  );
}
