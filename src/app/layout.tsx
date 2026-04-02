import type { Metadata } from "next";
import { Roboto_Condensed } from "next/font/google";
import "./globals.css";
import { ToastContainer } from 'react-toastify';

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-roboto-condensed",
});

export const metadata: Metadata = {
  title: "BGMI Overlay",
  description: "Professional BGMI Overlay System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={robotoCondensed.variable}>
      <body className="antialiased">
          <ToastContainer />
          {children}
      </body>
    </html>
  );
}
