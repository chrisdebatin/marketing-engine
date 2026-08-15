import { redirect } from "next/navigation";
import Link from "next/link";
import { requireEmployee, readDeviceSecret } from "@/lib/employee/auth";
import { empDb } from "@/lib/employee/db";
import { hashToken } from "@/lib/employee/crypto";

export const dynamic = "force-dynamic";

/**
 * Einstieg. Leitet je nach Zustand weiter:
 *  - gueltige Session      -> Start
 *  - Geraet mit PIN        -> PIN-Eingabe
 *  - Geraet ohne PIN       -> PIN festlegen
 *  - kein Geraet           -> Willkommen (Aktivierung)
 */
export default async function EmployeeEntryPage() {
  const ctx = await requireEmployee();
  if (ctx) redirect("/mitarbeiter/start");

  const deviceSecret = await readDeviceSecret();
  if (deviceSecret) {
    const { data: device } = await empDb()
      .from("devices")
      .select("id, pin_hash")
      .eq("secret_hash", hashToken(deviceSecret))
      .is("revoked_at", null)
      .maybeSingle();

    if (device) redirect(device.pin_hash ? "/mitarbeiter/pin" : "/mitarbeiter/pin/neu");
  }

  return (
    <main className="m-safe-top flex min-h-dvh flex-col justify-between px-5 pb-8 pt-16">
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-[28px] font-bold leading-tight text-foreground">
          Willkommen
        </h1>
        <p className="mt-3 max-w-[32ch] text-[17px] leading-relaxed text-muted-foreground">
          Kurz einrichten – danach brauchst du nur noch deine PIN.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/mitarbeiter/aktivieren"
          className="flex w-full items-center justify-center rounded-xl bg-primary px-5 text-[17px] font-semibold text-primary-foreground"
          style={{ minHeight: "var(--m-control)" }}
        >
          Los geht&apos;s
        </Link>
        <p className="px-2 text-center text-[15px] text-muted-foreground">
          Deinen Aktivierungscode bekommst du von deiner Hubleitung.
        </p>
      </div>
    </main>
  );
}
