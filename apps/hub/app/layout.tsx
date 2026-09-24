import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "wowpixel lab — experiments",
  description:
    "Kiran's test bench: small apps and prototypes, shipped fast and tried out live.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
