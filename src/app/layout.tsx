import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roomix Virtual Mover — Mudanza Virtual con IA",
  description: "Feature conceptual para Roomix.ai. Proyectá tus propios muebles en tu futuro departamento, estimando dimensiones y circulación física mediante IA.",
  keywords: "roomix, proptech, mudanza virtual, inteligencia artificial, real estate, argentina, palermo, vercel, nextjs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
