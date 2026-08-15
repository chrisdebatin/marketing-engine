import { SetPinForm } from "./set-pin-form";

export const dynamic = "force-dynamic";

export default function PinNeuPage() {
  return (
    <main className="m-safe-top min-h-dvh px-5 pb-8 pt-10">
      <SetPinForm />
    </main>
  );
}
