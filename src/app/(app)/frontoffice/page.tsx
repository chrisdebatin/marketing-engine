import { redirect } from "next/navigation";

/** Konsolidiert unter /crm (Tab „Anfragen"). */
export default function FrontofficeRedirect() {
  redirect("/crm");
}
