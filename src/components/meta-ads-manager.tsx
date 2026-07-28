"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CirclePause, ExternalLink, Plus, Rocket, Trash2 } from "lucide-react";
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
import { createMetaAd, deleteMetaAd, endMetaAd } from "@/app/(app)/meta-ads/actions";

export interface MetaAdRow {
  id: string;
  name: string;
  typ: string;
  hub_id: string | null;
  start_date: string;
  end_date: string | null;
  budget: string | null;
  ziel: string | null;
  link: string | null;
  notiz: string | null;
}

export function adStatus(
  ad: { start_date: string; end_date: string | null },
  today: string,
): "laeuft" | "geplant" | "beendet" {
  if (ad.start_date > today) return "geplant";
  if (ad.end_date && ad.end_date < today) return "beendet";
  return "laeuft";
}

/**
 * Meta-Ads-Verwaltung: laufende, geplante und beendete Kampagnen —
 * allgemeine (gruppenweit) und lokale (je Standort).
 */
export function MetaAdsManager({
  ads,
  hubs,
}: {
  ads: MetaAdRow[];
  hubs: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [typ, setTyp] = useState<"allgemein" | "lokal">("allgemein");
  const [hubId, setHubId] = useState("");
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState("");
  const [budget, setBudget] = useState("");
  const [ziel, setZiel] = useState("");
  const [link, setLink] = useState("");

  const today = todayIso();
  const hubItems = Object.fromEntries(hubs.map((h) => [h.id, h.name]));
  const hubName = (id: string | null) =>
    hubs.find((h) => h.id === id)?.name ?? "—";

  function create() {
    if (pending) return;
    if (!name.trim()) {
      toast.error("Kampagnen-Name eingeben.");
      return;
    }
    if (typ === "lokal" && !hubId) {
      toast.error("Standort für die lokale Kampagne wählen.");
      return;
    }
    startTransition(async () => {
      const r = await createMetaAd({
        name,
        typ,
        hub_id: hubId,
        start_date: start,
        end_date: end,
        budget,
        ziel,
        link,
      });
      if (r.ok) {
        toast.success("Kampagne angelegt");
        setName("");
        setEnd("");
        setBudget("");
        setZiel("");
        setLink("");
      } else {
        toast.error(r.error);
      }
    });
  }

  const groups: ["laeuft" | "geplant" | "beendet", string][] = [
    ["laeuft", "Läuft gerade"],
    ["geplant", "Geplant"],
    ["beendet", "Beendet"],
  ];

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 text-sm font-medium transition-colors select-none",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "bg-background text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex flex-col gap-5">
      {/* Anlegen */}
      <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Rocket className="size-4 text-primary" />
          Neue Kampagne eintragen
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTyp("allgemein");
              setHubId("");
            }}
            className={chip(typ === "allgemein")}
          >
            Allgemeine Kampagne
          </button>
          <button
            type="button"
            onClick={() => setTyp("lokal")}
            className={chip(typ === "lokal")}
          >
            Lokale Kampagne
          </button>
          {typ === "lokal" && (
            <Select
              items={hubItems}
              value={hubId}
              onValueChange={(v) => setHubId(v ?? "")}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Standort wählen" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(hubItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kampagnen-Name, z. B. „Leadgen Intensivpflege NRW“"
            maxLength={200}
            className="bg-background sm:flex-1"
          />
          <Input
            value={ziel}
            onChange={(e) => setZiel(e.target.value)}
            placeholder="Ziel (optional), z. B. Leads, Recruiting"
            maxLength={200}
            className="bg-background sm:w-64"
          />
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
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Budget, z. B. 20 €/Tag"
            maxLength={100}
            className="w-40 bg-background"
          />
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link (Ads Manager / Anzeige, optional)"
            maxLength={500}
            className="min-w-56 flex-1 bg-background"
          />
          <Button type="button" disabled={pending} onClick={create}>
            <Plus className="size-4" />
            {pending ? "Speichere…" : "Kampagne anlegen"}
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
                Aktuell läuft keine Kampagne.
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
                      <span className="font-medium">{a.name}</span>
                      <Badge
                        variant="outline"
                        className={
                          a.typ === "allgemein"
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-chart-5/40 bg-chart-5/10 text-chart-5"
                        }
                      >
                        {a.typ === "allgemein"
                          ? "Allgemein"
                          : `Lokal · ${hubName(a.hub_id)}`}
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
                            title="Kampagne beenden (bis heute)"
                            aria-label="Kampagne beenden"
                            onClick={() => {
                              if (window.confirm(`„${a.name}“ beenden?`)) {
                                startTransition(async () => {
                                  const r = await endMetaAd(a.id);
                                  if (r.ok) toast.success("Kampagne beendet");
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
                          aria-label="Kampagne löschen"
                          onClick={() => {
                            if (window.confirm(`„${a.name}“ löschen?`)) {
                              startTransition(async () => {
                                const r = await deleteMetaAd(a.id);
                                if (r.ok) toast.success("Kampagne gelöscht");
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
                      {a.budget ? ` · ${a.budget}` : ""}
                      {a.ziel ? ` · Ziel: ${a.ziel}` : ""}
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
