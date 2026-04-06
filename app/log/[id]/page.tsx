import Link from "next/link";

export default function LogDetailPage() {
  return (
    <div className="max-w-md mx-auto px-4 pt-6 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
      </div>
      <h1 className="text-xl font-bold text-gray-800 mb-1">รายละเอียด / Log Detail</h1>
      <p className="text-xs text-gray-400 mb-8">ข้อมูลการบันทึกประจำวัน / Daily log information</p>
      <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
        <p className="text-gray-400 text-sm">หน้านี้กำลังสร้าง / Coming soon</p>
        <p className="text-gray-300 text-xs mt-1">ระบบกำลังพัฒนา / Under development</p>
      </div>
    </div>
  );
}
