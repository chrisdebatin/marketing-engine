import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <LoginForm
        initialError={
          error
            ? "Der Login-Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an."
            : null
        }
      />
    </main>
  );
}
