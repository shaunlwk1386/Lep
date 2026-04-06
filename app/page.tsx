"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getLogs, type DailyLog } from "@/lib/db";

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

function getDateRanges() {
  const now = new Date();

  // Today
  const todayStr = now.toISOString().split("T")[0];

  // Week: Monday to today
  const day = now.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const weekStart = monday.toISOString().split("T")[0];

  // Month: 1st to today
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  return { todayStr, weekStart, monthStart };
}

const BASIC_SALARY = 350

function isOffDay(log: DailyLog): boolean {
  return (log.services as { description: string }[]).some(
    (s) => s.description.includes("วันหยุด")
  );
}

function sumLogs(logs: DailyLog[]) {
  return logs.reduce(
    (acc, log) => {
      const offDay = isOffDay(log)
      const dailyCommission = Math.round(log.total_amount * (log.commission_rate / 100))

      if (offDay || dailyCommission < BASIC_SALARY) {
        // Day pays basic salary — don't count revenue as cash/transfer
        return {
          ...acc,
          basicSalary: acc.basicSalary + BASIC_SALARY,
        }
      }

      // Commission day — count revenue and commission normally
      return {
        ...acc,
        total: acc.total + log.total_amount,
        cash: acc.cash + log.cash_amount,
        transferred: acc.transferred + (log.total_amount - log.cash_amount),
        commission: acc.commission + dailyCommission,
      }
    },
    { total: 0, cash: 0, transferred: 0, commission: 0, basicSalary: 0 }
  );
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLogs().then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  const { todayStr, weekStart, monthStart } = getDateRanges();

  const todayLogs = logs.filter((l) => l.date === todayStr);
  const weekLogs = logs.filter((l) => l.date >= weekStart && l.date <= todayStr);
  const monthLogs = logs.filter((l) => l.date >= monthStart && l.date <= todayStr);

  const statsMap = {
    today: sumLogs(todayLogs),
    week: sumLogs(weekLogs),
    month: sumLogs(monthLogs),
  };

  const current = statsMap[activeTab];
  const recentLogs = logs.slice(0, 5);

  const now = new Date();
  const todayTh = now.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const todayEn = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="w-full max-w-md mx-auto px-5 pb-24 pt-8 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold text-gray-900">เล็บ</h1>
          <span className="text-xs text-gray-600">Lep by egg v1.0</span>
        </div>
        <p className="text-sm text-gray-500">ซาลี่ · Saly</p>
        <p className="text-sm text-gray-500">{todayTh}</p>
        <p className="text-xs text-gray-600">{todayEn}</p>
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
                : "text-gray-600"
            }`}
          >
            <span className="block">{tab.labelTh}</span>
            <span className="block text-[10px] font-normal opacity-70">{tab.labelEn}</span>
          </button>
        ))}
      </div>

      {/* Stat Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-8">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">กำลังโหลด... / Loading...</p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-600">รวมทั้งหมด</p>
                <p className="text-[10px] text-gray-500">Total earned</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">฿{current.total.toLocaleString()}</p>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-600">รับเป็นเงินสด</p>
                <p className="text-[10px] text-gray-500">Cash received</p>
              </div>
              <p className="text-base font-medium text-gray-600">฿{current.cash.toLocaleString()}</p>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-600">ยอดโอน</p>
                <p className="text-[10px] text-gray-500">Transferred</p>
              </div>
              <p className="text-base font-medium text-gray-600">฿{current.transferred.toLocaleString()}</p>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-gray-600">เงินเดือนพื้นฐาน</p>
                <p className="text-[10px] text-gray-400">Basic salary days</p>
              </div>
              <p className="text-base font-medium text-gray-600">฿{current.basicSalary.toLocaleString()}</p>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold text-[#8B6BAD]">ได้รับรวม</p>
                <p className="text-[10px] text-[#C5A8D9]">Total pay</p>
              </div>
              <p className="text-2xl font-bold text-[#8B6BAD]">฿{(current.commission + current.basicSalary).toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Logs */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-700">รายการล่าสุด</p>
            <p className="text-xs text-gray-600">Recent logs</p>
          </div>
          <div className="flex gap-3">
            <Link href="/photos" className="text-xs text-[#8B6BAD] font-medium">
              รูปภาพ / Photos
            </Link>
            <Link href="/history" className="text-xs text-[#8B6BAD] font-medium">
              ดูทั้งหมด / View all
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          {loading && (
            <p className="text-sm text-gray-400 text-center py-4">กำลังโหลด... / Loading...</p>
          )}
          {!loading && recentLogs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีรายการ / No logs yet</p>
          )}
          {recentLogs.map((log) => (
            <Link
              key={log.id}
              href={`/log/${log.id}`}
              className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 active:bg-[#F0E8F7]"
            >
              <div>
                <p className="text-sm font-medium text-gray-700">{formatDate(log.date)}</p>
                <p className="text-xs text-gray-600">
                  สด (Cash) ฿{log.cash_amount.toLocaleString()} · โอน (Transfer) ฿{(log.total_amount - log.cash_amount).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-800">฿{log.total_amount.toLocaleString()}</p>
                <p className="text-[10px] text-gray-600">total</p>
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
