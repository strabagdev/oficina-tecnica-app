import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Oficina Tecnica Contractual",
    template: "%s",
  },
  description:
    "Plataforma para controlar itemizados de contrato, consumos mensuales y cambios NOC.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Script id="clear-stale-service-workers" strategy="beforeInteractive">
          {`
            if ("serviceWorker" in navigator) {
              navigator.serviceWorker.getRegistrations()
                .then(function (registrations) {
                  return Promise.all(registrations.map(function (registration) {
                    return registration.unregister();
                  }));
                })
                .catch(function () {});
            }
            if ("caches" in window) {
              caches.keys()
                .then(function (cacheNames) {
                  return Promise.all(cacheNames.map(function (cacheName) {
                    return caches.delete(cacheName);
                  }));
                })
                .catch(function () {});
            }
          `}
        </Script>
      </body>
    </html>
  );
}
