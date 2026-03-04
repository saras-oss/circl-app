import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      userId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      tier,
      connectionCount,
    } = await request.json();

    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Free tier: no payment verification needed
    if (tier === "free") {
      const { error: paymentError } = await supabaseAdmin
        .from("payments")
        .insert({
          user_id: userId,
          status: "captured",
          amount: 0,
          currency: "USD",
          tier: "free",
          connection_count: connectionCount || 0,
        });

      if (paymentError) {
        return NextResponse.json(
          { error: paymentError.message },
          { status: 500 }
        );
      }

      const { error: userError } = await supabaseAdmin
        .from("users")
        .update({
          subscription_tier: "free",
          subscription_status: "active",
        })
        .eq("id", userId);

      if (userError) {
        return NextResponse.json({ error: userError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Paid tiers: verify Razorpay signature if keys are set
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keySecret && razorpayOrderId && razorpayPaymentId && razorpaySignature) {
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (expectedSignature !== razorpaySignature) {
        return NextResponse.json(
          { error: "Invalid payment signature" },
          { status: 400 }
        );
      }
    }

    // Insert payment record
    const { error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: userId,
        razorpay_payment_id: razorpayPaymentId || null,
        razorpay_order_id: razorpayOrderId || null,
        status: "captured",
        amount: tier === "starter" ? 100 : tier === "growth" ? 300 : tier === "scale" ? 500 : 700,
        currency: "USD",
        tier,
        connection_count: connectionCount || 0,
      });

    if (paymentError) {
      return NextResponse.json(
        { error: paymentError.message },
        { status: 500 }
      );
    }

    // Update user subscription
    const { error: userError } = await supabaseAdmin
      .from("users")
      .update({
        subscription_tier: tier,
        subscription_status: "active",
      })
      .eq("id", userId);

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
