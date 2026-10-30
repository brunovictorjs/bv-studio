import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Jost } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const jost = Jost({ variable: "--font-jost", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["300", "400"] });

export const metadata: Metadata = {
  title: { default: "BV Studio · Agendamento para salões e barbearias", template: "%s · BV Studio" },
  description:
    "Demo de software de agendamento multiunidade: site do cliente, app do profissional e painel de gestão. Desenvolvido por Bruno Victor.",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#161616",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${jost.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
