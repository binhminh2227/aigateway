import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AI Gateway - API Platform",
  description: "Professional AI API Gateway - OpenAI, Claude, Gemini Compatible",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`${inter.variable} font-sans bg-gray-950 text-gray-100 h-full antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
