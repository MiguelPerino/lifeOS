import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LifeOS — seu espaço pessoal",
    short_name: "LifeOS",
    description: "Organize tarefas, projetos e seu dia.",
    lang: "pt-BR",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#fafaf8",
    theme_color: "#27634b",
    icons: [
      { src: "/icons/lifeos-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/lifeos-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/lifeos-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
