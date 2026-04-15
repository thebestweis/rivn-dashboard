"use client";

import { useEffect, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

const QUERY_CACHE_KEY = "RIVN_OS_QUERY_CACHE";

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
  const [isMounted, setIsMounted] = useState(false);

  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage:
        typeof window !== "undefined" ? window.localStorage : undefined,
      key: QUERY_CACHE_KEY,
      throttleTime: 1000,
    })
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 12,
        buster: "rivn-os-v3",
      }}
      onSuccess={() => {
        queryClient.resumePausedMutations().catch(() => {});
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}