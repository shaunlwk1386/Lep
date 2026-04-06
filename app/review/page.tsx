"use client";

import Link from "next/link";
import { useState } from "react";

// Mock OCR output — simulating what Tesseract would return from a handwritten Thai log
const mockRawText = `วันที่ 6 เม.ย. 2569
ซาลี่
1. ทำเล็บมือ เจล 600
2. ต่อเล็บ อะคริลิค 700
3. ทำเล็บเท้า 300
รวม 1600
รับเงินสด 400`;

const mockExtractedNumbers = [600, 700, 300, 1600, 400];

const mockServices = [
  { id: 1, description: "ทำเล็บมือ เจล / Gel Manicure", amount: 600 },
  { id: 2, description: "ต่อเล็บ อะคริลิค / Acrylic Extension", amount: 700 },
  { id: 3, description: "ทำเล็บเท้า / Pedicure", amount: 300 },
];

export default function ReviewPage() {
  const [showRawText, setShowRawText] = useState(false);
  const [services, setServices] = useState(mockServices);
  const [date, setDate] = useState("2026-04-06");
  const [totalAmount, setTotalAmount] = useState(1600);
  const [cashAmount, setCashAmount] = useState(400);

  const transferred = totalAmount - cashAmount;

  function updateService(id: number, field: "description" | "amount", value: string | number) {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  function addService() {
    const newId = Date.now();
    setServices((prev) => [...prev, { id: newId, description: "", amount: 0 }]);
  }

  function removeService(id: number) {
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="w-full max-w-md mx-auto px-5 pt-8 pb-32 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/new" className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
      </div>
      <h1 className="text-xl font-bold text-gray-800 mb-1">ตรวจสอบข้อมูล / Review</h1>
      <p className="text-xs text-gray-400 mb-6">แก้ไขข้อมูลก่อนบันทึก / Edit before saving</p>

      {/* Raw OCR Text (collapsible) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
        <button
          onClick={() => setShowRawText(!showRawText)}
          className="w-full flex justify-between items-center px-4 py-3"
        >
          <div>
            <p className="text-sm font-semibold text-gray-700 text-left">ข้อความ OCR / Raw OCR Text</p>
            <p className="text-xs text-gray-400 text-left">ข้อความที่อ่านได้จากรูป / Text extracted from image</p>
          </div>
          <span className="text-gray-400 text-sm">{showRawText ? "▲" : "▼"}</span>
        </button>
        {showRawText && (
          <div className="px-4 pb-4">
            <pre className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap font-sans">
              {mockRawText}
            </pre>
          </div>
        )}
      </div>

      {/* Extracted Numbers */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">ตัวเลขที่พบ / Detected numbers — แตะเพื่อใช้ / tap to use</p>
        <div className="flex flex-wrap gap-2">
          {mockExtractedNumbers.map((num, i) => (
            <button
              key={i}
              onClick={() => setTotalAmount(num)}
              className="bg-[#F0E8F7] text-[#8B6BAD] text-sm font-medium px-3 py-1 rounded-full"
            >
              ฿{num.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">

        {/* Date */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">วันที่ / Date</p>
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
              <p className="text-xs text-gray-400">รายการบริการวันนี้ / Today's services</p>
            </div>
            <button
              onClick={addService}
              className="text-xs text-[#8B6BAD] font-medium border border-[#C5A8D9] rounded-full px-3 py-1"
            >
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
                  value={service.amount}
                  onChange={(e) => updateService(service.id, "amount", Number(e.target.value))}
                  className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-right focus:outline-none focus:border-[#9575B5]"
                />
                <button
                  onClick={() => removeService(service.id)}
                  className="text-gray-300 hover:text-red-400 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">รวมทั้งหมด / Total amount (฿)</p>
            <input
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-lg font-bold text-gray-800 focus:outline-none focus:border-[#9575B5]"
            />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">รับเป็นเงินสด / Cash received (฿)</p>
            <input
              type="number"
              value={cashAmount}
              onChange={(e) => setCashAmount(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-base text-gray-600 focus:outline-none focus:border-[#9575B5]"
            />
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-[#8B6BAD]">ยอดโอน / Transferred</p>
              <p className="text-xs text-gray-400">รวม - สด / Total minus cash</p>
            </div>
            <p className="text-xl font-bold text-[#8B6BAD]">฿{transferred.toLocaleString()}</p>
          </div>
        </div>

      </div>

      {/* Save Button */}
      <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto">
        <button className="w-full bg-[#9575B5] hover:bg-[#8B6BAD] active:bg-[#7A5C9C] text-white font-semibold rounded-2xl py-4 shadow-lg transition-colors">
          บันทึก / Save
        </button>
      </div>
    </div>
  );
}
