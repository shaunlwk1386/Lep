"use client";

import Link from "next/link";
import { useState, useRef } from "react";

type Service = { id: string; description: string; amount: number };

type LogEntry = {
  id: string;
  date: string;
  total: number;
  cash: number;
  transferred: number;
  services: Service[];
};

type Week = {
  label: string;
  total: number;
  cash: number;
  transferred: number;
  logs: LogEntry[];
};

type Month = {
  label: string;
  weeks: Week[];
};

const mockData: Month[] = [
  {
    label: "เมษายน 2569 / April 2026",
    weeks: [
      {
        label: "สัปดาห์ที่ 1 / Week 1 · Apr 1–6",
        total: 4200,
        cash: 1700,
        transferred: 2500,
        logs: [
          {
            id: "1",
            date: "2026-04-06",
            total: 1600,
            cash: 400,
            transferred: 1200,
            services: [
              { id: "s1", description: "Gel Manicure / ทำเล็บมือ เจล", amount: 600 },
              { id: "s2", description: "Acrylic Extension / ต่อเล็บ", amount: 700 },
              { id: "s3", description: "Pedicure / ทำเล็บเท้า", amount: 300 },
            ],
          },
          {
            id: "2",
            date: "2026-04-05",
            total: 1200,
            cash: 500,
            transferred: 700,
            services: [
              { id: "s4", description: "Gel Manicure / ทำเล็บมือ เจล", amount: 800 },
              { id: "s5", description: "Nail Art / ลายเล็บ", amount: 400 },
            ],
          },
          {
            id: "3",
            date: "2026-04-04",
            total: 900,
            cash: 400,
            transferred: 500,
            services: [
              { id: "s6", description: "Basic Manicure / ทำเล็บมือธรรมดา", amount: 400 },
              { id: "s7", description: "Pedicure / ทำเล็บเท้า", amount: 500 },
            ],
          },
          {
            id: "4",
            date: "2026-04-02",
            total: 500,
            cash: 400,
            transferred: 100,
            services: [
              { id: "s8", description: "Basic Manicure / ทำเล็บมือธรรมดา", amount: 500 },
            ],
          },
        ],
      },
    ],
  },
  {
    label: "มีนาคม 2569 / March 2026",
    weeks: [
      {
        label: "สัปดาห์ที่ 4 / Week 4 · Mar 24–30",
        total: 3800,
        cash: 1200,
        transferred: 2600,
        logs: [
          {
            id: "5",
            date: "2026-03-28",
            total: 2000,
            cash: 700,
            transferred: 1300,
            services: [
              { id: "s9", description: "Acrylic Extension / ต่อเล็บ", amount: 1200 },
              { id: "s10", description: "Gel Manicure / ทำเล็บมือ เจล", amount: 800 },
            ],
          },
          {
            id: "6",
            date: "2026-03-26",
            total: 1800,
            cash: 500,
            transferred: 1300,
            services: [
              { id: "s11", description: "Pedicure / ทำเล็บเท้า", amount: 600 },
              { id: "s12", description: "Gel Manicure / ทำเล็บมือ เจล", amount: 800 },
              { id: "s13", description: "Nail Art / ลายเล็บ", amount: 400 },
            ],
          },
        ],
      },
      {
        label: "สัปดาห์ที่ 3 / Week 3 · Mar 17–23",
        total: 2100,
        cash: 900,
        transferred: 1200,
        logs: [
          {
            id: "7",
            date: "2026-03-20",
            total: 1100,
            cash: 400,
            transferred: 700,
            services: [
              { id: "s14", description: "Gel Manicure / ทำเล็บมือ เจล", amount: 600 },
              { id: "s15", description: "Nail Art / ลายเล็บ", amount: 500 },
            ],
          },
          {
            id: "8",
            date: "2026-03-18",
            total: 1000,
            cash: 500,
            transferred: 500,
            services: [
              { id: "s16", description: "Basic Manicure / ทำเล็บมือธรรมดา", amount: 400 },
              { id: "s17", description: "Pedicure / ทำเล็บเท้า", amount: 600 },
            ],
          },
        ],
      },
    ],
  },
];

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const th = date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
  const en = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${th} / ${en}`;
}

type UndoItem =
  | { type: "service"; service: Service; logId: string; weekLabel: string; monthLabel: string }

export default function HistoryPage() {
  const [data, setData] = useState(mockData);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [undoItem, setUndoItem] = useState<UndoItem | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleWeek(key: string) {
    setExpandedWeeks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleLog(id: string) {
    setExpandedLogs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function deleteService(monthLabel: string, weekLabel: string, logId: string, serviceId: string) {
    let removed: Service | null = null;

    setData((prev) =>
      prev.map((month) => {
        if (month.label !== monthLabel) return month;
        return {
          ...month,
          weeks: month.weeks.map((week) => {
            if (week.label !== weekLabel) return week;
            return {
              ...week,
              logs: week.logs.map((log) => {
                if (log.id !== logId) return log;
                const target = log.services.find((s) => s.id === serviceId);
                if (target) removed = target;
                const newServices = log.services.filter((s) => s.id !== serviceId);
                const newTotal = newServices.reduce((sum, s) => sum + s.amount, 0);
                return {
                  ...log,
                  services: newServices,
                  total: newTotal,
                  transferred: newTotal - log.cash,
                };
              }),
            };
          }),
        };
      })
    );

    if (removed) {
      setUndoItem({ type: "service", service: removed, logId, weekLabel, monthLabel });
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndoItem(null), 5000);
    }
  }

  function undoDelete() {
    if (!undoItem) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);

    if (undoItem.type === "service") {
      const { service, logId, weekLabel, monthLabel } = undoItem;
      setData((prev) =>
        prev.map((month) => {
          if (month.label !== monthLabel) return month;
          return {
            ...month,
            weeks: month.weeks.map((week) => {
              if (week.label !== weekLabel) return week;
              return {
                ...week,
                logs: week.logs.map((log) => {
                  if (log.id !== logId) return log;
                  const newServices = [...log.services, service];
                  const newTotal = newServices.reduce((sum, s) => sum + s.amount, 0);
                  return {
                    ...log,
                    services: newServices,
                    total: newTotal,
                    transferred: newTotal - log.cash,
                  };
                }),
              };
            }),
          };
        })
      );
    }

    setUndoItem(null);
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-24 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
      </div>
      <h1 className="text-xl font-bold text-gray-800 mb-1">ประวัติทั้งหมด / All Logs</h1>
      <p className="text-xs text-gray-400 mb-6">รายการบันทึกทั้งหมด / Complete log history</p>

      {data.map((month) => (
        <div key={month.label} className="mb-6">
          <p className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide">{month.label}</p>

          <div className="space-y-3">
            {month.weeks.map((week) => {
              const weekKey = `${month.label}-${week.label}`;
              const isWeekOpen = expandedWeeks[weekKey];

              return (
                <div key={weekKey} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Week Row */}
                  <button
                    onClick={() => toggleWeek(weekKey)}
                    className="w-full px-4 py-3 flex justify-between items-center"
                  >
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-700">{week.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        รวม / Total ฿{week.total.toLocaleString()} · โอน / Transfer ฿{week.transferred.toLocaleString()}
                      </p>
                    </div>
                    <span className="text-gray-300 text-sm">{isWeekOpen ? "▲" : "▼"}</span>
                  </button>

                  {isWeekOpen && (
                    <div>
                      {/* Week Summary Bar */}
                      <div className="flex justify-between px-4 py-2 bg-[#FAF6FF] border-t border-gray-100">
                        <div className="text-center flex-1">
                          <p className="text-[10px] text-gray-400">รวม / Total</p>
                          <p className="text-sm font-bold text-gray-700">฿{week.total.toLocaleString()}</p>
                        </div>
                        <div className="text-center flex-1">
                          <p className="text-[10px] text-gray-400">สด / Cash</p>
                          <p className="text-sm font-medium text-gray-600">฿{week.cash.toLocaleString()}</p>
                        </div>
                        <div className="text-center flex-1">
                          <p className="text-[10px] text-[#8B6BAD]">โอน / Transfer</p>
                          <p className="text-sm font-bold text-[#8B6BAD]">฿{week.transferred.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Individual Logs */}
                      <div className="divide-y divide-gray-50">
                        {week.logs.length === 0 && (
                          <p className="text-xs text-gray-300 text-center py-4">ไม่มีรายการ / No entries</p>
                        )}
                        {week.logs.map((log) => {
                          const isLogOpen = expandedLogs[log.id];
                          return (
                            <div key={log.id}>
                              <button
                                onClick={() => toggleLog(log.id)}
                                className="w-full flex justify-between items-center px-4 py-3"
                              >
                                <div className="text-left">
                                  <p className="text-sm font-medium text-gray-700">{formatDate(log.date)}</p>
                                  <p className="text-xs text-gray-400">
                                    สด (Cash) ฿{log.cash.toLocaleString()} · โอน (Transfer) ฿{log.transferred.toLocaleString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <p className="text-sm font-bold text-gray-800">฿{log.total.toLocaleString()}</p>
                                  <span className="text-gray-300 text-xs">{isLogOpen ? "▲" : "▼"}</span>
                                </div>
                              </button>

                              {/* Log Detail */}
                              {isLogOpen && (
                                <div className="px-4 pb-4 bg-gray-50">
                                  {/* Service Rows */}
                                  <div className="space-y-2 mb-3">
                                    {log.services.map((s) => (
                                      <div key={s.id} className="flex justify-between items-center text-xs text-gray-600">
                                        <span className="flex-1">{s.description}</span>
                                        <span className="font-medium mr-3">฿{s.amount.toLocaleString()}</span>
                                        <button
                                          onClick={() => deleteService(month.label, week.label, log.id, s.id)}
                                          className="text-red-300 hover:text-red-400 text-base leading-none"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Edit Day Button */}
                                  <Link
                                    href={`/log/${log.id}/edit`}
                                    className="block w-full text-center text-xs font-medium text-white bg-[#9575B5] rounded-xl py-2"
                                  >
                                    แก้ไขวันนี้ / Edit this day
                                  </Link>
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

      {/* Undo Toast */}
      {undoItem && (
        <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto">
          <div className="flex items-center justify-between bg-gray-800 text-white rounded-2xl px-4 py-3 shadow-lg">
            <p className="text-sm">ลบรายการแล้ว / Entry deleted</p>
            <button onClick={undoDelete} className="text-[#C5A8D9] font-semibold text-sm ml-4">
              เลิกทำ / Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
