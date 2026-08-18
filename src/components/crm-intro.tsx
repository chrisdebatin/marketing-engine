import {
  ArrowRight,
  Building2,
  Globe,
  Headset,
  Inbox,
  Mail,
  Megaphone,
  Phone,
  PhoneOutgoing,
  Stethoscope,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Grafisches Intro der CRM-Seite: wer bearbeitet welche Leads (Inbound nach
 * Quelle, Outbound nach Kategorie) und wie der Status-Fluss läuft. Rein
 * statisch — die Wahrheit steht im Quellen-Routing (lib/leads.ts) und im
 * Kategorie-Split der Team-Seiten.
 */

function SourceChip({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium">
      <Icon className="size-3.5 text-muted-foreground" />
      {label}
    </span>
  );
}

function TeamCard({
  name,
  role,
  tone,
}: {
  name: string;
  role: string;
  tone: "sky" | "violet";
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border-2 px-3.5 py-2.5",
        tone === "sky"
          ? "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40"
          : "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40",
      )}
    >
      <span className="text-sm font-semibold">{name}</span>
      <span className="text-xs text-muted-foreground">{role}</span>
    </div>
  );
}

function StatusChip({ label, tone }: { label: string; tone?: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        tone ?? "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

const Arrow = () => (
  <ArrowRight className="size-4 shrink-0 text-muted-foreground/60" />
);

export function CrmIntro() {
  return (
    <details className="group rounded-xl border border-primary/20 bg-primary/[0.03] open:pb-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold select-none">
        <Users className="size-4 text-primary" />
        So funktioniert unser CRM — wer bearbeitet was?
        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
          aufklappen
        </span>
      </summary>

      <div className="flex flex-col gap-4 px-4">
        {/* Inbound-Fluss */}
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Inbox className="size-3.5" />
            Anfragen, die reinkommen (Inbound) — die Quelle bestimmt das Team
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                <SourceChip icon={Globe} label="Website" />
                <SourceChip icon={Phone} label="0800-Nummer" />
                <SourceChip icon={Megaphone} label="Meta-Anzeigen" />
                <SourceChip icon={Mail} label="Lead-Agenturen" />
                <SourceChip icon={Building2} label="Klinik meldet sich" />
              </div>
              <Arrow />
              <TeamCard
                name="Belinda & Adelina"
                role="Kundenservice Deutschland — B2C bis zum Beratungsgespräch"
                tone="sky"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                <SourceChip icon={Building2} label="Recare" />
              </div>
              <Arrow />
              <TeamCard
                name="Devina"
                role="Call-Center — Recare + Krankenhaus-Anrufe"
                tone="violet"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
              <span className="mr-1 text-xs text-muted-foreground">
                Jeder Lead wird per Klick <strong>übernommen</strong> (Name
                klebt dran) und läuft durch:
              </span>
              <StatusChip label="offen" tone="bg-amber-100 text-amber-800" />
              <Arrow />
              <StatusChip label="kontaktiert" tone="bg-blue-100 text-blue-800" />
              <Arrow />
              <StatusChip
                label="Erstgespräch vereinbart"
                tone="bg-purple-100 text-purple-800"
              />
              <Arrow />
              <StatusChip
                label="aufgenommen ✓"
                tone="bg-emerald-100 text-emerald-800"
              />
              <span className="text-xs text-muted-foreground">oder</span>
              <StatusChip label="verloren" tone="bg-slate-200/70 text-slate-600" />
              <span className="text-xs text-muted-foreground">
                (Recare-Leads: direkt „aufgenommen&ldquo;)
              </span>
            </div>
          </div>
        </div>

        {/* Outbound-Fluss */}
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <PhoneOutgoing className="size-3.5" />
            Anrufliste (Outbound) — eine zentrale Liste, nach Kategorie geteilt
          </p>
          <div className="flex flex-wrap items-stretch gap-2">
            <div className="flex flex-col justify-center rounded-xl border bg-background px-3.5 py-2.5">
              <span className="text-sm font-semibold">Zentrale Liste</span>
              <span className="text-xs text-muted-foreground">
                Krankenhäuser, Praxen, Apotheken …
              </span>
            </div>
            <div className="flex items-center">
              <Arrow />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <SourceChip icon={Stethoscope} label="Arztpraxen" />
                <Arrow />
                <span className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">
                  Belinda & Adelina
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <SourceChip icon={Building2} label="Krankenhäuser" />
                <Arrow />
                <span className="rounded-lg bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-800">
                  Devina
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <SourceChip icon={Headset} label="Apotheken, Pflegeheime, Rest" />
                <Arrow />
                <span className="rounded-lg bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                  gemeinsamer Pool
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground">
            <strong>Kein Doppelkontakt:</strong> Wer anruft, loggt den Kontakt
            unter eigenem Namen — der Ort verschwindet für alle aus
            „fällig&ldquo; und bekommt automatisch die Wiedervorlage. Besuche
            machen die PDLs über ihre Standort-Seiten; bei Orten, wo schon
            jemand war, steht dort „Schon von … besucht am …&ldquo;.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Die persönlichen Arbeitslisten von Belinda, Adelina und Devina laufen
          über ihre eigenen Links (Admin → Team-Links). Diese Seite hier ist
          die Gesamtsicht für alle.
        </p>
      </div>
    </details>
  );
}
