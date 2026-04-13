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

  if (isBillingReadOnly) {
    return (
      <div
        className={`rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 ${className}`}
      >
        {readOnlyMessage}
      </div>
    );
  }

  if (!canManage) {
    return (
      <div
        className={`rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ${className}`}
      >
        {roleRestrictedMessage}
      </div>
    );
  }

  return null;
}