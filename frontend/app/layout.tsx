import type { Metadata } from "next";
import { OIDCProvider } from './oidc-provider';
import Navbar from "./components/Navbar";
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
        <OIDCProvider>
          <Navbar />
          <div className="pt-16">
            {children}
          </div>
        </OIDCProvider>
      </body>
    </html>
  );
}
