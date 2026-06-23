import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import ThemeModeToggle from "@/components/ThemeModeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MedQ | Live Hospital Queue & Wait Tracking",
  description:
    "Track your doctor queue in real-time. Know exactly when you'll be seen and wait in the comfort of your home or cafeteria rather than crowded clinic waiting rooms.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="medq-dark min-h-full flex flex-col bg-slate-50 text-slate-900"
        suppressHydrationWarning
      >
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('medq-theme');document.body.classList.toggle('medq-dark',t!=='light')}catch(e){}",
          }}
        />
        <ClerkProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
        <ThemeModeToggle />
      </body>
    </html>
  );
}
