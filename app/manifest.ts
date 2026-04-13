import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Benguela Ajuda",
    short_name: "Ajuda BGU",
    description: "Mural de pedidos e ofertas para apoio rapido em Benguela.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#12365e",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
