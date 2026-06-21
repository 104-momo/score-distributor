import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "平时成绩小分自动计算工具",
  description: "基于学号+姓名双重检索，自动将平时成绩分配到考勤、课堂表现、课后作业三项小分，支持导出成绩明细表Excel",
  keywords: ["成绩计算", "平时成绩", "考勤", "课堂表现", "课后作业", "Excel", "成绩明细表"],
  authors: [{ name: "Z.ai Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "平时成绩小分自动计算工具",
    description: "基于学号+姓名双重检索，自动分配平时小分并导出Excel成绩明细表",
    url: "https://chat.z.ai",
    siteName: "Z.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "平时成绩小分自动计算工具",
    description: "基于学号+姓名双重检索，自动分配平时小分并导出Excel成绩明细表",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
