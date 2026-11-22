import { useCallback, useEffect, useRef, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState("");
  const timer = useRef();
  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(""), 4200);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [toast, notify];
}
