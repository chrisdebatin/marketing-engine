"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Briefcase, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  triggerGroupReport,
  triggerWeeklyMails,
} from "@/app/(app)/admin/actions";

/**
 * Versand-Panel der Kommunikations-Seite: die drei Wochen-Mails manuell
 * auslösen (laufen sonst automatisch jeden Montag).
 */
export function KommunikationSend({ gfAddress }: { gfAddress: string }) {
  const [pending, startTransition] = useTransition();
  const [gfOverride, setGfOverride] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const gfConfigured = gfAddress.includes("@");

  function run(kind: "pdl" | "gf") {
    if (pending) return;
    const label =
      kind === "pdl"
        ? "Wochen-Plan jetzt an alle PDLs mit offenen Orten senden?"
        : `Gruppen-Report jetzt an die Geschäftsführung (${gfOverride.includes("@") ? gfOverride : gfAddress}) senden?`;
    if (kind === "gf" && !gfConfigured && !gfOverride.includes("@")) {
      toast.error("Adresse der Geschäftsführung eingeben.");
      return;
    }
    if (!window.confirm(label)) return;
    startTransition(async () => {
      const r =
        kind === "gf"
          ? await triggerGroupReport(gfOverride)
          : await triggerWeeklyMails("pdl");
      setResult(r.message);
      if (r.ok) toast.success("Versand abgeschlossen");
      else toast.error("Versand mit Problemen — Details unten.");
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-5 shadow-sm">
      <p className="font-semibold">Versand — nur nach Ihrer Freigabe</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run("pdl")}
        >
          <Mail className="size-4" />
          Wochen-Plan an PDLs
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run("gf")}
        >
          <Briefcase className="size-4" />
          Gruppen-Report an Geschäftsführung
        </Button>
        {!gfConfigured && (
          <Input
            value={gfOverride}
            onChange={(e) => setGfOverride(e.target.value)}
            placeholder="E-Mail der Geschäftsführung"
            className="min-w-72 flex-1"
            type="email"
            autoComplete="off"
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {pending
          ? "Sende…"
          : `Nichts wird automatisch versendet. Gruppen-Report geht an ${gfConfigured ? gfAddress : "die eingegebene Adresse"}; MD-Updates unten als Entwürfe einzeln freigeben.`}
      </p>
      {result && (
        <p className="text-xs break-words text-muted-foreground">{result}</p>
      )}
    </div>
  );
}
