"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getLog, updateLog, type Service } from "@/lib/db";

export default function EditLogPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [cashAmount, setCashAmount] = useState<number | "">("");

  useEffect(() => {
    getLog(id).then((log) => {
      if (log) {
        setDate(log.date);
        setServices(log.services as Service[]);
        setCashAmount(log.cash_amount);
      }
      setLoading(false);
    });
  }, [id]);

  const totalAmount = services.reduce((sum, s) => sum + s.amount, 0);
  const transferred = totalAmount - (cashAmount === "" ? 0 : cashAmount);

  function updateService(sid: string, field: "description" | "amount", value: string | number) {
    setServices((prev) => prev.map((s) => (s.id === sid ? { ...s, [field]: value } : s)));
  }

  function addService() {
    setServices((prev) => [...prev, { id: Date.now().toString(), description: "", amount: 0 }]);
  }

  function removeService(sid: string) {
    setServices((prev) => prev.filter((s) => s.id !== sid));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateLog(id, {
        date,
        services,
        total_amount: totalAmount,
        cash_amount: cashAmount === "" ? 0 : cashAmount,
      });
      router.push(`/log/${id}`);
    } catch {
      alert("Error saving. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto px-5 pt-8 min-h-screen">
        <Link href="/history" className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
        <p className="text-sm text-gray-500 mt-8 text-center">กำลังโหลด... / Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-5 pt-8 pb-32 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/log/${id}`} className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
      </div>
      <h1 className="text-xl font-bold text-gray-800 mb-1">แก้ไขบันทึก / Edit Log</h1>
      <p className="text-xs text-gray-600 mb-6">แก้ไขข้อมูลประจำวัน / Edit this day's record</p>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-600 mb-1">วันที่ / Date</p>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#9575B5]"
          />
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">บริการ / Services</p>
              <p className="text-xs text-gray-600">แก้ไขหรือลบรายการ / Edit or remove entries</p>
            </div>
            <button onClick={addService} className="text-xs text-[#8B6BAD] font-medium border border-[#C5A8D9] rounded-full px-3 py-1">
              + เพิ่ม / Add
            </button>
          </div>
          <div className="space-y-2">
            {services.map((s) => (
              <div key={s.id} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={s.description}
                  onChange={(e) => updateService(s.id, "description", e.target.value)}
                  placeholder="ชื่อบริการ / Service name"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#9575B5]"
                />
                <input
                  type="number"
                  value={s.amount}
                  onChange={(e) => updateService(s.id, "amount", Number(e.target.value))}
                  className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-right focus:outline-none focus:border-[#9575B5]"
                />
                <button onClick={() => removeService(s.id)} className="text-gray-500 hover:text-red-400 text-lg leading-none">×</button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          <div>
            <p className="text-xs text-gray-600 mb-1">รับเป็นเงินสด / Cash received (฿)</p>
            <input
              type="number"
              value={cashAmount}
              placeholder="0"
              onChange={(e) => setCashAmount(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-base text-gray-600 focus:outline-none focus:border-[#9575B5]"
            />
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-600">รวมทั้งหมด / Total</p>
            <p className="text-base font-bold text-gray-800">฿{totalAmount.toLocaleString()}</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-[#8B6BAD]">ยอดโอน / Transferred</p>
            <p className="text-xl font-bold text-[#8B6BAD]">฿{transferred.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#9575B5] hover:bg-[#8B6BAD] active:bg-[#7A5C9C] text-white font-semibold rounded-2xl py-4 shadow-lg transition-colors disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก... / Saving..." : "บันทึกการแก้ไข / Save Changes"}
        </button>
      </div>
    </div>
  );
}
