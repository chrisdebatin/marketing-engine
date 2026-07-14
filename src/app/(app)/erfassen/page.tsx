import { requireSession } from "@/lib/auth";
import { getMaterialTypes, getStandortSuggestions } from "@/lib/data";
import { ActivityForm } from "@/components/activity-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ErfassenPage() {
  const session = await requireSession();

  if (session.hubs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kein Hub zugeordnet</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Dir ist noch kein Hub zugeordnet. Bitte wende dich an einen Admin,
          bevor du Aktivitäten erfassen kannst.
        </CardContent>
      </Card>
    );
  }

  const hubIds = session.hubs.map((h) => h.id);
  const [materialTypes, standorte] = await Promise.all([
    getMaterialTypes(),
    getStandortSuggestions(hubIds),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Aktivität erfassen
        </h1>
        <p className="text-sm text-muted-foreground">
          Flyer/Aufsteller ausgelegt oder Box beliefert – auch offline.
        </p>
      </div>
      <Card>
        <CardContent className="p-5 sm:p-6">
          <ActivityForm
            hubs={session.hubs.map((h) => ({ id: h.id, name: h.name }))}
            materialTypes={materialTypes.map((m) => ({
              id: m.id,
              name: m.name,
            }))}
            standorte={standorte}
          />
        </CardContent>
      </Card>
    </div>
  );
}
