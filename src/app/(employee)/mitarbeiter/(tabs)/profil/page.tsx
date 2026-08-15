import { redirect } from "next/navigation";
import { requireEmployee } from "@/lib/employee/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

/** Minimales Profil: wer bin ich, welcher Hub, abmelden. Mehr braucht V1 nicht. */
export default async function ProfilPage() {
  const ctx = await requireEmployee();
  if (!ctx) redirect("/mitarbeiter");

  // Hub-Name aus public.hubs — zweite einfache Query statt Embedded Select.
  let hubName: string | null = null;
  if (ctx.staff.hub_id) {
    const { data } = await createAdminClient()
      .from("hubs")
      .select("name")
      .eq("id", ctx.staff.hub_id)
      .maybeSingle();
    hubName = data?.name ?? null;
  }

  return (
    <main className="px-4 pt-5">
      <h1 className="m-safe-top mb-5 px-1 text-[24px] font-bold text-foreground">
        Profil
      </h1>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-[20px] font-semibold text-foreground">
          {ctx.staff.vorname} {ctx.staff.nachname}
        </p>
        {hubName && (
          <p className="mt-1 text-[15px] text-muted-foreground">{hubName}</p>
        )}
      </div>

      <div className="mt-6">
        <LogoutButton />
      </div>

      <p className="mt-8 px-1 text-center text-[13px] text-muted-foreground">
        Mitarbeiter-App · Version 1.0
      </p>
    </main>
  );
}
