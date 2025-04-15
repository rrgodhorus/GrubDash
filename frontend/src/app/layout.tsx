import type { Metadata } from "next";
import { OIDCProvider } from './oidc-provider';
import "./globals.css";

export const metadata: Metadata = {
  title: "GrubDash",
  description: "Food Delivery App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <OIDCProvider>{children}</OIDCProvider>
      </body>
    </html>
  );
}
