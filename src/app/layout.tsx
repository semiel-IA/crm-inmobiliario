import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import GradientBackground from "@/components/layout/gradient-background";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM Inmobiliario",
  description: "CRM para inmobiliarias y agentes independientes en Colombia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-CO"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GradientBackground />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
