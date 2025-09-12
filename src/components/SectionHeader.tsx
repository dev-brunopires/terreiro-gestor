"use client";
import { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
};

export function SectionHeader({ icon: Icon, title, description, className }: Props) {
  return (
    <div className={`flex items-start gap-3 ${className ?? ""}`}>
      <div className="mt-0.5 rounded-md bg-primary/10 p-1.5">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <div className="font-medium leading-tight text-foreground">{title}</div>
        {description && (
          <div className="text-sm text-muted-foreground leading-snug">{description}</div>
        )}
      </div>
    </div>
  );
}
