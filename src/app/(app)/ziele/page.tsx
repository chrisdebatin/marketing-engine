import { redirect } from "next/navigation";

/** Konsolidiert unter /crm (Tab „Institutionen & Anrufe"). */
export default function ZieleRedirect() {
  redirect("/crm");
}
