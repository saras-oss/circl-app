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
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#F5F3FF] animate-scale-in">
          <CreditCard className="h-7 w-7 text-[#7C3AED]" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A2540]">
            Choose your plan
          </h1>
          <p className="text-sm sm:text-base text-[#596780] max-w-md mx-auto leading-relaxed">
            Unlock AI-powered insights on your entire network.
          </p>
        </div>
      </div>

      {/* Premium pricing card */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] overflow-hidden">
        {/* Accent top stripe */}
        <div className="h-1.5 bg-gradient-to-r from-[#635BFF] via-[#7C3AED] to-[#635BFF] animate-gradient" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Connection count */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF2FF]">
              <Users className="h-5 w-5 text-[#635BFF]" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#0A2540]">
                {totalConnections.toLocaleString()}
              </p>
              <p className="text-sm text-[#596780]">connections in your network</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#E3E8EF]" />

          {/* Price display */}
          <div className="text-center space-y-2 py-2">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl sm:text-5xl font-bold text-gradient-accent">
                ${price}
              </span>
              <span className="text-base text-[#96A0B5] font-medium">/year</span>
            </div>
            <p className="text-sm text-[#596780]">{label} plan</p>
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
                <span className="text-sm text-[#596780]">{benefit}</span>
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
        className="w-full h-[56px] rounded-xl bg-[#0A2540] text-white font-semibold hover:bg-[#0A2540]/90 active:scale-[0.98] transition-all text-base shadow-lg shadow-[#0A2540]/20"
      >
        <Sparkles className="h-4.5 w-4.5" />
        Analyze all {totalConnections.toLocaleString()} connections &mdash; ${price}/year
      </Button>

      {/* Free tier option */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F3F7] shrink-0">
              <Zap className="h-4 w-4 text-[#596780]" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0A2540]">Free tier</p>
              <p className="text-xs text-[#96A0B5]">Analyze your top 100 decision-makers</p>
            </div>
          </div>
          <Button
            onClick={handleFreeTier}
            variant="outline"
            loading={choosingFree}
            disabled={processing}
            className="h-[44px] rounded-xl border border-[#E3E8EF] hover:border-[#596780] text-sm font-semibold shrink-0 transition-all"
          >
            Try free
          </Button>
        </div>
      </div>

      {/* Trust signals */}
      <div className="flex items-center justify-center gap-3 py-1">
        <div className="flex items-center gap-1.5 text-xs text-[#96A0B5]">
          <Lock className="h-3.5 w-3.5" />
          <span>Secure payment</span>
        </div>
        <span className="text-[#96A0B5]">|</span>
        <div className="flex items-center gap-1.5 text-xs text-[#96A0B5]">
          <Shield className="h-3.5 w-3.5" />
          <span>Cancel anytime</span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-[#FDE8EC] border border-[#ED5F74]/20 p-4 text-sm text-[#ED5F74] animate-fade-in">
          {error}
        </div>
      )}

      <Button
        onClick={onBack}
        variant="ghost"
        size="lg"
        className="h-[52px] rounded-xl min-h-[44px]"
        disabled={processing}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
    </div>
  );
}
