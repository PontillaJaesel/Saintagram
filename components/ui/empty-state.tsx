import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-sage-200 bg-sage-50/50 px-6 py-10 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-[var(--radius-base)] bg-white text-sage-600 shadow-sm">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 className="font-serif text-xl font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
