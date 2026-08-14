import { WifiOff } from "lucide-react";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <WifiOff className="size-5" />
      </span>
      <h1 className="text-xl font-semibold tracking-tight">Offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Du bist gerade offline. Bereits erfasste Einträge werden gespeichert und
        automatisch synchronisiert, sobald du wieder eine Verbindung hast.
      </p>
    </main>
  );
}
