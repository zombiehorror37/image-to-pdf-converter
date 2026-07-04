'use client';
import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

export default function MetadataDialog({ isDark, pdfBlob, onClose, onApply }) {
  const [loading,  setLoading]  = useState(true);
  const [title,    setTitle]    = useState('');
  const [author,   setAuthor]   = useState('');
  const [subject,  setSubject]  = useState('');
  const [keywords, setKeywords] = useState('');

  useEffect(() => {
    if (!pdfBlob) return;
    let cancelled = false;
    import('../lib/pdfTools')
      .then(({ readMetadata }) => readMetadata(pdfBlob))
      .then(meta => {
        if (cancelled) return;
        setTitle(meta.title || '');
        setAuthor(meta.author || '');
        setSubject(meta.subject || '');
        setKeywords(meta.keywords || '');
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pdfBlob]);

  const field = `w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors ${
    isDark
      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
  }`;

  const label = `block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className="text-lg font-semibold">Edit Metadata</h2>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className={label}>Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                className={field} placeholder="Document title" />
            </div>
            <div>
              <label className={label}>Author</label>
              <input type="text" value={author} onChange={e => setAuthor(e.target.value)}
                className={field} placeholder="Author name" />
            </div>
            <div>
              <label className={label}>Subject</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                className={field} placeholder="Document subject" />
            </div>
            <div>
              <label className={label}>Keywords <span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(comma-separated)</span></label>
              <input type="text" value={keywords} onChange={e => setKeywords(e.target.value)}
                className={field} placeholder="keyword1, keyword2" />
            </div>
          </div>
        )}

        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            Cancel
          </button>
          <button
            onClick={() => onApply({ title, author, subject, keywords })}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all disabled:opacity-40"
          >
            Save metadata
          </button>
        </div>
      </div>
    </div>
  );
}
