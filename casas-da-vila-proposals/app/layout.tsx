import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Casas da Vila Hotel | Private Proposal",
  description:
    "Private accommodation proposal prepared by Casas da Vila Hotel."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}

        <Script
          src="/js/site-analytics.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}