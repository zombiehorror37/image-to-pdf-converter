'use client';

const steps = [
  { num: 1, label: 'Upload', title: 'Add your images', desc: 'Drag & drop, browse, or paste from clipboard' },
  { num: 2, label: 'Arrange', title: 'Organize your pages', desc: 'Reorder, rotate, and bulk edit images' },
  { num: 3, label: 'Export', title: 'Download your PDF', desc: 'Preview and download instantly' },
];

export default function HowItWorks({ isDark }) {
  return (
    <div className={`rounded-2xl p-6 sm:p-8 border ${
      isDark
        ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700/50'
        : 'bg-white/80 backdrop-blur-sm border-gray-200 shadow-lg'
    }`}>
      <h3 className={`text-lg sm:text-xl font-semibold mb-6 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
        How it works
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {steps.map((s) => (
          <div key={s.num} className="text-center sm:text-left">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-3 ${
              isDark ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-100 text-gray-600'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isDark ? 'bg-gray-600 text-white' : 'bg-gray-300 text-gray-700'
              }`}>{s.num}</span>
              {s.label}
            </div>
            <h4 className="font-semibold mb-2 text-sm sm:text-base">{s.title}</h4>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
