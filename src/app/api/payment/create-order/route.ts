import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, tier, amount, connectionCount } = await request.json();

    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // If Razorpay keys are not set, return mock order for testing
    if (!keyId || !keySecret) {
      return NextResponse.json({
        orderId: "mock_order_" + Date.now(),
        keyId: "",
        amount,
        currency: "USD",
      });
    }

    // Dynamic import of Razorpay
    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "USD",
      receipt: userId,
      notes: {
        tier,
        connectionCount: String(connectionCount),
      },
    });

    return NextResponse.json({
      orderId: order.id,
      keyId,
      amount,
      currency: "USD",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
