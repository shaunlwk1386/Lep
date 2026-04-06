"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLogs, type DailyLog } from "@/lib/db";

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const th = date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const en = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return { th, en };
}

export default function PhotosPage() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLogs().then((data) => {
      setLogs(data.filter((l) => l.image_log_url || l.image_cash_url));
      setLoading(false);
    });
  }, []);

  return (
    <div className="w-full max-w-md mx-auto px-5 pt-8 pb-24 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
      </div>
      <h1 className="text-xl font-bold text-gray-800 mb-1">รูปภาพ / Photos</h1>
      <p className="text-xs text-gray-600 mb-6">รูปทั้งหมดตามวันที่ / All photos by date</p>

      {loading && (
        <p className="text-sm text-gray-400 text-center py-8">กำลังโหลด... / Loading...</p>
      )}

      {!loading && logs.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีรูปภาพ / No photos yet</p>
      )}

      <div className="space-y-4">
        {logs.map((log) => {
          const { th, en } = formatDate(log.date);
          return (
            <div key={log.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <Link href={`/log/${log.id}`}>
                <p className="text-sm font-semibold text-gray-700">{th}</p>
                <p className="text-xs text-gray-500 mb-3">{en}</p>
              </Link>
              <div className="flex gap-2">
                {log.image_log_url && (
                  <div className="flex-1">
                    <a href={log.image_log_url} target="_blank" rel="noopener noreferrer">
                      <img src={log.image_log_url} alt="Log" className="w-full rounded-xl object-cover h-32" />
                    </a>
                    <a
                      href={log.image_log_url}
                      download
                      className="block text-center text-[10px] text-[#8B6BAD] mt-1"
                    >
                      สมุดบันทึก / Download
                    </a>
                  </div>
                )}
                {log.image_cash_url && (
                  <div className="flex-1">
                    <a href={log.image_cash_url} target="_blank" rel="noopener noreferrer">
                      <img src={log.image_cash_url} alt="Cash" className="w-full rounded-xl object-cover h-32" />
                    </a>
                    <a
                      href={log.image_cash_url}
                      download
                      className="block text-center text-[10px] text-[#8B6BAD] mt-1"
                    >
                      เงินสด / Download
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
