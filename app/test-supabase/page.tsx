"use client";

import { useEffect, useState } from "react";
import { fetchClientsFromSupabase } from "../lib/supabase/clients";

export default function TestSupabasePage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchClientsFromSupabase()
      .then(setItems)
      .catch((err) => {
        console.error(err);
        setError(err.message ?? "Unknown error");
      });
  }, []);

  return (
    <div style={{ padding: 24, color: "white", background: "#0B0F1A", minHeight: "100vh" }}>
      <h1>Supabase clients test</h1>
      {error ? <p style={{ color: "tomato" }}>{error}</p> : null}
      <pre>{JSON.stringify(items, null, 2)}</pre>
    </div>
  );
}