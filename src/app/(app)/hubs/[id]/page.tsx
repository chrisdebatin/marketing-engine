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
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CopyLink } from "@/components/copy-link";
import { DeleteHubButton } from "@/components/delete-hub-button";
import { HubTags } from "@/components/md-tag";
import type { Hub } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: hubData }, { data: deliveries }, { data: placements }] =
    await Promise.all([
      supabase
        .from("hubs")
        .select(
          "id, name, region, address, responsible_md, pdl_name, pdl_email, pdl_phone, share_token, created_at",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("deliveries")
        .select("flyer_count, box_count, aufsteller_count")
        .eq("hub_id", id),
      supabase.from("delivery_placements").select("id").eq("hub_id", id),
    ]);

  const hub = hubData as Hub | null;
  if (!hub) notFound();

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
            <HubTags md={hub.responsible_md} pdl={hub.pdl_name} />
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
            <Detail label="Lokale PDL" icon={User} value={hub.pdl_name} />
            <Detail
              label="PDL Telefon"
              icon={Phone}
              value={hub.pdl_phone}
              href={hub.pdl_phone ? `tel:${hub.pdl_phone}` : undefined}
            />
            <Detail
              label="PDL E-Mail"
              icon={Mail}
              value={hub.pdl_email}
              href={hub.pdl_email ? `mailto:${hub.pdl_email}` : undefined}
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

          <div className="border-t pt-4">
            <CopyLink
              token={hub.share_token}
              prefix="/h"
              label="PDL-Link kopieren"
            />
          </div>
        </CardContent>
      </Card>

      {session.isAdmin && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Hub löschen</p>
              <p className="text-sm text-muted-foreground">
                Entfernt den Hub dauerhaft. Nur möglich, wenn keine Lieferungen
                erfasst sind.
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
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string | null;
  href?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {value ? (
        href ? (
          <a
            href={href}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Icon className="size-3.5 shrink-0" />
            {value}
          </a>
        ) : (
          <span className="flex items-center gap-1.5 text-sm">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            {value}
          </span>
        )
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      )}
    </div>
  );
}
