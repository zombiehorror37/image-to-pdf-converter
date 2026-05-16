import { useCallback, useRef, useState } from 'react';

// Wraps the recurring isProcessing / step / progress / AbortController dance.
// `run(fn)` resolves with whatever fn returns, or `undefined` if cancelled.
// `cancel()` aborts the active operation.
export function useAsyncOperation() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState('');
  const [progress, setProgress] = useState(0);
  const controllerRef = useRef(null);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const run = useCallback(async (fn, { initialStep = '' } = {}) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsProcessing(true);
    setStep(initialStep);
    setProgress(0);
    try {
      const result = await fn({
        signal: controller.signal,
        setStep,
        setProgress,
      });
      if (controller.signal.aborted) return undefined;
      return result;
    } finally {
      controllerRef.current = null;
      setIsProcessing(false);
      setStep('');
      setProgress(0);
    }
  }, []);

  const isAborted = () => !!controllerRef.current?.signal.aborted;

  return {
    isProcessing,
    step,
    progress,
    setStep,
    setProgress,
    run,
    cancel,
    isAborted,
    // expose the active controller for callers that need to gate UI
    // (e.g. only show the cancel button while one exists)
    hasActive: () => controllerRef.current != null,
  };
}
