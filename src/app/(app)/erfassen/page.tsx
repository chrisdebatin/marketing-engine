import { requireSession } from "@/lib/auth";
import { getMaterialTypes, getStandortSuggestions } from "@/lib/data";
import { ActivityForm } from "@/components/activity-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionCard } from "@/components/ui/section-card";

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
      <PageHeader
        title="Aktivität erfassen"
        description="Flyer/Aufsteller ausgelegt oder Box beliefert – auch offline."
      />
      <SectionCard
        title="Neue Aktivität"
        description="Hub und Aktivitätstyp wählen, Details eintragen, speichern — ohne Internet wird der Eintrag lokal gesichert und später automatisch synchronisiert."
        contentClassName="p-5 sm:p-6"
      >
        <ActivityForm
          hubs={session.hubs.map((h) => ({ id: h.id, name: h.name }))}
          materialTypes={materialTypes.map((m) => ({
            id: m.id,
            name: m.name,
          }))}
          standorte={standorte}
        />
      </SectionCard>
    </div>
  );
}
