'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  { label: 'Researching...', icon: 'search' },
  { label: 'Analyzing...', icon: 'analyze' },
  { label: 'Generating Persona...', icon: 'brain' },
  { label: 'Calculating Confidence...', icon: 'gauge' },
  { label: 'Preparing Recommendations...', icon: 'target' },
  { label: 'Complete', icon: 'check' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  onComplete?: () => void;
}

export function ProcessingDialog({ open, onOpenChange, contactName, onComplete }: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setDone(false);
      return;
    }

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= STEPS.length) {
        clearInterval(interval);
        setDone(true);
        setTimeout(() => {
          onComplete?.();
        }, 800);
      } else {
        setCurrentStep(step);
      }
    }, 900);

    return () => clearInterval(interval);
  }, [open, onComplete]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 text-center">
          <h2 className="text-lg font-bold">Generating Intelligence</h2>
          <p className="text-sm text-muted-foreground mt-1">for {contactName}</p>
        </div>

        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const isComplete = done || i < currentStep;
            const isActive = i === currentStep && !done;
            return (
              <div key={i} className="flex items-center gap-3">
                <div className={`
                  flex h-8 w-8 items-center justify-center rounded-full shrink-0 transition-all
                  ${isComplete ? 'bg-emerald-100 dark:bg-emerald-900/30' : isActive ? 'bg-primary/10' : 'bg-muted'}
                `}>
                  {isComplete ? (
                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive ? (
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <span className={`
                  text-sm transition-colors
                  ${isComplete ? 'text-foreground font-medium' : isActive ? 'text-foreground' : 'text-muted-foreground'}
                `}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {done && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => {
                onOpenChange(false);
                onComplete?.();
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              View Intelligence
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
