export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Du bist gerade offline. Bereits erfasste Einträge werden gespeichert und
        automatisch synchronisiert, sobald du wieder eine Verbindung hast.
      </p>
    </main>
  );
}
