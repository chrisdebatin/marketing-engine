import type { Metadata, Viewport } from "next";

/**
 * Shell der Mitarbeiter-App.
 *
 * Bewusst EIGENE Route-Group, damit nichts aus (app) geerbt wird:
 *  - kein requireSession() (das liefert anonymen Besuchern Admin-Rechte),
 *  - keine Desktop-Sidebar / kein AppHeader,
 *  - keine Lead-Zaehler-Queries bei jeder Navigation.
 *
 * Die Authentifizierung passiert pro Seite ueber requireEmployee().
 */

export const metadata: Metadata = {
  title: "Mitarbeiter-App",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mitarbeiter",
  },
  // Eigenes Manifest: eigener Scope, damit die Installation nicht im
  // CRM landet (public/manifest.webmanifest hat scope "/").
  manifest: "/manifest.mitarbeiter.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  // viewportFit=cover ist Voraussetzung fuer env(safe-area-inset-*).
  viewportFit: "cover",
  // Bewusst KEIN maximumScale/userScalable: Zoom-Sperren sind ein
  // Barrierefreiheitsproblem. Stattdessen sind alle Inputs >= 16px,
  // damit iOS gar nicht erst automatisch hineinzoomt.
};

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="m-app">{children}</div>;
}
