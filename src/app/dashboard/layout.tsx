import Sidebar from "@/components/dashboard/Sidebar";
import PageViewTracker from "@/components/dashboard/PageViewTracker";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      <Sidebar />
      <PageViewTracker />
      <main className="md:ml-[240px] pb-24 md:pb-8">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}
