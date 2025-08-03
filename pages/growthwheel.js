import React, { useState, useRef } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';

// --- Reusable UI Components ---
const Select = ({ label, options, value, onChange, disabled = false, required = false }) => (
  <div className="w-full">
    <select value={value} onChange={onChange} disabled={disabled} required={required} className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-sm">
      <option value="0">Pilih Tahap</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

// --- Data Structure for the Rubric ---
const growthWheelRubric = [
    { Focus_Area: "Idea Perniagaan", options: [
        { value: 1, label: "1 - Tiada: Tiada idea perniagaan yang difikirkan atau hanya sekadar angan-angan tanpa hala tuju." },
        { value: 2, label: "2 - Asas: Ada idea kasar, tetapi tidak fokus, tidak unik, atau belum tahu siapa pelanggan sasaran." },
        { value: 3, label: "3 - Sederhana: Idea sudah lebih jelas, tahu masalah yang ingin diselesaikan, tetapi belum diuji pasaran." },
        { value: 4, label: "4 - Mantap: Idea kukuh, tahu pelanggan sasaran, nilai unik dikenalpasti, ada sedikit maklum balas." },
        { value: 5, label: "5 - Terbukti: Idea sangat jelas, unik, menyelesaikan masalah nyata, sudah diuji dan dapat maklum balas positif daripada pelanggan sebenar." }
    ]},
    { Focus_Area: "Portfolio Produk & Servis", options: [
        { value: 1, label: "1 - Tiada: Tiada produk atau servis yang ditawarkan, atau masih belum difikirkan." },
        { value: 2, label: "2 - Asas: Ada 1–2 produk/servis asas, tetapi belum konsisten atau belum tersedia sepenuhnya." },
        { value: 3, label: "3 - Sederhana: Produk/servis telah dikenal pasti dan siap ditawarkan, tetapi belum diuji pasaran." },
        { value: 4, label: "4 - Mantap: Beberapa produk/servis ditawarkan dan telah menerima maklum balas asas daripada pelanggan." },
        { value: 5, label: "5 - Terbukti: Produk/servis terbukti mendapat permintaan konsisten dan maklum balas positif pelanggan sebenar." }
    ]},
    { Focus_Area: "Model Pendapatan", options: [
        { value: 1, label: "1 - Tiada: Tiada model pendapatan yang difikirkan. Tidak tahu bagaimana perniagaan akan menjana wang." },
        { value: 2, label: "2 - Asas: Ada idea kasar bagaimana menjana pendapatan, tetapi belum jelas dan tidak diuji." },
        { value: 3, label: "3 - Sederhana: Model pendapatan telah dirangka, tetapi masih belum ada pelanggan membayar." },
        { value: 4, label: "4 - Mantap: Model telah diuji dengan pelanggan terhad dan menunjukkan potensi." },
        { value: 5, label: "5 - Terbukti: Model pendapatan jelas, diuji, dan menunjukkan hasil yang stabil dan boleh dikembangkan." }
    ]},
    { Focus_Area: "Portfolio Pelanggan", options: [
        { value: 1, label: "1 - Tiada: Tiada pelanggan atau belum pernah menjual kepada sesiapa." },
        { value: 2, label: "2 - Asas: Ada beberapa pelanggan secara tidak konsisten atau tidak dirancang." },
        { value: 3, label: "3 - Sederhana: Pelanggan mula dikenal pasti dan mula membeli secara berulang." },
        { value: 4, label: "4 - Mantap: Mempunyai kumpulan pelanggan tetap dan mula mengenal pasti segmen penting." },
        { value: 5, label: "5 - Terbukti: Mempunyai pelbagai segmen pelanggan yang stabil dengan hubungan jangka panjang." }
    ]},
    { Focus_Area: "Kedudukan Pasaran", options: [
        { value: 1, label: "1 - Tiada: Tidak tahu kedudukan perniagaan dalam pasaran atau siapa pesaing." },
        { value: 2, label: "2 - Asas: Ada pengetahuan umum tentang pesaing, tetapi tiada keunikan tersendiri." },
        { value: 3, label: "3 - Sederhana: Sudah kenal pasti pesaing utama dan kelebihan sendiri." },
        { value: 4, label: "4 - Mantap: Perniagaan telah mengukuhkan posisi dalam niche tersendiri." },
        { value: 5, label: "5 - Terbukti: Perniagaan dikenali di pasaran dan mempunyai kelebihan daya saing jelas." }
    ]},
    { Focus_Area: "Pemilikan & Lembaga", options: [
        { value: 1, label: "1 - Tiada: Tiada struktur pemilikan atau belum didaftarkan." },
        { value: 2, label: "2 - Asas: Pemilikan individu, belum jelas tentang peranan atau perjanjian." },
        { value: 3, label: "3 - Sederhana: Ada perjanjian pemilikan asas, tetapi belum formal sepenuhnya." },
        { value: 4, label: "4 - Mantap: Struktur pemilikan dan peranan lembaga jelas dan difahami." },
        { value: 5, label: "5 - Terbukti: Pemilikan formal, peranan jelas, dan wujud tadbir urus efektif." }
    ]},
    { Focus_Area: "Pekerja", options: [
        { value: 1, label: "1 - Tiada: Tiada pekerja atau hanya bantuan tidak formal." },
        { value: 2, label: "2 - Asas: Ada pekerja sambilan atau keluarga, tanpa struktur kerja." },
        { value: 3, label: "3 - Sederhana: Mempunyai pekerja tetap dengan tugasan asas." },
        { value: 4, label: "4 - Mantap: Struktur kerja dan pembahagian tugas semakin jelas." },
        { value: 5, label: "5 - Terbukti: Pasukan stabil dengan SOP, latihan dan pemantauan prestasi." }
    ]},
    { Focus_Area: "Rakan Kerjasama", options: [
        { value: 1, label: "1 - Tiada: Tiada rakan kerjasama dikenalpasti." },
        { value: 2, label: "2 - Asas: Ada hubungan tidak rasmi, tetapi belum berstruktur." },
        { value: 3, label: "3 - Sederhana: Sudah mula bina kerjasama dengan pihak tertentu." },
        { value: 4, label: "4 - Mantap: Rakan kerjasama memberikan impak pada operasi." },
        { value: 5, label: "5 - Terbukti: Kerjasama strategik aktif dan memberi nilai tambah." }
    ]},
    { Focus_Area: "Proses Perniagaan", options: [
        { value: 1, label: "1 - Tiada: Tiada proses tetap, kerja dilakukan secara spontan." },
        { value: 2, label: "2 - Asas: Ada susunan kerja asas, tetapi belum didokumenkan." },
        { value: 3, label: "3 - Sederhana: Proses penting sudah ditentukan dan diamalkan." },
        { value: 4, label: "4 - Mantap: Proses utama telah didokumenkan dan dipantau." },
        { value: 5, label: "5 - Terbukti: Proses mantap, konsisten dan boleh diskalakan." }
    ]},
    { Focus_Area: "Isu Undang-Undang", options: [
        { value: 1, label: "1 - Tiada: Perniagaan tidak berdaftar atau tidak sah." },
        { value: 2, label: "2 - Asas: Telah daftar, tetapi tiada lesen/sijil lain." },
        { value: 3, label: "3 - Sederhana: Ada lesen dan pematuhan asas." },
        { value: 4, label: "4 - Mantap: Mengikuti keperluan undang-undang utama." },
        { value: 5, label: "5 - Terbukti: Lengkap dari segi pematuhan dan dilindungi kontrak." }
    ]},
    { Focus_Area: "Rangkaian", options: [
        { value: 1, label: "1 - Tiada: Tidak aktif dalam sebarang komuniti atau rangkaian." },
        { value: 2, label: "2 - Asas: Ada kenalan tetapi tidak dimanfaatkan." },
        { value: 3, label: "3 - Sederhana: Mula sertai program atau kumpulan berkaitan industri." },
        { value: 4, label: "4 - Mantap: Rangkaian menyumbang kepada pelanggan atau sumber." },
        { value: 5, label: "5 - Terbukti: Aktif membina dan menyumbang kepada rangkaian strategik." }
    ]},
    { Focus_Area: "Pemasaran", options: [
        { value: 1, label: "1 - Tiada: Tiada usaha pemasaran dijalankan." },
        { value: 2, label: "2 - Asas: Pemasaran secara rawak tanpa perancangan." },
        { value: 3, label: "3 - Sederhana: Pemasaran dijalankan dengan strategi asas." },
        { value: 4, label: "4 - Mantap: Mempunyai pelan pemasaran yang dilaksanakan." },
        { value: 5, label: "5 - Terbukti: Pemasaran konsisten dan berjaya tarik pelanggan." }
    ]},
    { Focus_Area: "Jualan & Perkhidmatan", options: [
        { value: 1, label: "1 - Tiada: Tiada sistem jualan, hanya jual secara spontan." },
        { value: 2, label: "2 - Asas: Ada rekod jualan asas, tetapi tidak konsisten." },
        { value: 3, label: "3 - Sederhana: Proses jualan dan servis pelanggan jelas." },
        { value: 4, label: "4 - Mantap: Sistem jualan dan perkhidmatan dimantapkan." },
        { value: 5, label: "5 - Terbukti: Pendekatan jualan dan servis profesional dan dioptimumkan." }
    ]},
    { Focus_Area: "Komunikasi & PR", options: [
        { value: 1, label: "1 - Tiada: Tiada komunikasi rasmi dengan pelanggan/pihak luar." },
        { value: 2, label: "2 - Asas: Komunikasi hanya berlaku apabila diperlukan." },
        { value: 3, label: "3 - Sederhana: Mula wujud saluran komunikasi tetap." },
        { value: 4, label: "4 - Mantap: Aktif menggunakan komunikasi untuk bina kepercayaan." },
        { value: 5, label: "5 - Terbukti: Strategi komunikasi menyumbang kepada jenama & reputasi." }
    ]},
    { Focus_Area: "Penjenamaan", options: [
        { value: 1, label: "1 - Tiada: Tiada jenama tetap digunakan." },
        { value: 2, label: "2 - Asas: Ada nama perniagaan, tetapi tidak konsisten." },
        { value: 3, label: "3 - Sederhana: Jenama digunakan pada produk/servis." },
        { value: 4, label: "4 - Mantap: Identiti jenama mula dikenali pelanggan." },
        { value: 5, label: "5 - Terbukti: Jenama dikenali dan dikaitkan dengan nilai unik." }
    ]},
    { Focus_Area: "Kewangan", options: [
        { value: 1, label: "1 - Tiada: Tiada rekod kewangan langsung." },
        { value: 2, label: "2 - Asas: Rekod kewangan asas tetapi tidak dikemaskini." },
        { value: 3, label: "3 - Sederhana: Rekod asas dikekalkan, tahu untung rugi kasar." },
        { value: 4, label: "4 - Mantap: Mula gunakan sistem dan laporan kewangan ringkas." },
        { value: 5, label: "5 - Terbukti: Pengurusan kewangan mantap dengan laporan lengkap." }
    ]},
    { Focus_Area: "Pembiayaan", options: [
        { value: 1, label: "1 - Tiada: Tiada pembiayaan atau tidak tahu pilihan sedia ada." },
        { value: 2, label: "2 - Asas: Pernah mohon tetapi tidak tahu strategi sesuai." },
        { value: 3, label: "3 - Sederhana: Sudah dapat pembiayaan kecil secara rasmi/tidak rasmi." },
        { value: 4, label: "4 - Mantap: Pembiayaan digunakan untuk berkembang dan dipantau." },
        { value: 5, label: "5 - Terbukti: Akses pelbagai sumber pembiayaan dengan perancangan." }
    ]},
    { Focus_Area: "Pengeluaran & Penghantaran", options: [
        { value: 1, label: "1 - Tiada: Tiada sistem pengeluaran, dibuat ikut permintaan." },
        { value: 2, label: "2 - Asas: Pengeluaran ada tetapi belum konsisten." },
        { value: 3, label: "3 - Sederhana: Proses pengeluaran stabil, tetapi penghantaran lemah." },
        { value: 4, label: "4 - Mantap: Pengeluaran dan penghantaran dipantau dan dikawal." },
        { value: 5, label: "5 - Terbukti: Sistem cekap, boleh berkembang dan memenuhi permintaan." }
    ]},
    { Focus_Area: "Sistem IT", options: [
        { value: 1, label: "1 - Tiada: Tidak guna IT langsung dalam operasi." },
        { value: 2, label: "2 - Asas: Ada guna IT asas (WhatsApp, Google Form)." },
        { value: 3, label: "3 - Sederhana: Gunakan perisian untuk sebahagian operasi." },
        { value: 4, label: "4 - Mantap: Sistem IT membantu kawalan dan kecekapan." },
        { value: 5, label: "5 - Terbukti: Gunakan sistem IT menyeluruh dan bersepadu." }
    ]},
    { Focus_Area: "Kemudahan / Fasiliti", options: [
        { value: 1, label: "1 - Tiada: Tiada premis tetap, hanya dari rumah atau tidak sesuai." },
        { value: 2, label: "2 - Asas: Ada ruang asas tetapi tidak selesa atau tidak lengkap." },
        { value: 3, label: "3 - Sederhana: Kemudahan mencukupi untuk operasi asas." },
        { value: 4, label: "4 - Mantap: Kemudahan disusun rapi dan selamat." },
        { value: 5, label: "5 - Terbukti: Fasiliti profesional, bersih dan mesra pelanggan/pekerja." }
    ]},
];

// --- Main GrowthWheel Page Component ---
export default function GrowthWheelPage() {
  const [scores, setScores] = useState(Array(20).fill(0));
  const [menteeName, setMenteeName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split('T')[0]);
  
  const chartRef = useRef(null);

  const handleScoreChange = (index, value) => {
    const newScores = [...scores];
    newScores[index] = parseInt(value) || 0;
    setScores(newScores);
  };

  const handleDownload = () => {
    if (chartRef.current === null) {
      return;
    }
    toPng(chartRef.current, { cacheBust: true, backgroundColor: '#ffffff', pixelRatio: 2 })
      .then((dataUrl) => {
        const fileName = `GrowthWheel - ${menteeName || 'Penilaian'} - ${assessmentDate}.png`;
        saveAs(dataUrl, fileName);
      })
      .catch((err) => {
        console.error('Failed to download chart image:', err);
        alert('Maaf, imej carta gagal dimuat turun.');
      });
  };

  const chartData = growthWheelRubric.map((item, index) => ({
    subject: item.Focus_Area,
    score: scores[index],
    fullMark: 5,
  }));

  return (
    <div className="bg-gray-100 min-h-screen font-sans p-4 sm:p-8">
      <div className="max-w-5xl mx-auto bg-white p-6 sm:p-10 rounded-xl shadow-lg">
        <header className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">Alat Penilaian GrowthWheel 360°</h1>
          <p className="text-gray-500 mt-1">Lengkapkan penilaian untuk menjana carta visual.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Nama Usahawan (Mentee)</label>
                <input
                    type="text"
                    value={menteeName}
                    onChange={(e) => setMenteeName(e.target.value)}
                    placeholder="Taip nama mentee di sini..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                />
            </div>
            <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Nama Bisnes</label>
                <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Taip nama bisnes di sini..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                />
            </div>
            <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Tarikh Penilaian</label>
                <input
                    type="date"
                    value={assessmentDate}
                    onChange={(e) => setAssessmentDate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                />
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-4 mb-10">
          {growthWheelRubric.map((item, index) => (
            <div key={index} className="flex items-center justify-between space-x-4">
              <label className="text-base text-gray-800 flex-1">{index + 1}. {item.Focus_Area}</label>
              <div className="w-64">
                <Select
                  options={item.options}
                  value={scores[index]}
                  onChange={(e) => handleScoreChange(index, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-10">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Visualisasi GrowthWheel</h2>
          <div ref={chartRef} className="p-4 bg-white">
            <div className="text-center mb-4">
                <h3 className="text-xl font-bold">{menteeName || "Nama Usahawan"}</h3>
                <p className="text-md text-gray-600">{businessName || "Nama Bisnes"}</p>
                <p className="text-sm text-gray-500">Tarikh: {assessmentDate}</p>
            </div>
            <ResponsiveContainer width="100%" height={500}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 5]} />
                <Radar name={menteeName || 'Mentee'} dataKey="score" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-8">
            <button
              onClick={handleDownload}
              disabled={!menteeName || !businessName || !assessmentDate}
              className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors text-lg"
            >
              Muat Turun Carta sebagai Imej
            </button>
            <p className="text-xs text-gray-500 mt-2">Sila masukkan semua maklumat untuk mengaktifkan butang muat turun.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
