import type { Metadata } from "next";
import "./globals.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
import StoreProvider from "@/store/StoreProvider";
import { AppearanceProvider } from "@/context/AppearanceContext";
import { AppearanceToggle } from "@/components/AppearanceToggle";
config.autoAddCss = false;

export const metadata: Metadata = {
  title: "Forta Login",
  description: "",
  icons: {
    icon: [
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon.ico", rel: "shortcut icon" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/favicon/site.webmanifest",
  appleWebApp: {
    title: "Forta",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Runs before paint to apply saved theme and prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=document.cookie.match(/(?:^|;\\s*)forta-appearance=([^;]*)/);var s=c?c[1]:'system';var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AppearanceProvider>
          <StoreProvider>{children}</StoreProvider>
          <AppearanceToggle />
        </AppearanceProvider>
      </body>
    </html>
  );
}
