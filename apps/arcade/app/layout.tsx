import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 Arcade — wowpixel lab",
  description:
    "Five tiny browser games for a missing page. Instant play, no install, works offline.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
