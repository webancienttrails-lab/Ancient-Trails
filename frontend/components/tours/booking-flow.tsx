"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BookingStage = 0 | 1 | 2 | 3 | 4;
export type BookingFieldIssue = {
  id: string;
  message: string;
  selector: string;
  travellerId?: string;
  stage?: BookingStage;
};
export function bookingFieldId(travellerId: string, field: string) {
  return `booking-${travellerId}-${field.replace(/\s+/g, "-")}`;
}
export const bookingStages = ["Sign in", "Date & guests", "Room", "Your details", "Review & pay"] as const;
type BookingFlow = {
  stage: BookingStage;
  onStageChange: (stage: BookingStage) => void;
  onAuthReadyChange: (ready: boolean) => void;
  onExit: () => void;
  errors: BookingFieldIssue[];
  validationAttempt: number;
  onIssueFocus: (issue: BookingFieldIssue) => void;
};
const BookingFlowContext = createContext<BookingFlow | null>(null);

export function BookingFlowProvider({ children, ...value }: BookingFlow & { children: ReactNode }) {
  return <BookingFlowContext.Provider value={value}>{children}</BookingFlowContext.Provider>;
}

export function useBookingFlow() {
  const flow = useContext(BookingFlowContext);
  if (!flow) throw new Error("Booking controls require BookingFlowProvider.");
  return flow;
}

export function useBookingFieldProps() {
  const { errors } = useBookingFlow();
  return (id: string, validationId = id) => {
    const issue = errors.find(error => error.id === id || error.id === validationId);
    return { id, "aria-invalid": Boolean(issue), "aria-describedby": issue ? issue.id + "-error" : undefined };
  };
}

export function BookingErrorSummary() {
  const { errors, validationAttempt, onIssueFocus } = useBookingFlow();
  if (!errors.length) return null;
  return (
    <div key={validationAttempt} id="booking-form-errors" role="alert" aria-live="polite" aria-atomic="true" aria-labelledby="booking-errors-title" tabIndex={-1}
      className="mb-4 rounded-[8px] border border-destructive/30 bg-destructive/5 p-4 font-sans text-[14px] text-destructive outline-none focus:ring-2 focus:ring-destructive/30">
      <h2 id="booking-errors-title" className="font-semibold">Please check the following before continuing</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {errors.map(issue => <li id={issue.id + "-error"} key={issue.id}>
          <a className="underline underline-offset-2" href={"#" + issue.id} onClick={event => { event.preventDefault(); onIssueFocus(issue); }}>{issue.message}</a>
        </li>)}
      </ul>
    </div>
  );
}

export function BookingProgress() {
  const { stage, onStageChange, onExit } = useBookingFlow();
  return (
    <nav aria-label="Booking steps" className="lg:hidden">
      <ol className="mb-3 grid grid-cols-5 gap-1">
        {bookingStages.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              aria-current={stage === index ? "step" : undefined}
              disabled={index > stage}
              onClick={() => onStageChange(index as BookingStage)}
              className={cn("h-full w-full rounded-[6px] border px-1 py-2 font-sans text-[10px] font-semibold leading-tight disabled:opacity-45", stage === index ? "border-primary bg-primary/5 text-brand-text" : "border-border text-secondary")}
            >
              <span className="mb-1 block">{index}</span>{label}
            </button>
          </li>
        ))}
      </ol>
      <div className="mb-3 flex items-center justify-between gap-3 font-sans text-[13px]">
        <span role="status" aria-live="polite">Step {stage} of 4: {bookingStages[stage]}</span>
        {stage > 0
          ? <button type="button" onClick={() => onStageChange((stage - 1) as BookingStage)} className="font-semibold text-button-outline underline underline-offset-4">Back</button>
          : <button type="button" onClick={onExit} className="font-semibold text-button-outline underline underline-offset-4">View tour</button>}
      </div>
    </nav>
  );
}
