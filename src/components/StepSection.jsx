import React from "react";

/**
 * StepSection wrapper
 * — returns children directly because each step file already
 *   includes its own <div className="step-section ..."> element
 *   (with the correct "active" class when displayed).
 */
export default function StepSection({ children }) {
  return <>{children}</>;
}
