import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { chunkArray } from "@/lib/utils";

interface ConnectionRow {
  first_name: string;
  last_name: string;
  linkedin_url: string;
  email_address: string;
  company: string;
  position: string;
  connected_on: string | null;
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

    if (
      !connections ||
      !Array.isArray(connections) ||
      connections.length === 0
    ) {
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

    // Split rows: those with linkedin_url → upsert, those without → insert
    const upsertRows: Record<string, unknown>[] = [];
    const insertRows: Record<string, unknown>[] = [];

    for (const c of connections) {
      const row = {
        user_id: userId,
        first_name: c.first_name || "",
        last_name: c.last_name || "",
        linkedin_url: c.linkedin_url || "",
        email_address: c.email_address || "",
        company: c.company || "",
        position: c.position || "",
        connected_on: c.connected_on || null,
        classification_status: "pending",
        enrichment_status: "pending",
      };

      if (c.linkedin_url && c.linkedin_url.includes("linkedin.com")) {
        upsertRows.push(row);
      } else {
        insertRows.push(row);
      }
    }

    let totalProcessed = 0;

    // Upsert rows with linkedin_url (dedup on user_id + linkedin_url)
    if (upsertRows.length > 0) {
      const batches = chunkArray(upsertRows, 500);
      for (const batch of batches) {
        const { data, error } = await supabaseAdmin
          .from("user_connections")
          .upsert(batch, { onConflict: "user_id,linkedin_url" })
          .select("id");

        if (error) {
          // If unique constraint doesn't exist yet, fall back to insert
          if (error.message.includes("unique") || error.message.includes("constraint")) {
            const { data: insertData, error: insertError } = await supabaseAdmin
              .from("user_connections")
              .insert(batch)
              .select("id");

            if (insertError) {
              const isFkError = insertError.message.includes("foreign key constraint");
              return NextResponse.json(
                {
                  error: isFkError
                    ? "Something went wrong with your account. Please try logging out and back in."
                    : insertError.message,
                },
                { status: isFkError ? 400 : 500 }
              );
            }
            totalProcessed += insertData?.length || 0;
          } else {
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
        } else {
          totalProcessed += data?.length || 0;
        }
      }
    }

    // Insert rows without linkedin_url (no dedup possible)
    if (insertRows.length > 0) {
      const batches = chunkArray(insertRows, 500);
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
        totalProcessed += data?.length || 0;
      }
    }

    // Update total connections count
    const { count: totalConnections } = await supabaseAdmin
      .from("user_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    await supabaseAdmin
      .from("users")
      .update({ total_connections: totalConnections || totalProcessed })
      .eq("id", userId);

    return NextResponse.json({ success: true, count: totalProcessed });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
