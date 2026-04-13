import type { Metadata } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const jetMono = JetBrains_Mono({
  variable: "--font-jet-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://benguela-ajuda.vercel.app"),
  title: {
    default: "Benguela Ajuda",
    template: "%s | Benguela Ajuda",
  },
  description:
    "Mural solidário para pedidos e ofertas de ajuda em Benguela, Angola. Leve, rápido e pensado para telemóvel, com contacto por chamada, SMS e WhatsApp.",
  applicationName: "Benguela Ajuda",
  keywords: [
    "Benguela",
    "Benguela Angola",
    "ajuda Benguela",
    "solidariedade",
    "enchentes Benguela",
    "inundações Benguela",
    "pedido de ajuda",
    "oferta de ajuda",
    "SMS",
    "WhatsApp",
    "resposta de emergência",
    "apoio comunitário",
  ],
  authors: [{ name: "Benguela Ajuda" }],
  creator: "Benguela Ajuda",
  publisher: "Benguela Ajuda",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icon-512.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
    apple: [{ url: "/icon-192.svg", type: "image/svg+xml", sizes: "192x192" }],
  },
  openGraph: {
    type: "website",
    locale: "pt_AO",
    url: "/",
    siteName: "Benguela Ajuda",
    title: "Benguela Ajuda",
    description:
      "Mural solidário para pedidos e ofertas de ajuda em Benguela, Angola. Rápido, leve e pronto para telemóvel.",
    images: [
      {
        url: "/benguela-ajuda-1.jpg",
        width: 1200,
        height: 630,
        alt: "Bombeiros e policias a ajudar pessoas nas enchentes em Benguela",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Benguela Ajuda",
    description:
      "Mural solidário para pedidos e ofertas de ajuda em Benguela, Angola. Rápido, leve e pronto para telemóvel.",
    images: ["/benguela-ajuda-1.jpg"],
  },
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://benguela-ajuda.vercel.app";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}#website`,
      url: siteUrl,
      name: "Benguela Ajuda",
      description:
        "Mural solidário para pedidos e ofertas de ajuda em Benguela, Angola.",
      inLanguage: "pt-AO",
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}#organization`,
      name: "Benguela Ajuda",
      url: siteUrl,
      logo: `${siteUrl}/icon-512.svg`,
      image: `${siteUrl}/benguela-ajuda-1.jpg`,
      areaServed: {
        "@type": "AdministrativeArea",
        name: "Benguela",
      },
    },
  ],
} as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt"
      className={`${sora.variable} ${jetMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
