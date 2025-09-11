import { createContext, useContext, useState } from "react";

const LeadFlowContext = createContext();

export const useLeadFlow = () => useContext(LeadFlowContext);

export function LeadFlowProvider({ children }) {
  const [flowData, setFlowData] = useState({});

  const updateFlowData = (step, data) => {
    setFlowData((prev) => ({ ...prev, [step]: data }));
  };

  return (
    <LeadFlowContext.Provider value={{ flowData, updateFlowData }}>
      {children}
    </LeadFlowContext.Provider>
  );
}

export function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem("authUser") || "null");
  } catch {
    return null;
  }
}

export function getAuthHeaders() {
  const a = getAuthUser();
  const src = a && a.user_id ? String(a.user_id) : null;
  const h = {};
  if (src) h["X-User-Id"] = src;
  return h;
}
