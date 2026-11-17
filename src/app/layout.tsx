import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IT Asset Management System | GMD • GMC • TEL",
  description: "Enterprise IT Hardware & Asset Inventory Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

