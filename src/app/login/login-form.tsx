"use client";

import { useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginForm({ initialError }: { initialError: string | null }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const address = email.trim();
    if (!address || pending) return;

    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Kein Self-Signup: Nutzer werden vom Admin in Supabase Auth angelegt.
        shouldCreateUser: false,
      },
    });
    setPending(false);

    if (otpError) {
      setError(
        "Login-Link konnte nicht gesendet werden. Bitte prüfe die E-Mail-Adresse — es funktionieren nur freigeschaltete Konten.",
      );
      return;
    }
    setSent(true);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="mb-1 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Megaphone className="size-4" />
          </span>
          <span className="font-semibold">Marketing-Engine</span>
        </div>
        <CardTitle>Anmelden</CardTitle>
        <CardDescription>
          Gib deine E-Mail-Adresse ein — wir senden dir einen Login-Link. Ein
          Passwort ist nicht nötig.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            Link wurde gesendet — bitte E-Mail öffnen.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">E-Mail-Adresse</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Wird gesendet …" : "Login-Link senden"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Ohne Login kannst du die App weiterhin{" "}
              <Link href="/" className="underline">
                direkt nutzen
              </Link>
              .
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
