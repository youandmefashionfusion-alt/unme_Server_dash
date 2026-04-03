"use client"
import { Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Providers } from "../lib/Providers";
import AOSInitializer from "../../components/AOSInitializer";
import AdminLayout from "../../components/AdminLayout";
import heroGraphic from "../../images/heroGraphic.svg";
const poppins = Poppins({
  subsets: ["latin"],
  display: 'swap',
  weight: ['400', '500', '600']
});

const faviconHref = typeof heroGraphic === "string" ? heroGraphic : heroGraphic?.src;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={faviconHref || "/favicon.ico"} type="image/svg+xml" sizes="any" />
        <link rel="shortcut icon" href={faviconHref || "/favicon.ico"} />
      </head>
      <body className={poppins.variable}>
        <Script
          src="https://unpkg.com/@lottiefiles/lottie-player@2.0.12/dist/lottie-player.js"
          strategy="afterInteractive"
        />
        <Toaster position="top-right" reverseOrder={false} />
        <Providers>
          <AdminLayout children={children}/>
          <AOSInitializer />
        </Providers>
      </body>
    </html>
  );
}
