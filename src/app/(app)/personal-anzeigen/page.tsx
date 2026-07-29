import { redirect } from "next/navigation";

/** Konsolidiert unter /online-anzeigen. */
export default function PersonalAnzeigenRedirect() {
  redirect("/online-anzeigen");
}
