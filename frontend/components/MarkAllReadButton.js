// components/MarkAllReadButton.js
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MarkAllReadButton({ disabled }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markAll() {
    setLoading(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      window.dispatchEvent(new Event("notifications:updated"));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={markAll}
      disabled={disabled || loading}
      className="min-h-10 rounded-md bg-[var(--navy-600)] px-4 text-sm font-bold text-white transition hover:bg-[var(--navy-800)] disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {loading ? "處理中..." : "全部已讀"}
    </button>
  );
}