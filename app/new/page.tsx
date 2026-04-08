"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { runOcr } from "@/lib/ocr";
import { saveLog } from "@/lib/db";

export default function NewLogPage() {
  const [logImage, setLogImage] = useState<File | null>(null);
  const [logPreview, setLogPreview] = useState<string | null>(null);
  const [cashImage, setCashImage] = useState<File | null>(null);
  const [cashPreview, setCashPreview] = useState<string | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [isOffDay, setIsOffDay] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");

  const router = useRouter();
  const logInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);

  function handleLogImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogImage(file);
      setLogPreview(URL.createObjectURL(file));
    }
  }

  function handleCashImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCashImage(file);
      setCashPreview(URL.createObjectURL(file));
    }
  }

  async function handleProcess() {
    if (!isOffDay && !logImage) return;
    setProcessing(true);

    try {
      if (isOffDay) {
        // Off-day: save directly with ฿0, no services, no commission
        const today = new Date().toISOString().split("T")[0];
        await saveLog({
          date: today,
          services: [{ id: "off-day", description: "วันหยุด / Off Day", amount: 0, payment: "transfer" }],
          total_amount: 0,
          cash_amount: 0,
          commission_rate: 0,
        });
        window.location.href = "/";
        return;
      }

      // Normal day: run OCR on log photo
      setProgress("กำลังอ่านข้อความ... / Reading text...");
      const ocrResult = await runOcr(logImage!);

      sessionStorage.setItem("ocr_result", JSON.stringify(ocrResult));
      sessionStorage.setItem("cash_amount", cashAmount);
      sessionStorage.setItem("log_image_url", logPreview!);
      if (cashPreview) sessionStorage.setItem("cash_image_url", cashPreview);

      router.push("/review");
    } catch (e) {
      alert("OCR failed: " + (e instanceof Error ? e.message : String(e)));
      setProcessing(false);
    }
  }

  const canProcess = isOffDay || !!logImage;

  return (
    <div className="w-full max-w-md mx-auto px-5 pt-8 pb-24 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
      </div>
      <h1 className="text-xl font-bold text-gray-800 mb-1">บันทึกวันนี้ / New Log</h1>
      <p className="text-xs text-gray-600 mb-6">อัปโหลดรูปและกรอกข้อมูล / Upload photos and fill in details</p>

      <div className="space-y-4">

        {/* Off Day Toggle */}
        <button
          onClick={() => setIsOffDay(!isOffDay)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors ${
            isOffDay
              ? "bg-[#F0E8F7] border-[#C5A8D9] text-[#8B6BAD]"
              : "bg-white border-gray-100 text-gray-600"
          } shadow-sm`}
        >
          <div className="text-left">
            <p className="text-sm font-semibold">วันหยุด / Off Day</p>
            <p className="text-xs opacity-70">คอมมิชชั่น ฿350 / Commission ฿350</p>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${isOffDay ? "bg-[#9575B5]" : "bg-gray-200"}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${isOffDay ? "translate-x-5" : "translate-x-0"}`} />
          </div>
        </button>

        {/* Log Photo — hidden on off days */}
        {!isOffDay && <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-1">รูปสมุดบันทึก / Log Photo</p>
          <p className="text-xs text-gray-600 mb-3">ถ่ายรูปสมุดบันทึกประจำวัน / Photo of the handwritten daily log</p>

          <input ref={logInputRef} type="file" accept="image/*" onChange={handleLogImage} className="hidden" />

          {logPreview ? (
            <div className="relative">
              <img src={logPreview} alt="Log" className="w-full rounded-xl object-cover max-h-48" />
              <button
                onClick={() => { setLogImage(null); setLogPreview(null); if (logInputRef.current) logInputRef.current.value = ""; }}
                className="absolute top-2 right-2 bg-white rounded-full px-2 py-1 text-xs text-gray-500 shadow"
              >
                เปลี่ยน / Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => logInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 active:bg-gray-50"
            >
              <span className="text-3xl">📋</span>
              <span className="text-sm text-gray-600">แตะเพื่ออัปโหลด / Tap to upload</span>
            </button>
          )}
        </div>}

        {/* Cash Photo + Amount — hidden on off days */}
        {!isOffDay && <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-1">รูปเงินสด / Cash Photo <span className="text-xs font-normal text-gray-400">(ถ้ามี / optional)</span></p>
          <p className="text-xs text-gray-600 mb-3">ถ่ายรูปเงินที่รับมา / Photo of cash collected</p>

          <input ref={cashInputRef} type="file" accept="image/*" onChange={handleCashImage} className="hidden" />

          {cashPreview ? (
            <div className="relative mb-3">
              <img src={cashPreview} alt="Cash" className="w-full rounded-xl object-cover max-h-48" />
              <button
                onClick={() => { setCashImage(null); setCashPreview(null); if (cashInputRef.current) cashInputRef.current.value = ""; }}
                className="absolute top-2 right-2 bg-white rounded-full px-2 py-1 text-xs text-gray-500 shadow"
              >
                เปลี่ยน / Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => cashInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 active:bg-gray-50 mb-3"
            >
              <span className="text-3xl">💵</span>
              <span className="text-sm text-gray-600">แตะเพื่ออัปโหลด / Tap to upload</span>
            </button>
          )}

          <div>
            <p className="text-xs text-gray-600 mb-1">จำนวนเงินสด / Cash amount (฿)</p>
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-semibold text-gray-800 focus:outline-none focus:border-[#9575B5]"
            />
          </div>
        </div>}

      </div>

      {/* Process Button */}
      <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto">
        <button
          disabled={!canProcess || processing}
          onClick={handleProcess}
          className={`w-full font-semibold rounded-2xl py-4 shadow-lg transition-colors ${
            canProcess && !processing
              ? "bg-[#9575B5] hover:bg-[#8B6BAD] active:bg-[#7A5C9C] text-white"
              : "bg-gray-100 text-gray-500 cursor-not-allowed"
          }`}
        >
          {processing ? progress || "กำลังประมวลผล... / Processing..." : "ประมวลผล / Process"}
        </button>
      </div>
    </div>
  );
}
