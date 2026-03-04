"use client";

export default function UpgradeBanner({
  totalConnections,
}: {
  totalConnections: number;
}) {
  return (
    <div className="bg-gradient-to-r from-primary to-gray-700 text-white rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">
            You have {(totalConnections - 100).toLocaleString()} more
            connections waiting
          </p>
          <p className="text-xs opacity-80 mt-0.5">
            Upgrade to analyze your full network
          </p>
        </div>
        <a
          href="/dashboard/settings"
          className="shrink-0 h-10 px-4 flex items-center rounded-xl bg-white text-primary text-sm font-medium hover:bg-white/90 transition-colors"
        >
          Upgrade
        </a>
      </div>
    </div>
  );
}
