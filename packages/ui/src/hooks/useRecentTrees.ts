"use client";

import { useState, useEffect, useCallback } from "react";

interface RecentTree {
  id: string;
  name: string;
  visitedAt: number;
}

const STORAGE_KEY = "familytree-recent";
const MAX_RECENT = 10;

export function useRecentTrees() {
  const [trees, setTrees] = useState<RecentTree[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setTrees(JSON.parse(stored));
    } catch {
      // ignore parse errors
    }
  }, []);

  const addTree = useCallback((id: string, name: string) => {
    setTrees((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      const next = [{ id, name, visitedAt: Date.now() }, ...filtered].slice(
        0,
        MAX_RECENT
      );
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // quota exceeded
        }
      }
      return next;
    });
  }, []);

  const removeTree = useCallback((id: string) => {
    setTrees((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // quota exceeded
        }
      }
      return next;
    });
  }, []);

  return { trees, addTree, removeTree };
}
