import { redirect } from "next/navigation";
import { requireEmployee } from "@/lib/employee/auth";
import { CustomerReferralForm } from "./customer-form";

export const dynamic = "force-dynamic";

export default async function KundeEmpfehlenPage() {
  const ctx = await requireEmployee();
  if (!ctx) redirect("/mitarbeiter");

  return <CustomerReferralForm vorname={ctx.staff.vorname} />;
}
