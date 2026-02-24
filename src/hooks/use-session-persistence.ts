"use client";

import { useEffect, useState } from "react";
import { loadSession, saveSession, type SessionState } from "@/lib/session";

export function useSavedSession() {
  return useState<SessionState | null>(() => loadSession())[0];
}

export function useAutosaveSession(state: SessionState | null, enabled = true) {
  useEffect(() => {
    if (!enabled || !state) return;
    saveSession(state);
  }, [enabled, state]);
}
