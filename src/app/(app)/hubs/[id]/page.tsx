import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  User,
  Phone,
  Mail,
  Building2,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CopyLink } from "@/components/copy-link";
import { DeleteHubButton } from "@/components/delete-hub-button";
import { DeliveryAdd } from "@/components/delivery-add";
import { HubNotes } from "@/components/hub-notes";
import { DeliveryEdit } from "@/components/delivery-edit";
import { HubTags } from "@/components/md-tag";
import { HubTaskChips } from "@/components/hub-task-chips";
import { pdlRoleLabel, pdlRoleShort } from "@/lib/leistungen";
import { splitPdlEmails, splitPdlNames, splitPdlPhones } from "@/lib/pdl";

export const dynamic = "force-dynamic";

export default async function HubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Hub aus der Session (Service-Role-Client, MD-Scoping inklusive) —
  // gleiches Muster wie die Hub-Übersicht, unabhängig von RLS/Anon-Key.
  const session = await requireSession();
  const hub = session.hubs.find((h) => h.id === id);
  if (!hub) notFound();

  const admin = createAdminClient();
  const [
    { data: deliveries },
    { data: placements },
    { data: taskRows },
    { data: checkRows },
    { data: noteRows },
  ] = await Promise.all([
    admin
      .from("deliveries")
      .select(
        "id, flyer_count, box_count, aufsteller_count, note, share_token, created_at",
      )
      .eq("hub_id", id)
      .order("created_at", { ascending: false }),
    admin.from("delivery_placements").select("id").eq("hub_id", id),
    admin.from("hub_tasks").select("id, title").order("created_at"),
    admin.from("hub_task_checks").select("task_id").eq("hub_id", id),
    // Fallback ?? [] — fehlt Migration 0021, darf die Seite nicht crashen.
    admin
      .from("hub_notes")
      .select("id, text, is_todo, done_at, created_at")
      .eq("hub_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const tasks = taskRows ?? [];
  const doneTaskIds = new Set((checkRows ?? []).map((c) => c.task_id));

  const flyers = (deliveries ?? []).reduce((s, d) => s + (d.flyer_count ?? 0), 0);
  const aufsteller = (deliveries ?? []).reduce(
    (s, d) => s + (d.aufsteller_count ?? 0),
    0,
  );
  const boxes = (deliveries ?? []).reduce((s, d) => s + (d.box_count ?? 0), 0);
  const placementCount = (placements ?? []).length;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/hubs"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zurück zu den Hubs
      </Link>

      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {hub.name}
            </h1>
            <HubTags
              md={hub.responsible_md}
              pdl={hub.pdl_name}
              pdlRole={pdlRoleShort(hub.name)}
            />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="size-3.5" />
              MD: {hub.responsible_md ?? "—"}
            </span>
            {hub.region && (
              <>
                <span aria-hidden>·</span>
                <span>{hub.region}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Adresse" icon={MapPin} value={hub.address} />
            <Detail
              label={`Lokale ${pdlRoleLabel(hub.name)}`}
              icon={User}
              value={splitPdlNames(hub.pdl_name).join(" & ") || null}
            />
            <Detail
              label={`${pdlRoleShort(hub.name)} Telefon`}
              icon={Phone}
              values={splitPdlPhones(hub.pdl_phone).map((phone) => ({
                text: phone,
                href: `tel:${phone}`,
              }))}
            />
            <Detail
              label={`${pdlRoleShort(hub.name)} E-Mail`}
              icon={Mail}
              values={splitPdlEmails(hub.pdl_email).map((email) => ({
                text: email,
                href: `mailto:${email}`,
              }))}
            />
          </div>

          <div className="flex flex-wrap gap-1.5 border-t pt-4">
            <Badge variant="outline">{flyers} Flyer</Badge>
            <Badge variant="outline">{aufsteller} Aufsteller</Badge>
            <Badge variant="outline">{boxes} Boxen</Badge>
            <Badge variant={placementCount > 0 ? "secondary" : "outline"}>
              {placementCount} Orte
            </Badge>
          </div>

          {tasks.length > 0 && (
            <div className="border-t pt-4">
              <HubTaskChips
                hubId={hub.id}
                chips={tasks.map((t) => ({
                  taskId: t.id,
                  title: t.title,
                  done: doneTaskIds.has(t.id),
                }))}
              />
            </div>
          )}

          <div className="border-t pt-4">
            <CopyLink
              token={hub.share_token}
              prefix="/h"
              label={`${pdlRoleShort(hub.name)}-Link kopieren`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notizen & offene To-dos zu diesem Standort */}
      <Card>
        <CardContent className="p-5">
          <HubNotes hubId={hub.id} initial={noteRows ?? []} />
        </CardContent>
      </Card>

      {/* Inventar: was dieser Hub geliefert bekommen hat — editierbar */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div>
            <p className="font-medium">
              Inventar — erhaltene Lieferungen ({(deliveries ?? []).length})
            </p>
            <p className="text-sm text-muted-foreground">
              Alles, was dieser Hub von dir bekommen hat. Über „Bearbeiten&rdquo;
              lassen sich Mengen und Notiz korrigieren, Löschen entfernt die
              Lieferung.
            </p>
          </div>
          <DeliveryAdd hubId={hub.id} />
          {(deliveries ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Lieferungen an diesen Hub.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(deliveries ?? []).map((d) => (
                <li
                  key={d.id}
                  className="flex flex-col gap-2 rounded-lg border bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{d.flyer_count} Flyer</Badge>
                      {d.aufsteller_count > 0 && (
                        <Badge variant="outline">
                          {d.aufsteller_count} Aufsteller
                        </Badge>
                      )}
                      {d.box_count > 0 && (
                        <Badge variant="outline">{d.box_count} Boxen</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString("de-DE")}
                      {d.note ? ` · ${d.note}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <DeliveryEdit
                      delivery={{
                        id: d.id,
                        flyer_count: d.flyer_count,
                        aufsteller_count: d.aufsteller_count,
                        box_count: d.box_count,
                        note: d.note,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {session.isAdmin && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Hub löschen</p>
              <p className="text-sm text-muted-foreground">
                Entfernt den Hub dauerhaft — inklusive aller Einträge,
                Lieferungen, Auslage-Orte und Patienten-Meldungen dieses Hubs.
                Bestellungen bleiben ohne Hub-Bezug erhalten.
              </p>
            </div>
            <DeleteHubButton hubId={hub.id} hubName={hub.name} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({
  label,
  icon: Icon,
  value,
  href,
  values,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value?: string | null;
  href?: string;
  /** Mehrere Werte (z. B. zwei PDL-E-Mails) — je Eintrag ein eigener Link. */
  values?: { text: string; href?: string }[];
}) {
  const list =
    values ?? (value ? [{ text: value, href }] : []);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {list.length === 0 ? (
        <span className="text-sm text-muted-foreground">—</span>
      ) : (
        list.map((v) =>
          v.href ? (
            <a
              key={v.text}
              href={v.href}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Icon className="size-3.5 shrink-0" />
              {v.text}
            </a>
          ) : (
            <span key={v.text} className="flex items-center gap-1.5 text-sm">
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              {v.text}
            </span>
          ),
        )
      )}
    </div>
  );
}
