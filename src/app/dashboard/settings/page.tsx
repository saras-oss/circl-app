import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "@/components/dashboard/SettingsClient";

export default async function SettingsPage() {
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

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "captured")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <SettingsClient
      userId={user.id}
      profile={profile || {}}
      payment={payment}
    />
  );
}
