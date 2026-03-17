import type { Metadata, Viewport } from "next";
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://danielvisca.com";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Daniel Visca — Software engineer at PostHog, builder, Seattle",
    template: "%s | Daniel Visca",
  },
  description:
    "Daniel Visca: software engineer at PostHog (ex-Microsoft), builder in Seattle. Mountains, wilderness canoe software (OutfitterHQ), Japan bike trips, pottery. Personal site.",
  keywords: [
    "Daniel Visca",
    "PostHog",
    "software engineer",
    "Seattle",
    "OutfitterHQ",
    "wilderness canoe",
    "personal site",
    "builder",
    "Microsoft",
  ],
  authors: [{ name: "Daniel Visca", url: siteUrl }],
  creator: "Daniel Visca",
  openGraph: {
    type: "profile",
    locale: "en_US",
    url: siteUrl,
    siteName: "Daniel Visca",
    title: "Daniel Visca — Software engineer at PostHog, builder, Seattle",
    description:
      "Software engineer at PostHog (ex-Microsoft). Builder, mountains, wilderness software, Japan bike trips. Seattle. The kind of personal site you'd actually want to read.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Daniel Visca — Software engineer at PostHog, builder, Seattle",
    description:
      "Software engineer at PostHog (ex-Microsoft). Builder, mountains, wilderness software. Seattle.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: siteUrl },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Daniel Visca",
      description:
        "Personal site of Daniel Visca — software engineer at PostHog, builder, Seattle. Mountains, wilderness software, Japan bike trips.",
      publisher: { "@id": `${siteUrl}/#person` },
    },
    {
      "@type": "Person",
      "@id": `${siteUrl}/#person`,
      name: "Daniel Visca",
      url: siteUrl,
      jobTitle: "Software Engineer",
      worksFor: {
        "@type": "Organization",
        name: "PostHog",
        url: "https://posthog.com",
      },
      description:
        "Software engineer at PostHog (ex-Microsoft). Builder, mountains, wilderness canoe software (OutfitterHQ), Seattle.",
      sameAs: [
        "https://github.com/DanielVisca",
        "https://www.linkedin.com/in/daniel-visca/",
        "https://medium.com/@danielvisca",
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-black text-white`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
