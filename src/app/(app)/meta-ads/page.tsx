import { redirect } from "next/navigation";

/** Konsolidiert unter /online-anzeigen. */
export default function MetaAdsRedirect() {
  redirect("/online-anzeigen");
}
