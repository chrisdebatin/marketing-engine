"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importCallReport } from "@/app/(app)/statistik/actions";

/**
 * Upload für den Anruf-Report (CSV aus der Telefonanlage). Mehrfach-Uploads
 * derselben Daten sind unschädlich (Dedupe über die Call ID).
 */
export function CallUpload() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(file: File | null) {
    if (!file || pending) return;
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const r = await importCallReport(fd);
      setResult(r.message);
      if (r.ok) toast.success("Anruf-Report importiert");
      else toast.error(r.message);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Upload className="size-4 shrink-0 text-primary" />
        <p className="text-sm font-medium">
          Anruf-Report hochladen (CSV aus der Telefonanlage)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? "Importiere…" : "CSV auswählen"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Einfach regelmäßig den Export hochladen — doppelte Anrufe werden
        automatisch übersprungen, die Zuordnung zum Standort passiert über
        den Telefon-Trunk. Interne Gespräche zählen nicht.
      </p>
      {result && (
        <p className="text-xs break-words text-muted-foreground">{result}</p>
      )}
    </div>
  );
}
