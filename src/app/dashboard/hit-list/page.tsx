import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HitListClient from "@/components/dashboard/HitListClient";

export default async function HitListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("subscription_tier, processing_status")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");

  return (
    <HitListClient
      userId={user.id}
      subscriptionTier={(profile.subscription_tier as string) || "free"}
      processingStatus={(profile.processing_status as string) || "idle"}
    />
  );
}
