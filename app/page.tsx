import { WelcomePage } from "@/components/welcome-page"
import { MainDashboard } from "@/components/main-dashboard"
// Assistant is now hosted globally by `VendaiPanel` (components/vendai-panel.tsx)
import { NotificationDots } from "@/components/notification-dots"
import { Sidebar } from "@/components/sidebar"

export default function HomePage() {
  // TODO: Add logic to check if this is first time launch
  const isFirstTimeLaunch = true;

  if (isFirstTimeLaunch) {
    return <WelcomePage />;
  }

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar with Notification Dots */}
        <div className="h-12 glass border-b border-slate-700/50 flex items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-slate-400 font-mono text-sm ml-4">vendai dashboard.</span>
          </div>
          <NotificationDots />
        </div>
        <div className="flex-1 overflow-auto p-6">
          {/* Main Dashboard Content */}
          <MainDashboard />
        </div>
      </div>
    </div>
  );
}
