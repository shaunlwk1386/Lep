"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getLog, updateLog, type Service } from "@/lib/db";
import { SERVICE_LIST } from "@/lib/services";

function ServiceRow({
  service,
  onChange,
  onRemove,
}: {
  service: Service;
  onChange: (id: string, field: string, value: string | number) => void;
  onRemove: (id: string) => void;
}) {
  const [search, setSearch] = useState(service.description);
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = search.length > 0
    ? SERVICE_LIST.filter(
        (s) =>
          s.th.toLowerCase().includes(search.toLowerCase()) ||
          s.en.toLowerCase().includes(search.toLowerCase())
      )
    : SERVICE_LIST;

  function selectService(th: string) {
    setSearch(th);
    onChange(service.id, "description", th);
    setShowDropdown(false);
  }

  return (
    <div className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); onChange(service.id, "description", e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="ค้นหาบริการ / Search service"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#9575B5] bg-white"
        />
        {showDropdown && filtered.length > 0 && (
          <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto mt-1">
            {filtered.map((s, i) => (
              <button
                key={i}
                onMouseDown={() => selectService(s.th)}
                className="w-full text-left px-3 py-2 hover:bg-[#F0E8F7] text-sm border-b border-gray-50 last:border-0"
              >
                <span className="block text-gray-700">{s.th}</span>
                <span className="block text-xs text-gray-400">{s.en}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          inputMode="numeric"
          value={service.amount || ""}
          placeholder="฿"
          onChange={(e) => onChange(service.id, "amount", Number(e.target.value))}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-right focus:outline-none focus:border-[#9575B5] bg-white"
        />
        <div className="flex rounded-xl overflow-hidden border border-gray-200 text-xs font-medium">
          <button
            onClick={() => onChange(service.id, "payment", "cash")}
            className={`px-3 py-2 ${service.payment === "cash" ? "bg-[#9575B5] text-white" : "bg-white text-gray-500"}`}
          >
            สด
          </button>
          <button
            onClick={() => onChange(service.id, "payment", "transfer")}
            className={`px-3 py-2 ${service.payment === "transfer" ? "bg-[#9575B5] text-white" : "bg-white text-gray-500"}`}
          >
            โอน
          </button>
        </div>
        <button onClick={() => onRemove(service.id)} className="text-gray-400 hover:text-red-400 text-lg leading-none">×</button>
      </div>
    </div>
  );
}

export default function EditLogPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [commissionRate, setCommissionRate] = useState(50);

  useEffect(() => {
    getLog(id).then((log) => {
      if (log) {
        setDate(log.date);
        setServices((log.services as Service[]).map((s) => ({
          ...s,
          payment: s.payment ?? "transfer",
        })));
        setCommissionRate(log.commission_rate ?? 50);
      }
      setLoading(false);
    });
  }, [id]);

  const totalAmount = services.reduce((sum, s) => sum + (s.amount || 0), 0);
  const cashAmount = services.filter((s) => s.payment === "cash").reduce((sum, s) => sum + s.amount, 0);
  const transferAmount = services.filter((s) => s.payment === "transfer").reduce((sum, s) => sum + s.amount, 0);
  const commission = Math.round(totalAmount * (commissionRate / 100));

  function updateService(sid: string, field: string, value: string | number) {
    setServices((prev) => prev.map((s) => (s.id === sid ? { ...s, [field]: value } : s)));
  }

  function addService() {
    setServices((prev) => [...prev, { id: Date.now().toString(), description: "", amount: 0, payment: "transfer" as const }]);
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
        cash_amount: cashAmount,
        commission_rate: commissionRate,
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
        <Link href={`/log/${id}`} className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
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
              <p className="text-xs text-gray-600">ชื่อบริการ · ราคา · สด/โอน</p>
            </div>
            <button onClick={addService} className="text-xs text-[#8B6BAD] font-medium border border-[#C5A8D9] rounded-full px-3 py-1">
              + เพิ่ม / Add
            </button>
          </div>
          <div className="space-y-2">
            {services.map((s) => (
              <ServiceRow key={s.id} service={s} onChange={updateService} onRemove={removeService} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-600">สด / Cash</p>
            <p className="text-sm font-medium text-gray-700">฿{cashAmount.toLocaleString()}</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-600">โอน / Transfer</p>
            <p className="text-sm font-medium text-gray-700">฿{transferAmount.toLocaleString()}</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-gray-800">รวม / Total</p>
            <p className="text-lg font-bold text-gray-800">฿{totalAmount.toLocaleString()}</p>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-600">คอมมิชชั่น / Commission</p>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                  className="w-12 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-[#9575B5]"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600">฿{commission.toLocaleString()}</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-[#8B6BAD]">ได้รับ / You earn</p>
            <p className="text-xl font-bold text-[#8B6BAD]">฿{commission.toLocaleString()}</p>
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
