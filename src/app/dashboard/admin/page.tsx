import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import AdminDashboard from "./AdminDashboard";

const ADMIN_EMAILS = ["saras@incommon.ai", "piyush@incommon.ai"];

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", user.id)
    .single();

  if (!userData || !ADMIN_EMAILS.includes(userData.email)) {
    redirect("/dashboard");
  }

  return <AdminDashboard />;
}
