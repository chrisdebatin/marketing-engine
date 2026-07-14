import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Marketing-Engine",
  description:
    "Erfassung von Marketing-Aktivitäten (Flyer, Aufsteller, Boxen) je Hub – offline-fähig.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Marketing-Engine",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {process.env.NODE_ENV !== "production" && (
          // Runs synchronously on every dev load, independent of React. A stale
          // SW from an earlier session serves cache-first chunks that mismatch
          // the fresh HTML → hydration failure → blank page; when the tree fails
          // to mount, an effect-based cleanup never fires. This can't rely on React.
          //
          // unregister()/caches.delete() are async, so the broken chunks for the
          // *current* load were already served from the SW cache before the clear
          // settles — teardown alone only heals the *next* load, leaving this one
          // white. So when a stale SW is actually controlling the page, we force a
          // single reload (guarded by sessionStorage) *after* the clear settles, so
          // the current load recovers by re-fetching real chunks from the network.
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var sw='serviceWorker'in navigator;var controlled=sw&&navigator.serviceWorker.controller;var jobs=[];if(sw){jobs.push(navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))}).catch(function(){}))}if('caches'in window){jobs.push(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}).catch(function(){}))}if(controlled&&!sessionStorage.getItem('sw-cleared')){sessionStorage.setItem('sw-cleared','1');Promise.all(jobs).then(function(){location.reload()})}}catch(e){}})();`,
            }}
          />
        )}
        {children}
        <ServiceWorkerRegister />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
