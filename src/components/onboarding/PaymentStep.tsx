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
          color: "#111827",
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Choose your plan
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Unlock AI-powered insights on your entire network.
        </p>
      </div>

      {/* Connection count card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
            <Users className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">
              {totalConnections.toLocaleString()} connections
            </p>
            <p className="text-sm text-gray-500">found in your network</p>
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">
              ${price}/year
            </p>
            <p className="text-xs text-gray-500">{label} plan</p>
          </div>
          <CreditCard className="h-5 w-5 text-gray-400" />
        </div>
      </div>

      {/* Primary CTA */}
      <Button
        onClick={handlePaidCheckout}
        size="lg"
        loading={processing}
        className="w-full rounded-xl"
      >
        <Sparkles className="h-4 w-4" />
        Analyze all {totalConnections.toLocaleString()} connections &mdash; ${price}/year
      </Button>

      {/* Secondary CTA */}
      <Button
        onClick={handleFreeTier}
        variant="outline"
        size="lg"
        loading={choosingFree}
        disabled={processing}
        className="w-full rounded-xl"
      >
        Try free &mdash; analyze your top 100 decision-makers
      </Button>

      {/* Trust signals */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
        <Shield className="h-3.5 w-3.5" />
        <span>Secure payment via Razorpay. Cancel anytime.</span>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <Button
        onClick={onBack}
        variant="ghost"
        size="lg"
        className="rounded-xl"
        disabled={processing}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
    </div>
  );
}
