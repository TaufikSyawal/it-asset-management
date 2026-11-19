"use client";

import React, { useState } from "react";
import { signIn, signUp, requestPasswordReset } from "@/services/authService";
import { UserSession } from "@/types";
import { Shield, Lock, Mail, AlertCircle, ArrowRight, CheckCircle2, User, KeyRound, Clock, ArrowLeft } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (user: UserSession) => void;
}

type AuthMode = "SIGN_IN" | "SIGN_UP" | "FORGOT_PASSWORD" | "REGISTRATION_SUCCESS";

// Feature Guard: Keep Sign Up disabled in production until backend authorization and approval safeguards are successfully applied and verified
const IS_SIGN_UP_ENABLED = false;

export default function AuthModal({ isOpen, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("SIGN_IN");
  
  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setError(null);
    setInfoMessage(null);
    setPassword("");
    setConfirmPassword("");
  };

  const switchMode = (newMode: AuthMode) => {
    if (newMode === "SIGN_UP" && !IS_SIGN_UP_ENABLED) return;
    resetForm();
    setMode(newMode);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown) return;
    setError(null);
    setLoading(true);

    try {
      const res = await signIn({ email, password });
      if (res.error || !res.user) {
        setError(res.error || "Authentication failed. Please verify your credentials.");
        // Apply temporary client-side cooldown to mitigate rapid-fire brute-force attempts
        setCooldown(true);
        setTimeout(() => setCooldown(false), 2000);
      } else {
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown) return;
    setError(null);

    // Client-side validations
    if (!name.trim() || name.trim().length < 2) {
      setError("Please enter your full name (minimum 2 characters).");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid corporate email address.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters in length.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (res.error) {
        setError(res.error);
        setCooldown(true);
        setTimeout(() => setCooldown(false), 2500);
      } else {
        setInfoMessage(res.message || "Registration submitted successfully!");
        setMode("REGISTRATION_SUCCESS");
      }
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown) return;
    setError(null);
    setInfoMessage(null);

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter your registered corporate email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await requestPasswordReset(email.trim());
      if (res.error) {
        setError(res.error);
      } else {
        setInfoMessage(res.message || "Password recovery instructions have been sent to your email.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to process password recovery request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-28 h-28 bg-brand-500/10 rounded-full blur-xl" />
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600/30 border border-brand-400/40 text-brand-400 mb-3 shadow-inner">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">IT Asset Management System</h2>
          <p className="text-xs text-slate-300 mt-1 font-medium">
            Authorized Enterprise Access • GMD | GMC | TEL | RCI
          </p>

          {/* Mode Switch Tabs (for Sign In vs Sign Up) */}
          {mode !== "REGISTRATION_SUCCESS" && IS_SIGN_UP_ENABLED && (
            <div className="flex bg-slate-800/80 p-1 rounded-xl mt-4 border border-slate-700/60 text-xs">
              <button
                type="button"
                onClick={() => switchMode("SIGN_IN")}
                className={`flex-1 py-1.5 font-semibold rounded-lg transition-all ${
                  mode === "SIGN_IN" || mode === "FORGOT_PASSWORD"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode("SIGN_UP")}
                className={`flex-1 py-1.5 font-semibold rounded-lg transition-all ${
                  mode === "SIGN_UP"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Create Account
              </button>
            </div>
          )}
        </div>

        {/* Form Body */}
        <div className="p-6">
          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Authentication Notice</span>
                <span className="leading-relaxed">{error}</span>
              </div>
            </div>
          )}

          {/* Info Alert */}
          {infoMessage && mode !== "REGISTRATION_SUCCESS" && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{infoMessage}</span>
            </div>
          )}

          {/* 1. SIGN IN FORM */}
          {mode === "SIGN_IN" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corporate Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Account Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode("FORGOT_PASSWORD")}
                    className="text-[11px] font-medium text-brand-600 hover:text-brand-700 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || cooldown}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 rounded-lg shadow-sm shadow-brand-200 transition-all mt-2"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-3 border-t border-slate-100 text-center text-xs text-slate-500">
                {IS_SIGN_UP_ENABLED ? (
                  <>
                    New team member?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("SIGN_UP")}
                      className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      Register an account
                    </button>
                  </>
                ) : (
                  <span className="text-slate-400">
                    Need system access? Contact your Super Admin to request an enterprise account.
                  </span>
                )}
              </div>
            </form>
          )}

          {/* 2. SIGN UP FORM */}
          {mode === "SIGN_UP" && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Budi Santoso"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corporate Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password (min. 6 characters)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Security Governance Notice */}
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                <span className="font-semibold block mb-0.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" /> Account Approval Policy
                </span>
                New accounts receive the <strong>EMPLOYEE</strong> role in <strong>Pending Approval</strong> state with zero initial company access. A Super Admin must approve your account before access is granted.
              </div>

              <button
                type="submit"
                disabled={loading || cooldown}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 rounded-lg shadow-sm shadow-brand-200 transition-all mt-1"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting Registration...
                  </span>
                ) : (
                  <>
                    <span>Submit Account Registration</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("SIGN_IN")}
                  className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* 3. FORGOT PASSWORD FORM */}
          {mode === "FORGOT_PASSWORD" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="text-xs text-slate-600 leading-relaxed">
                Enter your registered corporate email address and we will dispatch a secure password recovery link to your inbox.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corporate Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || cooldown}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 rounded-lg shadow-sm shadow-brand-200 transition-all"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending Recovery Link...
                  </span>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Send Password Recovery Link</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => switchMode("SIGN_IN")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* 4. REGISTRATION SUCCESS CONFIRMATION */}
          {mode === "REGISTRATION_SUCCESS" && (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900">Registration Received!</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Your account has been created in <strong>Pending Approval</strong> state.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-600 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">
                    1
                  </div>
                  <span>Check your email inbox at <strong>{email}</strong> to verify your email address.</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">
                    2
                  </div>
                  <span>Your organization's Super Admin will review and approve your corporate access.</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => switchMode("SIGN_IN")}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow transition-all"
              >
                Return to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
