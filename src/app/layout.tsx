import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "@/app/providers";
import { TRPCProvider } from "@/lib/trpc/provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "BetaOps - AI-Assisted Beta Testing Platform",
  description: "Manage beta testing across projects with AI-powered test generation, GitHub integration, and compliance features",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <TRPCProvider>
            {children}
          </TRPCProvider>
        </Providers>
      </body>
    </html>
  );
}
