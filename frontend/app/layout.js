import "./globals.css";

export const metadata = {
  title: "TSMC 企業訂餐平台",
  description: "員工、商家與福委會共用的企業訂餐入口",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant" className="h-full">
      <body className="min-h-full text-[var(--navy-900)] antialiased">{children}</body>
    </html>
  );
}
