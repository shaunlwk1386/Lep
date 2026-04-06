"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { saveLog } from "@/lib/db";
import { compressImage } from "@/lib/ocr";
import { supabase } from "@/lib/supabase";
import { SERVICE_LIST } from "@/lib/services";

type Service = {
  id: number;
  description: string;
  amount: number;
  payment: "cash" | "transfer";
};

function ServiceRow({
  service,
  onChange,
  onRemove,
}: {
  service: Service;
  onChange: (id: number, field: string, value: string | number) => void;
  onRemove: (id: number) => void;
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
      {/* Service name search */}
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

      {/* Price + Payment + Remove */}
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

export default function ReviewPage() {
  const router = useRouter();

  const [rawText, setRawText] = useState("");
  const [extractedNumbers, setExtractedNumbers] = useState<number[]>([]);
  const [showRawText, setShowRawText] = useState(false);
  const [services, setServices] = useState<Service[]>([
    { id: 1, description: "", amount: 0, payment: "transfer" },
  ]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [commissionRate, setCommissionRate] = useState(50);
  const [saving, setSaving] = useState(false);
  const [logImageUrl, setLogImageUrl] = useState<string | null>(null);
  const [cashImageUrl, setCashImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const ocrRaw = sessionStorage.getItem("ocr_result");
    const logUrl = sessionStorage.getItem("log_image_url");
    const cashUrl = sessionStorage.getItem("cash_image_url");
    const offDay = sessionStorage.getItem("off_day");

    if (offDay === "true") {
      // Off-day: pre-fill with fixed 350b entry, 100% commission rate
      setServices([{ id: Date.now(), description: "วันหยุด / Off Day", amount: 350, payment: "transfer" }]);
      setCommissionRate(100);
    } else if (ocrRaw) {
      const ocr = JSON.parse(ocrRaw);
      setRawText(ocr.rawText ?? "");
      setExtractedNumbers(ocr.numbers ?? []);

      if (ocr.detectedServices && ocr.detectedServices.length > 0) {
        setServices(
          ocr.detectedServices.map((s: { description: string; amount: number; payment: 'cash' | 'transfer' }, i: number) => ({
            id: Date.now() + i,
            description: s.description,
            amount: s.amount,
            payment: s.payment,
          }))
        );
      }
    }
    if (logUrl) setLogImageUrl(logUrl);
    if (cashUrl) setCashImageUrl(cashUrl);
  }, []);

  const totalAmount = services.reduce((sum, s) => sum + (s.amount || 0), 0);
  const cashAmount = services.filter((s) => s.payment === "cash").reduce((sum, s) => sum + s.amount, 0);
  const transferAmount = services.filter((s) => s.payment === "transfer").reduce((sum, s) => sum + s.amount, 0);
  const commission = Math.round(totalAmount * (commissionRate / 100));

  function updateService(id: number, field: string, value: string | number) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function addService() {
    setServices((prev) => [...prev, { id: Date.now(), description: "", amount: 0, payment: "transfer" }]);
  }

  function removeService(id: number) {
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  async function uploadImage(objectUrl: string, bucket: string, filename: string): Promise<string | null> {
    try {
      const res = await fetch(objectUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type });
      const compressed = await compressImage(file, 400);
      const ext = blob.type.includes("png") ? "png" : "jpg";
      const path = `${Date.now()}_${filename}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, compressed, { contentType: "image/jpeg" });
      if (error) return null;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const [logUrl, cashUrl] = await Promise.all([
        logImageUrl ? uploadImage(logImageUrl, "logs", "log") : Promise.resolve(null),
        cashImageUrl ? uploadImage(cashImageUrl, "cash", "cash") : Promise.resolve(null),
      ]);

      await saveLog({
        date,
        raw_text: rawText,
        extracted_numbers: extractedNumbers,
        services: services.map((s) => ({
          id: String(s.id),
          description: s.description,
          amount: s.amount,
          payment: s.payment,
        })),
        total_amount: totalAmount,
        cash_amount: cashAmount,
        commission_rate: commissionRate,
        image_log_url: logUrl ?? undefined,
        image_cash_url: cashUrl ?? undefined,
      });

      sessionStorage.clear(); // clears off_day, ocr_result, image urls, etc.
      router.push("/");
    } catch (e) {
      alert("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto px-5 pt-8 pb-32 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/new" className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
      </div>
      <h1 className="text-xl font-bold text-gray-800 mb-1">ตรวจสอบข้อมูล / Review</h1>
      <p className="text-xs text-gray-600 mb-6">แก้ไขข้อมูลก่อนบันทึก / Edit before saving</p>

      {/* Raw OCR Text */}
      {rawText ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
          <button onClick={() => setShowRawText(!showRawText)} className="w-full flex justify-between items-center px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-700 text-left">ข้อความ OCR / Raw OCR Text</p>
              <p className="text-xs text-gray-600 text-left">แตะเพื่อดู / Tap to view</p>
            </div>
            <span className="text-gray-600 text-sm">{showRawText ? "▲" : "▼"}</span>
          </button>
          {showRawText && (
            <div className="px-4 pb-4">
              <pre className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap font-sans">{rawText}</pre>
            </div>
          )}
        </div>
      ) : null}

      {/* Extracted Numbers */}
      {extractedNumbers.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-600 mb-2">ตัวเลขที่พบ / Detected numbers</p>
          <div className="flex flex-wrap gap-2">
            {extractedNumbers.slice(0, 10).map((num, i) => (
              <span key={i} className="text-sm font-medium px-3 py-1 rounded-full bg-[#F0E8F7] text-[#8B6BAD]">
                ฿{num.toLocaleString()}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Date */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-600 mb-1">วันที่ / Date</p>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#9575B5]"
          />
        </div>

        {/* Services */}
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
            {services.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                onChange={updateService}
                onRemove={removeService}
              />
            ))}
          </div>
        </div>

        {/* Summary */}
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
            <div>
              <p className="text-sm font-medium text-[#8B6BAD]">ได้รับ / You earn</p>
            </div>
            <p className="text-xl font-bold text-[#8B6BAD]">฿{commission.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#9575B5] hover:bg-[#8B6BAD] active:bg-[#7A5C9C] text-white font-semibold rounded-2xl py-4 shadow-lg transition-colors disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก... / Saving..." : "บันทึก / Save"}
        </button>
      </div>
    </div>
  );
}
