type AuthTelemetryEvent = {
  event: string;
  email?: string;
  path?: string;
  message?: string;
  details?: Record<string, unknown>;
};

export function reportAuthTelemetry(event: AuthTelemetryEvent) {
  if (typeof window === "undefined") return;

  const payload = {
    ...event,
    path: event.path ?? window.location.pathname,
    userAgent: window.navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  fetch("/api/auth-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Telemetry must never block auth.
  });
}
