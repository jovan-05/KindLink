import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import TopBar from "@/components/TopBar";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", style: ["normal", "italic"] });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap", style: ["normal", "italic"] });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "KindLink - AI Nonprofit Fundraiser Planner",
  description:
    "Design fundraisers small nonprofit supporters actually want to attend, backed 100% by Qloo taste data intelligence.",
  openGraph: {
    title: "KindLink - AI Nonprofit Fundraiser Planner",
    description:
      "Design fundraisers small nonprofit supporters actually want to attend, backed 100% by Qloo taste data intelligence.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fafaf9" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jakarta.variable} ${jetbrains.variable}`}>
      <body className="bg-stone-50 text-stone-900 antialiased selection:bg-amber-100 selection:text-amber-900 min-h-screen">
        <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col selection:bg-amber-100 selection:text-amber-900">
          <TopBar />
          <main className="flex-1">{children}</main>

          <footer className="no-print bg-stone-100 border-t border-stone-200 py-10 mt-20 text-xs text-stone-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-stone-700 font-medium">
                <span className="w-5 h-5 rounded bg-stone-900 text-amber-300 font-serif flex items-center justify-center text-[10px] font-bold">
                  K
                </span>
                <span>KindLink</span>
                <span className="text-stone-300">·</span>
                <span className="text-stone-500 font-normal">Evidence-backed fundraiser planning for small nonprofits</span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 text-stone-500">
                <span>Powered by Qloo Taste Intelligence</span>
                <span className="text-stone-300">·</span>
                <span>Zero Hallucination Protocol</span>
                <span className="text-stone-300">·</span>
                <span>No donor data · MIT licensed</span>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
