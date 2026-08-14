import { requireSession } from "@/lib/auth";
import { DeliveryComposer } from "@/components/delivery-composer";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NeueLieferungPage() {
  const session = await requireSession();

  if (session.hubs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kein Hub zugeordnet</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Dir ist noch kein Hub zugeordnet. Bitte wende dich an einen Admin.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lieferung erfassen"
        description="Tippe frei ein, was du an welche Hubs geliefert hast. Danach bekommst du pro Hub einen Link für die Pflege-Dienstleitung."
      />
      <DeliveryComposer
        hubs={session.hubs.map((h) => ({ id: h.id, name: h.name }))}
      />
    </div>
  );
}
