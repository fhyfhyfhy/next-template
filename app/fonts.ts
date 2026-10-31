import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** 放在 `<html>` 上的字体变量；根 layout 和 global-not-found 各自渲染 `<html>`，共用这一份。 */
export const fontVariables = `${geistSans.variable} ${geistMono.variable}`;
