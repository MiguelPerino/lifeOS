import { Sprout } from "lucide-react";
import type { ReactNode } from "react";
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      {" "}
      <div>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-14 text-center">
      <span className="mb-5 rounded-2xl bg-accent p-4 text-primary">
        <Sprout size={24} />
      </span>
      <h3 className="font-medium">{title}</h3>
      <p className="mb-5 mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
