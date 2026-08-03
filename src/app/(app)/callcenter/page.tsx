import { redirect } from "next/navigation";

// Das Call-Center ist ins CRM gewandert: /ziele → Tab "Anrufliste".
// Der Team-Link /c/[token] bleibt unverändert bestehen.
export default function CallcenterPage() {
  redirect("/ziele");
}
