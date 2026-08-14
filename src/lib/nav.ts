import {
  BedDouble,
  BookOpen,
  Bot,
  Building2,
  ChartColumn,
  Rocket,
  Home,
  Inbox,
  Map,
  Megaphone,
  PhoneIncoming,
  Send,
  Settings,
  Sparkles,
  Target,
  Truck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
/**
 * Zentrale Navigations-Struktur — von Sidebar (Desktop) und Top-Bar (Mobil)
 * gemeinsam genutzt, damit beide immer synchron sind.
 */
export interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Übersicht",
    items: [
      { href: "/", label: "Start", Icon: Home },
      { href: "/statistik", label: "Statistik", Icon: ChartColumn },
      { href: "/karte", label: "Karte", Icon: Map },
    ],
  },
  {
    title: "Standorte",
    items: [
      { href: "/hubs", label: "Hubs", Icon: Building2 },
      { href: "/crm", label: "CRM & Leads", Icon: Target },
      { href: "/kapazitaet", label: "Kapazität", Icon: BedDouble },
      { href: "/themen", label: "Themen", Icon: BookOpen },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/lieferungen", label: "Lieferungen", Icon: Truck },
      { href: "/flyeraktionen", label: "Flyeraktionen", Icon: Megaphone },
      { href: "/online-anzeigen", label: "Online Anzeigen", Icon: Rocket },
      { href: "/meta-ads", label: "Meta Ads KI", Icon: Bot },
      { href: "/recruiting", label: "Recruiting-Leads", Icon: UserPlus },
      { href: "/kommunikation", label: "Kommunikation", Icon: Send },
      { href: "/postfach", label: "Postfach", Icon: Inbox },
    ],
  },
  {
    title: "System",
    items: [{ href: "/assistant", label: "Assistant", Icon: Sparkles }],
  },
];
export const ADMIN_NAV_ITEM: NavItem = {
  href: "/admin",
  label: "Admin",
  Icon: Settings,
};
/** Nur für Admins sichtbar: Auswertung direkt unter "CRM & Leads". */
export const CRM_ADMIN_NAV_ITEM: NavItem = {
  href: "/crm-admin",
  label: "CRM-Admin",
  Icon: ChartColumn,
};
/** Nur für Admins: Erreichbarkeit & Anliegen der eingehenden Anrufe. */
export const CALLCENTER_NAV_ITEM: NavItem = {
  href: "/callcenter",
  label: "Callcenter",
  Icon: PhoneIncoming,
};
export function navGroups(isAdmin: boolean): NavGroup[] {
  if (!isAdmin) return NAV_GROUPS;
  return NAV_GROUPS.map((g) => {
    if (g.title === "System") return { ...g, items: [...g.items, ADMIN_NAV_ITEM] };
    if (g.title === "Standorte") {
      return {
        ...g,
        items: g.items.flatMap((i) =>
          i.href === "/crm"
            ? [i, CRM_ADMIN_NAV_ITEM, CALLCENTER_NAV_ITEM]
            : [i],
        ),
      };
    }
    return g;
  });
}
/** Flache Liste für die mobile Top-Bar. */
export function navItems(isAdmin: boolean): NavItem[] {
  return navGroups(isAdmin).flatMap((g) => g.items);
}
export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  // exakt oder als Pfad-Segment — sonst wäre /crm auch auf /crm-admin aktiv
  return pathname === href || pathname.startsWith(`${href}/`);
}
