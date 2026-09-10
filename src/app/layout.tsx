import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
export const viewport: Viewport = { themeColor: "#27634b" };
export const metadata: Metadata = {
  title: { default: "LifeOS — espaço para pensar", template: "%s · LifeOS" },
  description:
    "Seu segundo cérebro pessoal. Organize tarefas, projetos e conhecimento com IA local.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
