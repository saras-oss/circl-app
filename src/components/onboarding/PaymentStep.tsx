"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getPricingTier } from "@/lib/utils";
import {
  CreditCard,
  Sparkles,
  ArrowLeft,
  Users,
  Shield,
  Lock,
  Check,
  Zap,
} from "lucide-react";

interface PaymentStepProps {
  userId: string;
  userData: Record<string, unknown>;
  onComplete: () => void;
  onBack: () => void;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: () => void) => void;
    };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window.Razorpay !== "undefined") {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PaymentStep({
  userId,
  userData,
  onComplete,
  onBack,
}: PaymentStepProps) {
  const totalConnections = (userData.total_connections as number) || 0;
  const { tier, price, label } = getPricingTier(totalConnections);

  const [processing, setProcessing] = useState(false);
  const [choosingFree, setChoosingFree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePaidCheckout = useCallback(async () => {
    setProcessing(true);
    setError(null);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error("Failed to load payment gateway. Please try again.");
      }

      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tier }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create payment order");
      }

      const { order_id, key_id, amount, currency } = await res.json();

      const options: Record<string, unknown> = {
        key: key_id,
        amount,
        currency,
        name: "Circl",
        description: `${label} Plan - ${totalConnections.toLocaleString()} connections`,
        order_id,
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId,
                tier,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verifyRes.ok) {
              throw new Error("Payment verification failed");
            }

            onComplete();
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Payment verification failed"
            );
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
          },
        },
        theme: {
          color: "#0D9373",
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setProcessing(false);
    }
  }, [userId, tier, label, totalConnections, onComplete]);

  async function handleFreeTier() {
    setChoosingFree(true);
    setError(null);

    try {
      const res = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tier: "free" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to activate free tier");
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setChoosingFree(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 animate-scale-in">
          <CreditCard className="h-7 w-7 text-accent" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Choose your plan
          </h1>
          <p className="text-sm sm:text-base text-warm-500 max-w-md mx-auto leading-relaxed">
            Unlock AI-powered insights on your entire network.
          </p>
        </div>
      </div>

      {/* Premium pricing card */}
      <div className="card-elevated overflow-hidden">
        {/* Accent top stripe */}
        <div className="h-1.5 bg-gradient-to-r from-accent via-green to-accent animate-gradient" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Connection count */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
              <Users className="h-5 w-5 text-accent" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {totalConnections.toLocaleString()}
              </p>
              <p className="text-sm text-warm-500">connections in your network</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Price display */}
          <div className="text-center space-y-2 py-2">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl sm:text-5xl font-bold text-gradient-accent">
                ${price}
              </span>
              <span className="text-base text-warm-400 font-medium">/year</span>
            </div>
            <p className="text-sm text-warm-500">{label} plan</p>
          </div>

          {/* Benefits list */}
          <div className="space-y-3">
            {[
              "AI-powered scoring of every connection",
              "Identify hidden customers & investors in your network",
              "Priority enrichment and weekly insights",
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-3">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 shrink-0">
                  <Check className="h-3 w-3 text-accent" strokeWidth={2.5} />
                </div>
                <span className="text-sm text-warm-600">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Primary CTA */}
      <Button
        onClick={handlePaidCheckout}
        size="lg"
        loading={processing}
        className="w-full h-[56px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all text-base shadow-lg shadow-accent/20"
      >
        <Sparkles className="h-4.5 w-4.5" />
        Analyze all {totalConnections.toLocaleString()} connections &mdash; ${price}/year
      </Button>

      {/* Free tier option */}
      <div className="card-elevated p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warm-100 shrink-0">
              <Zap className="h-4 w-4 text-warm-500" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Free tier</p>
              <p className="text-xs text-warm-400">Analyze your top 100 decision-makers</p>
            </div>
          </div>
          <Button
            onClick={handleFreeTier}
            variant="outline"
            loading={choosingFree}
            disabled={processing}
            className="h-[44px] rounded-2xl border-2 border-border hover:border-border-strong text-sm font-semibold shrink-0 transition-all"
          >
            Try free
          </Button>
        </div>
      </div>

      {/* Trust signals */}
      <div className="flex items-center justify-center gap-3 py-1">
        <div className="flex items-center gap-1.5 text-xs text-warm-400">
          <Lock className="h-3.5 w-3.5" />
          <span>Secure payment</span>
        </div>
        <span className="text-warm-300">|</span>
        <div className="flex items-center gap-1.5 text-xs text-warm-400">
          <Shield className="h-3.5 w-3.5" />
          <span>Cancel anytime</span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive animate-fade-in">
          {error}
        </div>
      )}

      <Button
        onClick={onBack}
        variant="ghost"
        size="lg"
        className="h-[52px] rounded-2xl min-h-[44px]"
        disabled={processing}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
    </div>
  );
}
