type BillingAccessBannerProps = {
  isLoading?: boolean;
  isBillingReadOnly: boolean;
  canManage: boolean;
  readOnlyMessage: string;
  roleRestrictedMessage: string;
  className?: string;
};

export function BillingAccessBanner({
  isLoading = false,
  isBillingReadOnly,
  canManage,
  readOnlyMessage,
  roleRestrictedMessage,
  className = "",
}: BillingAccessBannerProps) {
  if (isLoading) {
    return null;
  }

  const baseClassName =
    "rounded-2xl px-4 py-3 text-sm";

  if (isBillingReadOnly) {
    return (
      <div
        className={`${baseClassName} border border-red-500/20 bg-red-500/10 text-red-200 ${className}`}
      >
        {readOnlyMessage}
      </div>
    );
  }

  if (!canManage) {
    return (
      <div
        className={`${baseClassName} border border-amber-500/20 bg-amber-500/10 text-amber-200 ${className}`}
      >
        {roleRestrictedMessage}
      </div>
    );
  }

  return null;
}