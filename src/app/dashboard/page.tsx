import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  const { data: matches } = await supabase
    .from("matches")
    .select("*, user_connections(*)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("score", { ascending: false })
    .limit(50);

  return (
    <DashboardClient
      userId={user.id}
      profile={profile}
      matches={matches || []}
    />
  );
}
