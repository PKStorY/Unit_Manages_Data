import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const kanit = Kanit({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-kanit",
});

export const metadata: Metadata = {
  title: "ระบบบริหารข้อมูลการดำเนินงานศูนย์ไกล่เกลี่ยข้อพิพาทภาคประชาชน",
  description: "ระบบฐานข้อมูลรายงานประจำเดือนและประเมินตนเององค์กรต้นแบบ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${kanit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
