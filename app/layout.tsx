import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sentinel // Finance OS",
  description: "Personal Finance War Room",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="font-sans antialiased bg-[#050505] text-zinc-100">
        <div className="tactical-grid" />
        {children}
      </body>
    </html>
  );
}
