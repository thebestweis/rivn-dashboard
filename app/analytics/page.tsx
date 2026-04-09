import { Suspense } from "react";
import AnalyticsPageClient from "./analytics-page-client";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0F1A]" />}>
      <AnalyticsPageClient />
    </Suspense>
  );
}