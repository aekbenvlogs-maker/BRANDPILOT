"use client";

import useSWR from "swr";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { apiFetch } from "@/utils/api";
import { formatPercent } from "@/utils/formatters";

interface CampaignAnalytics {
  campaign_id: string;
  campaign_name: string;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
}

export function AnalyticsCharts() {
  const { data, isLoading } = useSWR<{ items: CampaignAnalytics[] }>(
    "/api/v1/analytics",
    (url: string) => apiFetch(url)
  );

  if (isLoading) {
    return <p className="text-sm text-neutral-400">Loading…</p>;
  }

  if (!data?.items?.length) {
    return <p className="text-sm text-neutral-400">No analytics data yet.</p>;
  }

  const chartData = data.items.map((item) => ({
    name: item.campaign_name,
    "Open rate": parseFloat((item.open_rate * 100).toFixed(1)),
    "Click rate": parseFloat((item.click_rate * 100).toFixed(1)),
    "Conversion": parseFloat((item.conversion_rate * 100).toFixed(2)),
  }));

  return (
    <div className="flex flex-col gap-6">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip formatter={(value: number) => `${value}%`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Open rate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Click rate" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Conversion" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500 dark:border-neutral-800">
              <th className="pb-2 pr-6">Campaign</th>
              <th className="pb-2 pr-6">Open rate</th>
              <th className="pb-2 pr-6">Click rate</th>
              <th className="pb-2">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr
                key={item.campaign_id}
                className="border-b border-neutral-50 dark:border-neutral-800"
              >
                <td className="py-2 pr-6 font-medium text-neutral-900 dark:text-white">
                  {item.campaign_name}
                </td>
                <td className="py-2 pr-6 text-blue-600">{formatPercent(item.open_rate)}</td>
                <td className="py-2 pr-6 text-emerald-600">{formatPercent(item.click_rate)}</td>
                <td className="py-2 text-amber-600">{formatPercent(item.conversion_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
