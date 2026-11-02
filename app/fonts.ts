import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The font variables for `<html>`. The root layout and global-not-found each
 * render their own `<html>` and share these.
 */
export const fontVariables = `${geistSans.variable} ${geistMono.variable}`;
