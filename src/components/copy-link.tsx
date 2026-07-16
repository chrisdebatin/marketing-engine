"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { publicBaseUrl } from "@/lib/base-url";

/** Copies a share link ({prefix}/{token}) built from the current origin. */
export function CopyLink({
  token,
  prefix = "/l",
  label = "Link kopieren",
}: {
  token: string;
  prefix?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const ok = await copyText(`${publicBaseUrl()}${prefix}/${token}`);
    if (ok) {
      setCopied(true);
      toast.success("Link kopiert");
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("Kopieren nicht möglich");
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? "Kopiert" : label}
    </Button>
  );
}
