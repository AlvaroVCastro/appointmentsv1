import type { Metadata } from "next";
import "./globals.css";
import { appConfig } from "@/config/app";
import { Toaster } from "@/components/ui/toaster";

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
        <div className="h-full flex flex-col">
            {children}
        </div>
            <Toaster />
      </body>
    </html>
  );
}
