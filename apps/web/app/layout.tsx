import type { Metadata } from "next";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SolanaProviders } from "../components/SolanaProviders";
import { WebSocketProvider } from "../components/WebSocketProvider";
import { WalletModal } from "../components/WalletModal";
import { TransactionToast } from "../components/TransactionToast";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-heading" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Kaido | Hybrid DEX Exchange",
  description: "Next-generation trading infrastructure on Solana with AI-assisted execution and hybrid liquidity routing.",
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable} ${jetbrains.variable} antialiased bg-background text-white`}>
        <SolanaProviders>
          <WebSocketProvider>
            {children}
            <WalletModal />
            <TransactionToast />
          </WebSocketProvider>
        </SolanaProviders>
      </body>
    </html>
  );
}
