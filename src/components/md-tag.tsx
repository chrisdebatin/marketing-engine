import { cn } from "@/lib/utils";
import { mdColor, mdShort } from "@/lib/hub-coords";
import { splitPdlNames } from "@/lib/pdl";

/**
 * Small colored tag showing the responsible MD (first name), colored
 * deterministically per MD. Renders nothing when no MD is set.
 */
export function MdTag({
  md,
  className,
}: {
  md: string | null;
  className?: string;
}) {
  if (!md) return null;
  const color = mdColor(md);
  return (
    <span
      title={`MD: ${md}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{ color, borderColor: color, backgroundColor: `${color}1a` }}
    >
      <span className="text-[0.625rem] uppercase opacity-70">MD</span>
      {mdShort(md)}
    </span>
  );
}

/**
 * Small neutral tag showing the local PDL/Standortleitung (full name).
 * Rendered next to MdTag so a hub name is followed by both responsible MD and
 * PDL. Nothing if unset. `role` = chip prefix ("PDL", bei Alltagshilfe "SL").
 */
export function PdlTag({
  pdl,
  role = "PDL",
  className,
}: {
  pdl: string | null;
  role?: string;
  className?: string;
}) {
  // Mehrere PDLs (Komma/„&"-getrennt) → ein Chip pro Person.
  const names = splitPdlNames(pdl);
  if (names.length === 0) return null;
  const roleTitle = role === "SL" ? "Standortleitung" : role;
  return (
    <>
      {names.map((name) => (
        <span
          key={name}
          title={`${roleTitle}: ${name}`}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
            className,
          )}
        >
          <span className="text-[0.625rem] uppercase opacity-70">{role}</span>
          {name}
        </span>
      ))}
    </>
  );
}

/** Convenience: MD tag + PDL tag together (each hidden when unset). */
export function HubTags({
  md,
  pdl,
  pdlRole,
  className,
}: {
  md: string | null;
  pdl: string | null;
  pdlRole?: string;
  className?: string;
}) {
  if (!md && !pdl) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <MdTag md={md} />
      <PdlTag pdl={pdl} role={pdlRole} />
    </span>
  );
}
