import Link from "next/link";
import { ChevronRight, Building2, UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";

/** Auswahl zwischen den beiden Empfehlungsarten. Bewusst nur zwei Optionen. */
export default function EmpfehlenPage() {
  return (
    <main className="px-4 pt-5">
      <h1 className="m-safe-top mb-2 px-1 text-[24px] font-bold text-foreground">
        Empfehlen
      </h1>
      <p className="mb-6 px-1 text-[17px] leading-relaxed text-muted-foreground">
        Kennst du jemanden, der zu uns passt? Sag uns kurz Bescheid.
      </p>

      <ul className="flex flex-col gap-3">
        <li>
          <Link
            href="/mitarbeiter/empfehlen/kunde"
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <UserPlus size={24} className="text-primary" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold text-foreground">
                Kundin oder Kunden empfehlen
              </span>
              <span className="mt-0.5 block text-[15px] leading-snug text-muted-foreground">
                Jemand braucht Pflege oder Betreuung
              </span>
            </span>
            <ChevronRight size={20} className="text-muted-foreground" aria-hidden />
          </Link>
        </li>

        <li>
          <Link
            href="/mitarbeiter/empfehlen/pflegedienst"
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Building2 size={24} className="text-primary" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold text-foreground">
                Pflegedienst empfehlen
              </span>
              <span className="mt-0.5 block text-[15px] leading-snug text-muted-foreground">
                Du kennst eine Inhaberin oder einen Inhaber
              </span>
            </span>
            <ChevronRight size={20} className="text-muted-foreground" aria-hidden />
          </Link>
        </li>
      </ul>
    </main>
  );
}
