import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const FALLBACK_MACHINE_ID = "UNKNOWN-MACHINE";
const MACHINE_ID_CACHE_KEY = "moh_machine_id_cache";

// Poll the backend every 30 seconds to detect session expiry
const POLL_INTERVAL_MS = 30_000;

type LicenseStatusResponse = {
  is_valid: boolean;
  machine_id: string;
  run_count: number;
  max_runs: number;
  max_runtime_minutes: number;
  error_msg: string | null;
  is_decoy_error: boolean;
  /** Remaining session seconds; -1 means no time limit */
  session_remaining_secs: number;
};

type UseLicenseState = {
  isLoading: boolean;
  isLocked: boolean;
  isDecoyError: boolean;
  machineId: string;
  sessionRemainingSecs: number;
  refresh: () => Promise<void>;
};

export function useLicense(): UseLicenseState {
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isDecoyError, setIsDecoyError] = useState(false);
  const [sessionRemainingSecs, setSessionRemainingSecs] = useState(-1);
  const [machineId, setMachineId] = useState<string>(
    localStorage.getItem(MACHINE_ID_CACHE_KEY) ?? FALLBACK_MACHINE_ID,
  );
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const status = await invoke<LicenseStatusResponse>("get_license_status");
      const incomingMachineId = status.machine_id || FALLBACK_MACHINE_ID;

      setMachineId(incomingMachineId);
      localStorage.setItem(MACHINE_ID_CACHE_KEY, incomingMachineId);
      setIsLocked(!status.is_valid);
      setIsDecoyError(status.is_decoy_error);
      setSessionRemainingSecs(status.session_remaining_secs ?? -1);
    } catch {
      setIsLocked(true);
      setIsDecoyError(false);
      setSessionRemainingSecs(0);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await refresh();
      setIsLoading(false);
    };
    void init();
  }, [refresh]);

  // Periodic polling — backend Monotonic clock is the source of truth
  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [refresh]);

  return useMemo(
    () => ({
      isLoading,
      isLocked,
      isDecoyError,
      machineId,
      sessionRemainingSecs,
      refresh,
    }),
    [isLoading, isLocked, isDecoyError, machineId, sessionRemainingSecs, refresh],
  );
}
