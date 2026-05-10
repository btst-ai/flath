import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { FloatingAddButton } from "@/components/FloatingAddButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const greekToMe = localFont({
  src: "../public/font/GreekToMe.ttf",
  variable: "--font-greek-to-me",
});

const ac5x5 = localFont({
  src: "../public/font/AC-5x5_unicode.ttf",
  variable: "--font-ac5x5",
});

export const metadata: Metadata = {
  title: "Flath",
  description: "Greek Lexical Engine — vocabulary mastery for B1 Modern Greek learners.",
  appleWebApp: { capable: true, title: "Flath", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${greekToMe.variable} ${ac5x5.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col relative bg-gray-50">
          <div aria-hidden="true" className="fixed inset-0 pointer-events-none opacity-90 z-0 overflow-hidden -rotate-90 origin-center">
            <img src="/flath_bckgrng.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
          <div className="relative z-10 flex flex-col flex-1">
            <FloatingAddButton />
            {children}
          </div>
          <Toaster richColors position="top-right" />
        </body>
    </html>
  );
}
