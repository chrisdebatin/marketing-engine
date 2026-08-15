import { redirect } from "next/navigation";
import { requireEmployee } from "@/lib/employee/auth";
import { MaReferralForm } from "./ma-form";

export const dynamic = "force-dynamic";

export default async function PflegedienstEmpfehlenPage() {
  const ctx = await requireEmployee();
  if (!ctx) redirect("/mitarbeiter");

  return <MaReferralForm vorname={ctx.staff.vorname} />;
}
