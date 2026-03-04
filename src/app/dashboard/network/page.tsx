import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NetworkClient from "@/components/dashboard/NetworkClient";

export default async function NetworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <NetworkClient userId={user.id} />;
}
