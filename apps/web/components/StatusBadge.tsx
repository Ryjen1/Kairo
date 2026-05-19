import type { Receipt } from "@kairo/policy";
import { cn } from "@/lib/utils";

const STYLES: Record<Receipt["status"], string> = {
  auto_approved: "status-auto-approved",
  approved_by_user: "status-approved",
  pending_user: "status-pending",
  denied_by_policy: "status-blocked",
  denied_by_user: "status-denied",
  expired: "status-expired",
  executed: "status-executed",
  execution_failed: "status-denied",
};

const LABELS: Record<Receipt["status"], string> = {
  auto_approved: "Auto-approved",
  approved_by_user: "Approved",
  pending_user: "Pending you",
  denied_by_policy: "Blocked",
  denied_by_user: "Denied",
  expired: "Expired",
  executed: "Executed",
  execution_failed: "Failed",
};

export function StatusBadge({
  status,
  className,
}: {
  status: Receipt["status"];
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        STYLES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
