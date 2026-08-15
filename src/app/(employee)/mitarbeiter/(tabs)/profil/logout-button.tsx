"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MButton } from "@/components/m/m-button";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/employee/logout", { method: "POST" });
      // Nach dem Abmelden fuehrt der Einstieg zur PIN-Eingabe — das Geraet
      // bleibt aktiviert, nur die Sitzung ist entwertet.
      router.replace("/mitarbeiter");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <MButton variant="secondary" onClick={logout} loading={loading}>
      Abmelden
    </MButton>
  );
}
