"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteHub } from "@/app/(app)/admin/actions";

/** Admin-only hub deletion with an inline confirm step. */
export function DeleteHubButton({
  hubId,
  hubName,
}: {
  hubId: string;
  hubName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await deleteHub(hubId);
      if (res.ok) {
        toast.success(`Hub „${hubName}" gelöscht`);
        router.push("/hubs");
        router.refresh();
      } else {
        toast.error(res.error);
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-4" />
        Hub löschen
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Wirklich löschen?</span>
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={remove}
      >
        {pending ? "Lösche…" : "Ja, löschen"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        Abbrechen
      </Button>
    </div>
  );
}
