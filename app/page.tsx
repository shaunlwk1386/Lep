"use client";

import Link from "next/link";
import { useState } from "react";

// Mock data — will be replaced with real Supabase data later
const stats = {
  today: { total: 1200, cash: 500, transferred: 700 },
  week: { total: 4200, cash: 1800, transferred: 2400 },
  month: { total: 18500, cash: 7200, transferred: 11300 },
};

const recentLogs = [
  { id: "1", date: "2026-04-05", total: 1200, cash: 500, transferred: 700 },
  { id: "2", date: "2026-04-04", total: 900, cash: 400, transferred: 500 },
  { id: "3", date: "2026-04-03", total: 1500, cash: 600, transferred: 900 },
  { id: "4", date: "2026-04-02", total: 600, cash: 300, transferred: 300 },
];

const tabs = [
  { key: "today", labelTh: "วันนี้", labelEn: "Today" },
  { key: "week", labelTh: "สัปดาห์นี้", labelEn: "This Week" },
  { key: "month", labelTh: "เดือนนี้", labelEn: "This Month" },
] as const;

type TabKey = "today" | "week" | "month";

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("today");

  const current = stats[activeTab];

  const now = new Date();
  const todayTh = now.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const todayEn = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-6 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold text-gray-900">เล็บ</h1>
          <span className="text-xs text-gray-400">Lep by egg v1.0</span>
        </div>
        <p className="text-sm text-gray-500">ซาลี่ · Saly</p>
        <p className="text-sm text-gray-500">{todayTh}</p>
        <p className="text-xs text-gray-400">{todayEn}</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
              activeTab === tab.key
                ? "bg-white text-[#8B6BAD] shadow-sm"
                : "text-gray-400"
            }`}
          >
            <span className="block">{tab.labelTh}</span>
            <span className="block text-[10px] font-normal opacity-70">{tab.labelEn}</span>
          </button>
        ))}
      </div>

      {/* Stat Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-8">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-400">รวมทั้งหมด</p>
              <p className="text-[10px] text-gray-300">Total earned</p>
            </div>
            <p className="text-2xl font-bold text-gray-800">฿{current.total.toLocaleString()}</p>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-400">รับเป็นเงินสด</p>
              <p className="text-[10px] text-gray-300">Cash received</p>
            </div>
            <p className="text-base font-medium text-gray-600">฿{current.cash.toLocaleString()}</p>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-medium text-[#8B6BAD]">ยอดโอน</p>
              <p className="text-[10px] text-[#C5A8D9]">Transferred</p>
            </div>
            <p className="text-xl font-bold text-[#8B6BAD]">฿{current.transferred.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Recent Logs */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-700">รายการล่าสุด</p>
            <p className="text-xs text-gray-400">Recent logs</p>
          </div>
          <Link href="/history" className="text-xs text-[#8B6BAD] font-medium">
            ดูทั้งหมด / View all
          </Link>
        </div>

        <div className="space-y-2">
          {recentLogs.map((log) => (
            <Link
              key={log.id}
              href={`/log/${log.id}`}
              className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 active:bg-[#F0E8F7]"
            >
              <div>
                <p className="text-sm font-medium text-gray-700">{formatDate(log.date)}</p>
                <p className="text-xs text-gray-400">
                  สด (Cash) ฿{log.cash.toLocaleString()} · โอน (Transfer) ฿{log.transferred.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-800">฿{log.total.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">total</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* New Log Button */}
      <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto">
        <Link
          href="/new"
          className="flex items-center justify-center w-full bg-[#9575B5] hover:bg-[#8B6BAD] active:bg-[#7A5C9C] text-white font-semibold rounded-2xl py-4 shadow-lg transition-colors"
        >
          <span className="text-lg mr-2">+</span>
          <span>บันทึกวันนี้</span>
          <span className="ml-2 text-[#D4B8E8] text-sm font-normal">New Log</span>
        </Link>
      </div>
    </div>
  );
}
