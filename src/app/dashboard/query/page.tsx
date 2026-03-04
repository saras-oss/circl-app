import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import QueryClient from "@/components/dashboard/QueryClient";

export default async function QueryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <QueryClient userId={user.id} />;
}
