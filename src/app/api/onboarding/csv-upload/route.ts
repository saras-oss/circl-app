import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { chunkArray } from "@/lib/utils";

interface ConnectionRow {
  firstName: string;
  lastName: string;
  emailAddress: string;
  company: string;
  position: string;
  connectedOn: string;
  linkedinUrl: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, connections } = (await request.json()) as {
      userId: string;
      connections: ConnectionRow[];
    };

    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!connections || !Array.isArray(connections) || connections.length === 0) {
      return NextResponse.json(
        { error: "No connections provided" },
        { status: 400 }
      );
    }

    // Ensure public.users row exists before inserting connections
    const { data: userExists } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (!userExists) {
      await supabaseAdmin.from("users").upsert(
        { id: userId, email: user.email },
        { onConflict: "id", ignoreDuplicates: true }
      );
    }

    const rows = connections.map((c) => ({
      user_id: userId,
      first_name: c.firstName || "",
      last_name: c.lastName || "",
      email_address: c.emailAddress || "",
      company: c.company || "",
      position: c.position || "",
      connected_on: c.connectedOn || null,
      linkedin_url: c.linkedinUrl || "",
      classification_status: "pending",
      enrichment_status: "pending",
    }));

    const batches = chunkArray(rows, 500);
    let totalInserted = 0;

    for (const batch of batches) {
      const { data, error } = await supabaseAdmin
        .from("user_connections")
        .insert(batch)
        .select("id");

      if (error) {
        const isFkError = error.message.includes("foreign key constraint");
        return NextResponse.json(
          {
            error: isFkError
              ? "Something went wrong with your account. Please try logging out and back in."
              : error.message,
          },
          { status: isFkError ? 400 : 500 }
        );
      }

      totalInserted += data?.length || 0;
    }

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ total_connections: totalInserted })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: totalInserted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
