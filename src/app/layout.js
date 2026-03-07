"use client"
import { Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Providers } from "../lib/Providers";
import AOSInitializer from "../../components/AOSInitializer";
import AdminLayout from "../../components/AdminLayout";
const poppins = Poppins({
  subsets: ["latin"],
  display: 'swap',
  weight: ['400', '500', '600']
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={poppins.variable}>
        <Toaster position="top-right" reverseOrder={false} />
        <Providers>
          <AdminLayout children={children}/>
          <AOSInitializer />
        </Providers>
      </body>
    </html>
  );
}
