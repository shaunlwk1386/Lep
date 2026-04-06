"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getLog, deleteLog, type DailyLog, type Service } from "@/lib/db";

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const th = date.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const en = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return { th, en };
}

export default function LogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [log, setLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getLog(id).then((data) => { setLog(data); setLoading(false); });
  }, [id]);

  async function handleDelete() {
    if (!confirm("ลบรายการนี้? / Delete this log?")) return;
    setDeleting(true);
    await deleteLog(id);
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto px-5 pt-8 min-h-screen">
        <Link href="/" className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
        <p className="text-sm text-gray-500 mt-8 text-center">กำลังโหลด... / Loading...</p>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="w-full max-w-md mx-auto px-5 pt-8 min-h-screen">
        <Link href="/" className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
        <p className="text-sm text-gray-500 mt-8 text-center">ไม่พบรายการ / Log not found</p>
      </div>
    );
  }

  const { th, en } = formatDate(log.date);
  const transferred = log.total_amount - log.cash_amount;

  return (
    <div className="w-full max-w-md mx-auto px-5 pt-8 pb-24 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
      </div>

      <h1 className="text-xl font-bold text-gray-800 mb-1">สรุปประจำวัน / Day Summary</h1>
      <p className="text-sm text-gray-500">{th}</p>
      <p className="text-xs text-gray-600 mb-6">{en}</p>

      <div className="space-y-4">

        {/* Images */}
        {(log.image_log_url || log.image_cash_url) && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-1">รูปภาพ / Photos</p>
            <p className="text-xs text-gray-600 mb-3">รูปสมุดบันทึกและเงินสด / Log and cash photos</p>
            <div className="flex gap-2">
              {log.image_log_url && (
                <div className="flex-1">
                  <a href={log.image_log_url} target="_blank" rel="noopener noreferrer">
                    <img src={log.image_log_url} alt="Log" className="w-full rounded-xl object-cover h-32" />
                  </a>
                  <a
                    href={log.image_log_url}
                    download
                    className="block text-center text-[10px] text-[#8B6BAD] mt-1 underline"
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
                    className="block text-center text-[10px] text-[#8B6BAD] mt-1 underline"
                  >
                    เงินสด / Download
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-1">บริการ / Services</p>
          <p className="text-xs text-gray-600 mb-3">รายการบริการวันนี้ / Today's services</p>
          <div className="space-y-2">
            {(log.services as Service[]).map((s, i) => (
              <div key={i} className="flex justify-between items-center">
                <p className="text-sm text-gray-600">{s.description}</p>
                <p className="text-sm font-medium text-gray-800">฿{s.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-600">รวมทั้งหมด</p>
              <p className="text-[10px] text-gray-500">Total earned</p>
            </div>
            <p className="text-lg font-bold text-gray-800">฿{log.total_amount.toLocaleString()}</p>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-600">รับเป็นเงินสด</p>
              <p className="text-[10px] text-gray-500">Cash received</p>
            </div>
            <p className="text-base font-medium text-gray-600">฿{log.cash_amount.toLocaleString()}</p>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-[#8B6BAD]">ยอดโอน</p>
              <p className="text-[10px] text-[#C5A8D9]">Transferred</p>
            </div>
            <p className="text-xl font-bold text-[#8B6BAD]">฿{transferred.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto flex gap-3">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 border border-red-200 text-red-400 font-semibold rounded-2xl py-4 shadow-sm transition-colors disabled:opacity-50"
        >
          ลบ / Delete
        </button>
        <Link
          href={`/log/${log.id}/edit`}
          className="flex-1 flex items-center justify-center bg-[#9575B5] hover:bg-[#8B6BAD] active:bg-[#7A5C9C] text-white font-semibold rounded-2xl py-4 shadow-lg transition-colors"
        >
          แก้ไข / Edit
        </Link>
      </div>
    </div>
  );
}
