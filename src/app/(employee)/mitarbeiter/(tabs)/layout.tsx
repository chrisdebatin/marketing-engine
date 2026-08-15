import { redirect } from "next/navigation";
import { MTabBar } from "@/components/m/m-tabbar";
import { countUnread } from "@/lib/employee/announcements";
import { requireEmployee } from "@/lib/employee/auth";

/**
 * Layout der angemeldeten Tab-Bereiche.
 *
 * Die Anmeldepflicht wird hier serverseitig durchgesetzt — nicht im Proxy
 * (der macht bewusst keine Redirects) und schon gar nicht im Client.
 */
export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireEmployee();
  if (!ctx) redirect("/mitarbeiter");

  const unread = await countUnread(ctx.staff).catch(() => 0);

  return (
    <>
      <div className="m-scroll">{children}</div>
      <MTabBar unread={unread} />
    </>
  );
}
