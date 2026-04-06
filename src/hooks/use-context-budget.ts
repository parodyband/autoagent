import { useState } from "react";

export function useContextBudget() {
  const [contextBudgetRatio, setContextBudgetRatio] = useState(0);
  const [contextWarning, setContextWarning] = useState(false);

  return { contextBudgetRatio, setContextBudgetRatio, contextWarning, setContextWarning };
}
