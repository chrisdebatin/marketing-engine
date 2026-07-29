"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  BriefcaseBusiness,
  CirclePause,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatIsoDate, todayIso } from "@/lib/crm";
import { PERSONAL_PLATTFORMEN, plattformLabel } from "@/lib/personal";
import {
  createPersonalAd,
  deletePersonalAd,
  endPersonalAd,
} from "@/app/(app)/personal-anzeigen/actions";

export interface PersonalAdRow {
  id: string;
  titel: string;
  plattform: string;
  hub_id: string | null;
  start_date: string;
  end_date: string | null;
  link: string | null;
  notiz: string | null;
}

function adStatus(
  ad: { start_date: string; end_date: string | null },
  today: string,
): "laeuft" | "geplant" | "beendet" {
  if (ad.start_date > today) return "geplant";
  if (ad.end_date && ad.end_date < today) return "beendet";
  return "laeuft";
}

const ALLE = "__alle__";

/**
 * Personal-Anzeigen (Recruiting): welche Stellenanzeigen laufen wo —
 * je Standort oder für alle, auf Meta, Join, Indeed & Co.
 */
export function PersonalAdsManager({
  ads,
  hubs,
}: {
  ads: PersonalAdRow[];
  hubs: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [titel, setTitel] = useState("");
  const [plattform, setPlattform] = useState("");
  const [andere, setAndere] = useState(false);
  const [customPlattform, setCustomPlattform] = useState("");
  const [hubId, setHubId] = useState(ALLE);
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState("");
  const [link, setLink] = useState("");

  const today = todayIso();
  const hubItems = {
    [ALLE]: "Alle Standorte",
    ...Object.fromEntries(hubs.map((h) => [h.id, h.name])),
  };
  const hubName = (id: string | null) =>
    id ? (hubs.find((h) => h.id === id)?.name ?? "—") : "Alle Standorte";

  function create() {
    if (pending) return;
    const eff = andere ? customPlattform.trim() : plattform;
    if (!titel.trim()) {
      toast.error("Stellentitel eingeben.");
      return;
    }
    if (!eff) {
      toast.error("Plattform wählen oder eintragen.");
      return;
    }
    startTransition(async () => {
      const r = await createPersonalAd({
        titel,
        plattform: eff,
        hub_id: hubId === ALLE ? "" : hubId,
        start_date: start,
        end_date: end,
        link,
      });
      if (r.ok) {
        toast.success("Personal-Anzeige angelegt");
        setTitel("");
        setEnd("");
        setLink("");
      } else {
        toast.error(r.error);
      }
    });
  }

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 text-sm font-medium transition-colors select-none",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "bg-background text-muted-foreground hover:text-foreground",
    );

  const groups: ["laeuft" | "geplant" | "beendet", string][] = [
    ["laeuft", "Läuft gerade"],
    ["geplant", "Geplant"],
    ["beendet", "Beendet"],
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Anlegen */}
      <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <BriefcaseBusiness className="size-4 text-primary" />
          Neue Personal-Anzeige eintragen
        </p>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Plattform (Pflicht)
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {PERSONAL_PLATTFORMEN.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPlattform(p.key);
                  setAndere(false);
                }}
                className={chip(!andere && plattform === p.key)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setAndere(true);
                setPlattform("");
              }}
              className={chip(andere)}
            >
              Andere
            </button>
            {andere && (
              <Input
                value={customPlattform}
                onChange={(e) => setCustomPlattform(e.target.value)}
                placeholder="Plattform eintragen"
                autoComplete="off"
                maxLength={100}
                className="w-48 bg-background"
                autoFocus
              />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="Stellentitel, z. B. Pflegefachkraft (m/w/d)"
            maxLength={200}
            className="min-w-64 flex-1 bg-background"
          />
          <Select
            items={hubItems}
            value={hubId}
            onValueChange={(v) => setHubId(v ?? ALLE)}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(hubItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            von
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-40 bg-background"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            bis
            <Input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-40 bg-background"
            />
            <span className="text-xs">(leer = läuft weiter)</span>
          </label>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link zur Anzeige (optional)"
            maxLength={500}
            className="min-w-56 flex-1 bg-background"
          />
          <Button type="button" disabled={pending} onClick={create}>
            <Plus className="size-4" />
            {pending ? "Speichere…" : "Anzeige anlegen"}
          </Button>
        </div>
      </div>

      {/* Gruppen */}
      {groups.map(([key, title]) => {
        const list = ads
          .filter((a) => adStatus(a, today) === key)
          .sort((a, b) => b.start_date.localeCompare(a.start_date));
        if (list.length === 0 && key !== "laeuft") return null;
        return (
          <section key={key} className="flex flex-col gap-2">
            <p className="flex items-center gap-2 font-semibold">
              {title}
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                {list.length}
              </span>
            </p>
            {list.length === 0 ? (
              <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">
                Aktuell läuft keine Personal-Anzeige.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {list.map((a) => (
                  <li
                    key={a.id}
                    className={cn(
                      "flex flex-col gap-1 rounded-xl border bg-card p-3.5 shadow-sm",
                      key === "laeuft" && "border-chart-4/40",
                      key === "beendet" && "opacity-70",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {key === "laeuft" && (
                        <span
                          className="size-2 shrink-0 animate-pulse rounded-full bg-chart-4"
                          aria-hidden
                        />
                      )}
                      <span className="font-medium">{a.titel}</span>
                      <Badge
                        variant="outline"
                        className="border-primary/40 bg-primary/10 text-primary"
                      >
                        {plattformLabel(a.plattform)}
                      </Badge>
                      <Badge variant="outline" className="text-muted-foreground">
                        {hubName(a.hub_id)}
                      </Badge>
                      {a.link && (
                        <a
                          href={a.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary underline"
                        >
                          <ExternalLink className="size-3" />
                          Anzeige
                        </a>
                      )}
                      <span className="ml-auto flex items-center gap-1">
                        {key !== "beendet" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground"
                            disabled={pending}
                            title="Anzeige beenden (bis heute)"
                            aria-label="Anzeige beenden"
                            onClick={() => {
                              if (window.confirm(`„${a.titel}“ beenden?`)) {
                                startTransition(async () => {
                                  const r = await endPersonalAd(a.id);
                                  if (r.ok) toast.success("Anzeige beendet");
                                  else toast.error(r.error);
                                });
                              }
                            }}
                          >
                            <CirclePause className="size-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={pending}
                          title="Löschen"
                          aria-label="Anzeige löschen"
                          onClick={() => {
                            if (window.confirm(`„${a.titel}“ löschen?`)) {
                              startTransition(async () => {
                                const r = await deletePersonalAd(a.id);
                                if (r.ok) toast.success("Anzeige gelöscht");
                                else toast.error(r.error);
                              });
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatIsoDate(a.start_date)} –{" "}
                      {a.end_date ? formatIsoDate(a.end_date) : "offen"}
                      {a.notiz ? ` · ${a.notiz}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
