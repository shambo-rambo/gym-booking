"use client"

import { useCallback, useEffect, useState } from "react"

export type AppMode = "RESIDENT" | "ADMIN"

const STORAGE_KEY = "residences-mode"
const MODE_CHANGE_EVENT = "residences-mode-change"

function readMode(): AppMode {
  if (typeof window === "undefined") return "RESIDENT"
  return window.localStorage.getItem(STORAGE_KEY) === "ADMIN" ? "ADMIN" : "RESIDENT"
}

// Managers can switch between a Resident view and an Admin view. The choice
// is a per-device UI preference (not permissions), so it lives in
// localStorage rather than the database, and defaults to Resident on a fresh
// login since booking is the daily task.
export function useAppMode(): [AppMode, (mode: AppMode) => void] {
  const [mode, setMode] = useState<AppMode>("RESIDENT")

  useEffect(() => {
    setMode(readMode())
    const handleChange = () => setMode(readMode())
    window.addEventListener(MODE_CHANGE_EVENT, handleChange)
    window.addEventListener("storage", handleChange)
    return () => {
      window.removeEventListener(MODE_CHANGE_EVENT, handleChange)
      window.removeEventListener("storage", handleChange)
    }
  }, [])

  const updateMode = useCallback((next: AppMode) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    window.dispatchEvent(new Event(MODE_CHANGE_EVENT))
  }, [])

  return [mode, updateMode]
}
