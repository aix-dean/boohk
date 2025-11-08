import { WeatherForecast } from "@/components/weather-forecast"

export default function NewsAndAlertsPage() {
  return (
    <div className="flex-1 overflow-auto">
      <header className="flex justify-between items-center p-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold">News & Alerts</h1>
          <p className="text-sm text-gray-500">Important updates and notifications</p>
        </div>
      </header>

      <main className="p-4 space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-3"></h2>
          <p className="text-sm text-gray-500 mb-3"></p>
          <WeatherForecast defaultRegion="NCR" />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">System Notifications</h2>
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <p className="text-gray-500">No new system notifications</p>
          </div>
        </section>
      </main>
    </div>
  )
}
