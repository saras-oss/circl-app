import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Circl — Turn your LinkedIn network into a qualified pipeline",
  description:
    "Discover potential customers, investors, and advisors in your existing LinkedIn connections.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
