import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@/app/globals.css";
import { AppProviders } from "@/components/providers/app-providers";

export const metadata: Metadata = {
  title: {
    default: "Saintagram — My Profile Before God",
    template: "%s · Saintagram"
  },
  description:
    "A private, faith-centered space to reflect on how God sees you—without popularity, comparison, or performance.",
  applicationName: "Saintagram",
  robots: {
    index: false,
    follow: false
  },
  icons: {
    icon: "/Saintagram_Logo.png",
    apple: "/Saintagram_Logo.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F9F9FB" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0C10" }
  ]
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("saintagram-theme");document.documentElement.dataset.theme=t==="light"||t==="dark"?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){}})()`
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
        <footer className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center h-9 px-4 text-[12px] font-medium tracking-wide text-muted/70 border-t border-sage-100 bg-[rgb(var(--paper)/0.82)] backdrop-blur-sm">
          &copy; 2026 Saintagram. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
