import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allocation Discrepancy Tool",
  description:
    "Cross-reference field feedback against your allocation spreadsheet to surface inbound gaps.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
