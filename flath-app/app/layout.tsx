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
      className={`${geistSans.variable} ${geistMono.variable} ${greekToMe.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col relative">
          <div
            aria-hidden
            className="fixed inset-0 -z-10 flex items-center justify-center pointer-events-none overflow-hidden bg-gray-50"
            style={{ willChange: "transform", transform: "translateZ(0)" }}
          >
            {/* Rotated 90° to portrait. Sized so the image's visual width
                (the source's height after rotation) is ~30% larger than the
                white max-w-2xl card on desktop, and scales with viewport on mobile. */}
            <img
              src="/flath_bckgrng.png"
              alt=""
              className="rotate-90 origin-center max-w-none opacity-90"
              style={{ height: "min(130vw, 875px)", width: "auto" }}
            />
          </div>
          <FloatingAddButton />
          {children}
          <Toaster richColors position="top-right" />
        </body>
    </html>
  );
}
