import { UnlockForm } from "./unlock-form";

export const dynamic = "force-dynamic";

export default function PinPage() {
  return (
    <main className="m-safe-top min-h-dvh px-5 pb-8 pt-10">
      <UnlockForm />
    </main>
  );
}
