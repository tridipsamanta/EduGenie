import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EduGenie API Backend",
  description: "AI-Powered Exam Preparation Backend API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
