import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Image to PDF Converter — Free, Private, In-Browser",
  description:
    "Convert images (JPG, PNG, HEIC, TIFF, AVIF, WebP, SVG, GIF, BMP) and ZIP archives to PDF, or edit existing PDFs — merge, split, rotate, annotate, watermark — entirely in your browser. Files never leave your device.",
  applicationName: "Image to PDF Converter",
  keywords: [
    "image to pdf",
    "pdf converter",
    "merge pdf",
    "split pdf",
    "pdf editor",
    "heic to pdf",
    "annotate pdf",
    "in-browser pdf",
  ],
  openGraph: {
    title: "Image to PDF Converter",
    description: "Convert, merge, split, annotate PDFs — fully client-side.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Image to PDF Converter",
    description: "Convert, merge, split, annotate PDFs — fully client-side.",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
