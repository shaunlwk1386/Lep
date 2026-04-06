"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { getLogs, deleteLog as deleteLogDb, type DailyLog, type Service } from "@/lib/db";

type GroupedWeek = {
  label: string;
  weekStart: string;
  total: number;
  cash: number;
  transferred: number;
  logs: DailyLog[];
};

type GroupedMonth = {
  label: string;
  weeks: GroupedWeek[];
};

function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().split("T")[0];
}

function getWeekLabel(weekStart: string): string {
  const start = new Date(weekStart);
  const thLabel = `สัปดาห์ ${start.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`;
  const enLabel = `Week of ${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  return `${thLabel} / ${enLabel}`;
}

function getMonthLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const th = date.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  const en = date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `${th} / ${en}`;
}

function groupLogs(logs: DailyLog[]): GroupedMonth[] {
  const monthMap = new Map<string, Map<string, DailyLog[]>>();

  for (const log of logs) {
    const monthKey = log.date.slice(0, 7);
    const weekKey = getWeekStart(log.date);
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map());
    const weekMap = monthMap.get(monthKey)!;
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, []);
    weekMap.get(weekKey)!.push(log);
  }

  const result: GroupedMonth[] = [];
  for (const [monthKey, weekMap] of monthMap) {
    const weeks: GroupedWeek[] = [];
    for (const [weekStart, weekLogs] of weekMap) {
      const total = weekLogs.reduce((s, l) => s + l.total_amount, 0);
      const cash = weekLogs.reduce((s, l) => s + l.cash_amount, 0);
      weeks.push({ label: getWeekLabel(weekStart), weekStart, total, cash, transferred: total - cash, logs: weekLogs });
    }
    weeks.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
    result.push({ label: getMonthLabel(monthKey + "-01"), weeks });
  }

  return result;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const th = date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
  const en = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${th} / ${en}`;
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [deletedLog, setDeletedLog] = useState<DailyLog | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getLogs().then((data) => { setLogs(data); setLoading(false); });
  }, []);

  const grouped = groupLogs(logs);

  function toggleWeek(key: string) {
    setExpandedWeeks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleLog(id: string) {
    setExpandedLogs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleDeleteLog(logId: string) {
    const target = logs.find((l) => l.id === logId);
    if (!target) return;
    setLogs((prev) => prev.filter((l) => l.id !== logId));
    setDeletedLog(target);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(async () => {
      await deleteLogDb(logId);
      setDeletedLog(null);
    }, 5000);
  }

  async function undoDelete() {
    if (!deletedLog) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setLogs((prev) => [deletedLog, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
    setDeletedLog(null);
  }

  return (
    <div className="w-full max-w-md mx-auto px-5 pt-8 pb-24 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
      </div>
      <h1 className="text-xl font-bold text-gray-800 mb-1">ประวัติทั้งหมด / All Logs</h1>
      <p className="text-xs text-gray-600 mb-6">รายการบันทึกทั้งหมด / Complete log history</p>

      {loading && <p className="text-sm text-gray-500 text-center py-8">กำลังโหลด... / Loading...</p>}

      {!loading && grouped.length === 0 && (
        <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm">ยังไม่มีรายการ / No logs yet</p>
        </div>
      )}

      {grouped.map((month) => (
        <div key={month.label} className="mb-6">
          <p className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide">{month.label}</p>
          <div className="space-y-3">
            {month.weeks.map((week) => {
              const isWeekOpen = expandedWeeks[week.weekStart];
              return (
                <div key={week.weekStart} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button onClick={() => toggleWeek(week.weekStart)} className="w-full px-4 py-3 flex justify-between items-center">
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-700">{week.label}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        รวม / Total ฿{week.total.toLocaleString()} · โอน / Transfer ฿{week.transferred.toLocaleString()}
                      </p>
                    </div>
                    <span className="text-gray-500 text-sm">{isWeekOpen ? "▲" : "▼"}</span>
                  </button>

                  {isWeekOpen && (
                    <div>
                      <div className="flex justify-between px-4 py-2 bg-[#FAF6FF] border-t border-gray-100">
                        <div className="text-center flex-1">
                          <p className="text-[10px] text-gray-600">รวม / Total</p>
                          <p className="text-sm font-bold text-gray-700">฿{week.total.toLocaleString()}</p>
                        </div>
                        <div className="text-center flex-1">
                          <p className="text-[10px] text-gray-600">สด / Cash</p>
                          <p className="text-sm font-medium text-gray-600">฿{week.cash.toLocaleString()}</p>
                        </div>
                        <div className="text-center flex-1">
                          <p className="text-[10px] text-[#8B6BAD]">โอน / Transfer</p>
                          <p className="text-sm font-bold text-[#8B6BAD]">฿{week.transferred.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="divide-y divide-gray-50">
                        {week.logs.map((log) => {
                          const isLogOpen = expandedLogs[log.id];
                          const transferred = log.total_amount - log.cash_amount;
                          return (
                            <div key={log.id}>
                              <button onClick={() => toggleLog(log.id)} className="w-full flex justify-between items-center px-4 py-3">
                                <div className="text-left">
                                  <p className="text-sm font-medium text-gray-700">{formatDate(log.date)}</p>
                                  <p className="text-xs text-gray-600">
                                    สด (Cash) ฿{log.cash_amount.toLocaleString()} · โอน (Transfer) ฿{transferred.toLocaleString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <p className="text-sm font-bold text-gray-800">฿{log.total_amount.toLocaleString()}</p>
                                  <span className="text-gray-500 text-xs">{isLogOpen ? "▲" : "▼"}</span>
                                </div>
                              </button>

                              {isLogOpen && (
                                <div className="px-4 pb-4 bg-gray-50">
                                  <div className="space-y-2 mb-3">
                                    {(log.services as Service[]).map((s, i) => (
                                      <div key={i} className="flex justify-between items-center text-xs text-gray-600">
                                        <span className="flex-1">{s.description}</span>
                                        <span className="font-medium">฿{s.amount.toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex gap-2">
                                    <Link
                                      href={`/log/${log.id}/edit`}
                                      className="flex-1 text-center text-xs font-medium text-white bg-[#9575B5] rounded-xl py-2"
                                    >
                                      แก้ไข / Edit
                                    </Link>
                                    <button
                                      onClick={() => handleDeleteLog(log.id)}
                                      className="flex-1 text-center text-xs font-medium text-red-400 border border-red-200 rounded-xl py-2"
                                    >
                                      ลบ / Delete
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {deletedLog && (
        <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto">
          <div className="flex items-center justify-between bg-gray-800 text-white rounded-2xl px-4 py-3 shadow-lg">
            <p className="text-sm">ลบแล้ว / Log deleted</p>
            <button onClick={undoDelete} className="text-[#C5A8D9] font-semibold text-sm ml-4">
              เลิกทำ / Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
