"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { saveLog } from "@/lib/db";
import { compressImage } from "@/lib/ocr";
import { supabase } from "@/lib/supabase";

type Service = { id: number; description: string; amount: number };

export default function ReviewPage() {
  const router = useRouter();

  const [rawText, setRawText] = useState("");
  const [extractedNumbers, setExtractedNumbers] = useState<number[]>([]);
  const [showRawText, setShowRawText] = useState(false);
  const [services, setServices] = useState<Service[]>([{ id: 1, description: "", amount: 0 }]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [cashAmount, setCashAmount] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [logImageUrl, setLogImageUrl] = useState<string | null>(null);
  const [cashImageUrl, setCashImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const ocrRaw = sessionStorage.getItem("ocr_result");
    const cashAmt = sessionStorage.getItem("cash_amount");
    const logUrl = sessionStorage.getItem("log_image_url");
    const cashUrl = sessionStorage.getItem("cash_image_url");

    if (ocrRaw) {
      const ocr = JSON.parse(ocrRaw);
      setRawText(ocr.rawText ?? "");
      setExtractedNumbers(ocr.numbers ?? []);
      if (ocr.numbers?.length > 0) setTotalAmount(ocr.numbers[0]);
    }
    if (cashAmt) setCashAmount(Number(cashAmt));
    if (logUrl) setLogImageUrl(logUrl);
    if (cashUrl) setCashImageUrl(cashUrl);
  }, []);

  const transferred = totalAmount - (cashAmount === "" ? 0 : cashAmount);

  function updateService(id: number, field: "description" | "amount", value: string | number) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function addService() {
    setServices((prev) => [...prev, { id: Date.now(), description: "", amount: 0 }]);
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
        services: services.map((s) => ({ id: String(s.id), description: s.description, amount: s.amount })),
        total_amount: totalAmount,
        cash_amount: cashAmount === "" ? 0 : cashAmount,
        image_log_url: logUrl ?? undefined,
        image_cash_url: cashUrl ?? undefined,
      });

      sessionStorage.clear();
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

      {rawText ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
          <button onClick={() => setShowRawText(!showRawText)} className="w-full flex justify-between items-center px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-700 text-left">ข้อความ OCR / Raw OCR Text</p>
              <p className="text-xs text-gray-600 text-left">ข้อความที่อ่านได้จากรูป / Text extracted from image</p>
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

      {extractedNumbers.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-600 mb-2">ตัวเลขที่พบ / Detected numbers — แตะเพื่อใช้เป็นยอดรวม / tap to set as total</p>
          <div className="flex flex-wrap gap-2">
            {extractedNumbers.slice(0, 10).map((num, i) => (
              <button
                key={i}
                onClick={() => setTotalAmount(num)}
                className={`text-sm font-medium px-3 py-1 rounded-full ${
                  totalAmount === num ? "bg-[#8B6BAD] text-white" : "bg-[#F0E8F7] text-[#8B6BAD]"
                }`}
              >
                ฿{num.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      )}

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
              <p className="text-xs text-gray-600">รายการบริการวันนี้ / Today's services</p>
            </div>
            <button onClick={addService} className="text-xs text-[#8B6BAD] font-medium border border-[#C5A8D9] rounded-full px-3 py-1">
              + เพิ่ม / Add
            </button>
          </div>
          <div className="space-y-2">
            {services.map((service) => (
              <div key={service.id} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={service.description}
                  onChange={(e) => updateService(service.id, "description", e.target.value)}
                  placeholder="ชื่อบริการ / Service name"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#9575B5]"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={service.amount}
                  onChange={(e) => updateService(service.id, "amount", Number(e.target.value))}
                  className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-right focus:outline-none focus:border-[#9575B5]"
                />
                <button onClick={() => removeService(service.id)} className="text-gray-500 hover:text-red-400 text-lg leading-none">x</button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          <div>
            <p className="text-xs text-gray-600 mb-1">รวมทั้งหมด / Total amount (฿)</p>
            <input
              type="number"
              inputMode="numeric"
              value={totalAmount}
              onChange={(e) => setTotalAmount(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-lg font-bold text-gray-800 focus:outline-none focus:border-[#9575B5]"
            />
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">รับเป็นเงินสด / Cash received (฿)</p>
            <input
              type="number"
              inputMode="numeric"
              value={cashAmount}
              placeholder="0"
              onChange={(e) => setCashAmount(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-base text-gray-600 focus:outline-none focus:border-[#9575B5]"
            />
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-[#8B6BAD]">ยอดโอน / Transferred</p>
              <p className="text-xs text-gray-600">รวม - สด / Total minus cash</p>
            </div>
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
          {saving ? "กำลังบันทึก... / Saving..." : "บันทึก / Save"}
        </button>
      </div>
    </div>
  );
}
