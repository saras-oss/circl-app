"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setMagicLinkSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0A2540] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }} />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-white font-bold text-xl tracking-tight">Circl</span>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white leading-[1.15] tracking-tight">
              Your network is your
              <span className="text-gradient-accent block mt-1">unfair advantage.</span>
            </h1>
            <p className="mt-6 text-[#596780] text-base leading-relaxed">
              Turn thousands of LinkedIn connections into a scored pipeline of
              customers and investors — in minutes, not months.
            </p>

            <div className="mt-10 space-y-4">
              {[
                { num: "01", text: "Upload your LinkedIn connections" },
                { num: "02", text: "AI enriches and scores every contact" },
                { num: "03", text: "Discover who matters most" },
              ].map((step) => (
                <div key={step.num} className="flex items-center gap-4">
                  <span className="text-xs font-mono text-[#596780]">{step.num}</span>
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-sm text-[#96A0B5]">{step.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {["bg-accent", "bg-[#FFBB38]", "bg-[#8B5CF6]", "bg-[#0ABF53]"].map((color, i) => (
                <div key={i} className={`w-8 h-8 rounded-full ${color} border-2 border-[#0A2540] flex items-center justify-center`}>
                  <span className="text-white text-xs font-semibold">{["S", "A", "R", "K"][i]}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-[#596780]">
              Trusted by founders and sales leaders
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#F6F8FA]">
        <div className="w-full max-w-[400px] animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="font-bold text-xl tracking-tight">Circl</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Get started</h2>
            <p className="mt-2 text-[#596780] text-sm">
              Sign in to discover who in your network matters most.
            </p>
          </div>

          {magicLinkSent ? (
            <div className="animate-scale-in">
              <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-8 text-center">
                <div className="w-14 h-14 bg-accent-light rounded-xl flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Check your inbox</h3>
                <p className="text-[#596780] text-sm leading-relaxed">
                  We sent a sign-in link to{" "}
                  <span className="font-semibold text-[#0A2540]">{email}</span>
                </p>
                <button
                  onClick={() => setMagicLinkSent(false)}
                  className="mt-5 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 h-[52px] rounded-xl border border-[#E3E8EF] bg-white hover:bg-[#F6F8FA] hover:border-[#596780] transition-all text-sm font-semibold disabled:opacity-50 active:scale-[0.98]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-[#E3E8EF]" />
                <span className="text-xs font-medium text-[#596780] uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-[#E3E8EF]" />
              </div>

              <form onSubmit={handleMagicLink} className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full h-[52px] px-4 rounded-xl border border-[#E3E8EF] bg-white text-sm focus:border-[#0ABF53] focus:ring-2 focus:ring-[#0ABF53]/20 outline-none placeholder:text-[#96A0B5]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full h-[52px] rounded-xl bg-[#0A2540] text-white text-sm font-semibold hover:bg-[#0A2540]/80 transition-all disabled:opacity-40 active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending link...
                    </span>
                  ) : (
                    "Send magic link"
                  )}
                </button>
              </form>

              {error && (
                <div className="p-3 rounded-xl bg-[#FDE8EC] border border-[#ED5F74]/20">
                  <p className="text-sm text-[#ED5F74] text-center">{error}</p>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-xs text-[#96A0B5] mt-8 leading-relaxed">
            By continuing, you agree to Circl&apos;s Terms of Service
            and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
