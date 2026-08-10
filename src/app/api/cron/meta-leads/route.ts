import { syncMetaLeads } from "@/lib/meta-lead-sync";

export const maxDuration = 120;

/**
 * Stündlicher Lead-Durchlauf (Vercel Cron, siehe vercel.json): holt neue
 * Meta-Leads und leitet Mitarbeiter-Anfragen ans Recruiting weiter — auch
 * wenn niemand die Leads-Seite öffnet. Auth: Bearer CRON_SECRET (setzt
 * Vercel bei Cron-Aufrufen automatisch, wenn die Env-Variable existiert).
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await syncMetaLeads();
  return Response.json(result);
}
