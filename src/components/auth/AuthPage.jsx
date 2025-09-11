import React, { useState, useEffect } from "react";
import { useToast } from "../ui/use-toast";

export default function AuthPage({ onLoginSuccess }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  // keep user logged in across refresh (safe parse)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("authUser");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed) onLoginSuccess(parsed);
      }
    } catch (e) {
      // malformed localStorage item — ignore
      console.warn("authUser parse failed:", e);
    }
  }, [onLoginSuccess]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = isSignup ? "signup" : "login";
    try {
      const resp = await fetch(`http://localhost:8000/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const text = await resp.text();
      // try to parse json when possible
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { message: text };
      }

      if (!resp.ok) {
        const msg =
          data?.detail || data?.message || text || `HTTP ${resp.status}`;
        setError(msg);
        setLoading(false);
        return;
      }

      // persist minimal auth object returned by backend
      localStorage.setItem("authUser", JSON.stringify(data));
      if (onLoginSuccess) onLoginSuccess(data);
      if (isSignup) {
        toast({
          title: "🎉 Account created",
          description:
            "Your account has been created successfully. You're now logged in.",
          duration: 4000,
        });
      } else {
        toast({
          title: "👋 Welcome back",
          description: `Logged in as ${data.email || "your account"}`,
          duration: 3000,
        });
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="step-section active">
      <div className="step-header">
        <h1 className="step-title">{isSignup ? "Sign Up" : "Login"}</h1>
        <p className="step-description">
          {isSignup ? "Create a new account" : "Login to continue"}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ maxWidth: "400px", margin: "auto" }}
      >
        {error && (
          <div style={{ color: "red", marginBottom: 12 }}>{String(error)}</div>
        )}

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-large"
          style={{ marginTop: "1rem" }}
          disabled={loading}
        >
          {loading
            ? isSignup
              ? "Signing up…"
              : "Logging in…"
            : isSignup
            ? "Sign Up"
            : "Login"}
        </button>
      </form>

      <div style={{ marginTop: "1rem", textAlign: "center" }}>
        <button
          type="button" // IMPORTANT: not a submit button
          className="btn btn-secondary btn-sm"
          onClick={() => setIsSignup((s) => !s)}
          disabled={loading}
        >
          {isSignup
            ? "Already have an account? Login"
            : "Need an account? Sign Up"}
        </button>
      </div>
    </div>
  );
}
