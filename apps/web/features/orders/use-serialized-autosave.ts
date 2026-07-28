"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "draft" | "saved" | "saving" | "unsaved" | "failed" | "stale";

export function useSerializedAutosave(delay = 850) {
  const [state, setState] = useState<SaveState>("draft");
  const [failureMessage, setFailureMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const stopped = useRef(false);
  const lastTask = useRef<(() => Promise<void>) | undefined>(undefined);

  const execute = useCallback((task: () => Promise<void>) => {
    if (stopped.current) return;
    lastTask.current = task;
    setState("saving");
    setFailureMessage("");
    queue.current = queue.current
      .catch(() => undefined)
      .then(task)
      .then(() => setState("saved"))
      .catch((error: unknown) => {
        const stale = error instanceof Error && error.message.includes("ORDER_STALE");
        if (stale) stopped.current = true;
        setFailureMessage(
          stale
            ? "This draft changed elsewhere. Reload the latest version before continuing."
            : error instanceof Error &&
                (error.message.startsWith("Amount") || error.message.startsWith("Tax percentage"))
              ? error.message
              : "Your changes were not saved. Review this step and retry.",
        );
        setState(stale ? "stale" : "failed");
      });
  }, []);

  const schedule = useCallback(
    (task: () => Promise<void>) => {
      if (stopped.current) return;
      setState("unsaved");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => execute(task), delay);
    },
    [delay, execute],
  );

  const runNow = useCallback(
    (task: () => Promise<void>) => {
      clearTimeout(timer.current);
      execute(task);
    },
    [execute],
  );

  const retry = useCallback(() => {
    if (lastTask.current && !stopped.current) execute(lastTask.current);
  }, [execute]);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { state, failureMessage, schedule, runNow, retry };
}
