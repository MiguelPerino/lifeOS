"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@radix-ui/react-tooltip";
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider delayDuration={250}>
        {children}
        <Toaster richColors position="bottom-right" closeButton />
      </TooltipProvider>
    </ThemeProvider>
  );
}
