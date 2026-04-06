"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

export default function NewLogPage() {
  const [logImage, setLogImage] = useState<string | null>(null);
  const [cashImage, setCashImage] = useState<string | null>(null);
  const [cashAmount, setCashAmount] = useState("");

  const router = useRouter();
  const logInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);

  function handleLogImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setLogImage(URL.createObjectURL(file));
  }

  function handleCashImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setCashImage(URL.createObjectURL(file));
  }

  const canProcess = logImage && cashImage && cashAmount;

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-24 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
      </div>
      <h1 className="text-xl font-bold text-gray-800 mb-1">บันทึกวันนี้ / New Log</h1>
      <p className="text-xs text-gray-400 mb-6">อัปโหลดรูปและกรอกข้อมูล / Upload photos and fill in details</p>

      <div className="space-y-4">

        {/* Log Photo */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-1">รูปสมุดบันทึก / Log Photo</p>
          <p className="text-xs text-gray-400 mb-3">ถ่ายรูปสมุดบันทึกประจำวัน / Photo of the handwritten daily log</p>

          <input
            ref={logInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleLogImage}
            className="hidden"
          />

          {logImage ? (
            <div className="relative">
              <img src={logImage} alt="Log" className="w-full rounded-xl object-cover max-h-48" />
              <button
                onClick={() => { setLogImage(null); if (logInputRef.current) logInputRef.current.value = ""; }}
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
              <span className="text-sm text-gray-400">แตะเพื่ออัปโหลด / Tap to upload</span>
            </button>
          )}
        </div>

        {/* Cash Photo + Amount */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-1">รูปเงินสด / Cash Photo</p>
          <p className="text-xs text-gray-400 mb-3">ถ่ายรูปเงินที่รับมา / Photo of cash collected</p>

          <input
            ref={cashInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCashImage}
            className="hidden"
          />

          {cashImage ? (
            <div className="relative mb-3">
              <img src={cashImage} alt="Cash" className="w-full rounded-xl object-cover max-h-48" />
              <button
                onClick={() => { setCashImage(null); if (cashInputRef.current) cashInputRef.current.value = ""; }}
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
              <span className="text-sm text-gray-400">แตะเพื่ออัปโหลด / Tap to upload</span>
            </button>
          )}

          {/* Cash Amount */}
          <div>
            <p className="text-xs text-gray-500 mb-1">จำนวนเงินสด / Cash amount (฿)</p>
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-semibold text-gray-800 focus:outline-none focus:border-[#9575B5]"
            />
          </div>
        </div>

      </div>

      {/* Process Button */}
      <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto">
        <button
          disabled={!canProcess}
          onClick={() => canProcess && router.push("/review")}
          className={`w-full font-semibold rounded-2xl py-4 shadow-lg transition-colors ${
            canProcess
              ? "bg-[#9575B5] hover:bg-[#8B6BAD] active:bg-[#7A5C9C] text-white"
              : "bg-gray-100 text-gray-300 cursor-not-allowed"
          }`}
        >
          ประมวลผล / Process
        </button>
      </div>
    </div>
  );
}
