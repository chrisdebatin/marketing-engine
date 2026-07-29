import {
  BedDouble,
  BookOpen,
  Building2,
  ChartColumn,
  Rocket,
  Headset,
  Home,
  Inbox,
  Map,
  Megaphone,
  Send,
  Settings,
  Sparkles,
  Target,
  Truck,
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
      { href: "/ziele", label: "Ziele (CRM)", Icon: Target },
      { href: "/kapazitaet", label: "Kapazität", Icon: BedDouble },
      { href: "/themen", label: "Themen", Icon: BookOpen },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/frontoffice", label: "Frontoffice", Icon: Headset },
      { href: "/lieferungen", label: "Lieferungen", Icon: Truck },
      { href: "/flyeraktionen", label: "Flyeraktionen", Icon: Megaphone },
      { href: "/online-anzeigen", label: "Online Anzeigen", Icon: Rocket },
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

export function navGroups(isAdmin: boolean): NavGroup[] {
  if (!isAdmin) return NAV_GROUPS;
  return NAV_GROUPS.map((g) =>
    g.title === "System" ? { ...g, items: [...g.items, ADMIN_NAV_ITEM] } : g,
  );
}

/** Flache Liste für die mobile Top-Bar. */
export function navItems(isAdmin: boolean): NavItem[] {
  return navGroups(isAdmin).flatMap((g) => g.items);
}

export function isNavActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
