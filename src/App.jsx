import React, { useState, useEffect } from "react";
import SamodreiDataAgent from "./SamodreiDataAgent";
import { LeadFlowProvider } from "./context/LeadFlowContext"; // import your context provider
import { Toaster } from "@/components/ui/toaster";
import AuthPage from "./components/auth/AuthPage";
export default function App() {
  const [authUser, setAuthUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("authUser");
    if (storedUser) setAuthUser(JSON.parse(storedUser));
  }, []);

  function handleLoginSuccess(user) {
    setAuthUser(user);
  }

  function handleLogout() {
    localStorage.removeItem("authUser");
    setAuthUser(null);
  }
  return (
    <LeadFlowProvider>
      {authUser ? (
        <SamodreiDataAgent authUser={authUser} onLogout={handleLogout} />
      ) : (
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      )}
      <Toaster />
    </LeadFlowProvider>
  );
}
