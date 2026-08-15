import { cn } from "@/lib/utils";

/** Ladezustand: Platzhalter in der Form des echten Inhalts, keine Spinner. */
export function MSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-muted", className)}
      aria-hidden
    />
  );
}

export function MCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <MSkeleton className="h-[18px] w-3/5" />
      <MSkeleton className="mt-2.5 h-[13px] w-2/5" />
    </div>
  );
}

/** Leerzustand — nie nur eine Illustration, immer erklaerender Text. */
export function MEmpty({
  icon,
  title,
  body,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-muted-foreground">{icon}</div>}
      <p className="text-[18px] font-semibold text-foreground">{title}</p>
      {body && (
        <p className="max-w-[34ch] text-[15px] text-muted-foreground">{body}</p>
      )}
    </div>
  );
}

/** Fehlerzustand — verstaendlich, ohne technische Codes. */
export function MError({
  message = "Das hat nicht geklappt.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
    >
      <p className="text-[15px] font-medium text-foreground">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="m-tap mt-2 text-[15px] font-semibold text-primary underline-offset-4 hover:underline"
        >
          Erneut versuchen
        </button>
      )}
    </div>
  );
}
