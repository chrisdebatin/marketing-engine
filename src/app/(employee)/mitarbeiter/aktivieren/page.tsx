import { ActivationForm } from "./activation-form";

export const dynamic = "force-dynamic";

export default function AktivierenPage() {
  return (
    <main className="m-safe-top min-h-dvh px-5 pb-8 pt-10">
      <h1 className="text-[26px] font-bold leading-tight text-foreground">
        Dein Aktivierungscode
      </h1>
      <p className="mt-3 max-w-[34ch] text-[17px] leading-relaxed text-muted-foreground">
        Den Code hast du von deiner Hubleitung bekommen.
      </p>

      <div className="mt-8">
        <ActivationForm />
      </div>
    </main>
  );
}
