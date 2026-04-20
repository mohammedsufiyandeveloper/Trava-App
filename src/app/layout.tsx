import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Tusker Management — Project & Task Management Platform",
  description: "Streamline your project workflow with Tusker Management. Track tasks, manage teams, and deliver projects on time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster closeButton position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
