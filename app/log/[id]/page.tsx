import Link from "next/link";

// Mock data — will be replaced with real Supabase fetch later
const mockLog = {
  id: "1",
  date: "2026-04-06",
  services: [
    { description: "Gel Manicure / ทำเล็บมือ เจล", amount: 600 },
    { description: "Acrylic Extension / ต่อเล็บ", amount: 700 },
    { description: "Pedicure / ทำเล็บเท้า", amount: 300 },
  ],
  total: 1600,
  cash: 400,
  transferred: 1200,
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const th = date.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const en = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return { th, en };
}

export default function LogDetailPage() {
  const log = mockLog;
  const { th, en } = formatDate(log.date);

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-24 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-[#8B6BAD] text-sm">← กลับ / Back</Link>
      </div>

      <h1 className="text-xl font-bold text-gray-800 mb-1">สรุปประจำวัน / Day Summary</h1>
      <p className="text-sm text-gray-500">{th}</p>
      <p className="text-xs text-gray-400 mb-6">{en}</p>

      <div className="space-y-4">

        {/* Services */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-1">บริการ / Services</p>
          <p className="text-xs text-gray-400 mb-3">รายการบริการวันนี้ / Today's services</p>
          <div className="space-y-2">
            {log.services.map((s, i) => (
              <div key={i} className="flex justify-between items-center">
                <p className="text-sm text-gray-600">{s.description}</p>
                <p className="text-sm font-medium text-gray-800">฿{s.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-400">รวมทั้งหมด</p>
              <p className="text-[10px] text-gray-300">Total earned</p>
            </div>
            <p className="text-lg font-bold text-gray-800">฿{log.total.toLocaleString()}</p>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-400">รับเป็นเงินสด</p>
              <p className="text-[10px] text-gray-300">Cash received</p>
            </div>
            <p className="text-base font-medium text-gray-600">฿{log.cash.toLocaleString()}</p>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-[#8B6BAD]">ยอดโอน</p>
              <p className="text-[10px] text-[#C5A8D9]">Transferred</p>
            </div>
            <p className="text-xl font-bold text-[#8B6BAD]">฿{log.transferred.toLocaleString()}</p>
          </div>
        </div>

      </div>

      {/* Edit Button */}
      <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto">
        <Link
          href={`/log/${log.id}/edit`}
          className="flex items-center justify-center w-full bg-[#9575B5] hover:bg-[#8B6BAD] active:bg-[#7A5C9C] text-white font-semibold rounded-2xl py-4 shadow-lg transition-colors"
        >
          แก้ไข / Edit this day
        </Link>
      </div>
    </div>
  );
}
