import Image from "next/image";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full", className)}>
      <Image
        src="/brand/lifeos-logo.webp"
        alt="LifeOS"
        width={640}
        height={226}
        className="h-auto w-full"
        unoptimized
        loading="eager"
      />
    </span>
  );
}
