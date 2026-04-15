"use client";

import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 60,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        refetchInterval: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(createQueryClient);

  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage:
        typeof window !== "undefined" ? window.localStorage : undefined,
      key: "RIVN_OS_QUERY_CACHE",
      throttleTime: 1000,
    })
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 12,
        buster: "rivn-os-v2",
      }}
      onSuccess={() => {
        queryClient.resumePausedMutations().catch(() => {});
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}