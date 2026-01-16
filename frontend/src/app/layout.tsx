import type { Metadata } from "next";
import "./globals.css";
import { appConfig } from "@/config/app";
import { Toaster } from "@/components/ui/toaster";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";

export const metadata: Metadata = {
  title: appConfig.name,
  description: appConfig.description,
  icons: {
    icon: appConfig.favicon,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className="h-full overflow-hidden">
        <div className="h-full flex">
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
