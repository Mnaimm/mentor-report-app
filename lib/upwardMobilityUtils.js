export const GRADE_CRITERIA_MAP = {
    G1: [
        'BIMB SME Facility',
        'Other Bank SME Facility',
        'Ready Documentation'
    ],
    G2: [
        'BangKIT to Maju',
        'Maju to SME Financing',
        'Improve Credit Score'
    ],
    G3: [
        'Income/Sale',
        'Job Creation',
        'Asset',
        'Saving',
        'Zakat',
        'Digitalization',
        'Online Sales'
    ]
};

export const UPWARD_MOBILITY_SECTIONS = {
    SECTION_4: {
        title: "Bahagian 4: Penggunaan Saluran Bank Islam & Fintech",
        items: [
            {
                id: 'UM_AKAUN_BIMB',
                title: '1. Penggunaan Akaun Semasa BIMB (Current Account)',
                desc: 'Klik Yes - Jika usahawan menggunakan secara aktif untuk transaksi bisnes.\nKlik No - Jika usahawan hanya menggunakan untuk membayar pembiayaan atau tidak aktif.'
            },
            {
                id: 'UM_BIMB_BIZ',
                title: '2. Penggunaan BIMB Biz',
                desc: 'Aplikasi perbankan mudah alih yang membolehkan usahawan mengurus perniagaan harian mereka dengan cepat dan selamat.'
            },
            {
                id: 'UM_AL_AWFAR',
                title: '3. Buka akaun Al-Awfar (Opened Al-Awfar Account)',
                desc: 'Klik Yes - Jika usahawan membuka akaun Al-Awfar.\nKlik No - Jika usahawan tidak membuka akaun Al-Awfar.'
            },
            {
                id: 'UM_MERCHANT_TERMINAL',
                title: '4. Penggunaan BIMB Merchant Terminal/ Pay2phone',
                desc: 'Aplikasi Bank Islam yang membenarkan usahawan menerima pembayaran tanpa sentuh kad kredit & kad debit melalui telefon bimbit android usahawan yang menggunakan Teknologi NFC.\n\nKlik Yes - Jika usahawan ada menggunakan walaupun jarang-jarang.\nKlik No - Jika usahawan tidak pernah menggunakan / tidak tersedia.'
            },
            {
                id: 'UM_FASILITI_LAIN',
                title: '5. Lain-lain Fasiliti BIMB (Other BIMB Facilities)',
                desc: 'Fasiliti yang ditawarkan oleh BIMB untuk bisnes sahaja seperti kad kredit bisnes dan lain-lain.\n\nKlik Yes - Jika ada menggunakan fasiliti BIMB yang lain untuk bisnes usahawan SAHAJA SELEPAS mendapat pembiayaan daripada BIMB (contoh kad kredit perniagaan dan lain-lain yang melibatkan BISNES SAHAJA, bukan peribadi).\nKlik No - Jika tidak menggunakan mana-mana servis / fasiliti BIMB SELEPAS mendapat pembiayaan.'
            },
            {
                id: 'UM_MESINKIRA',
                title: '6. Melanggan aplikasi MesinKira (Subscribed Mesinkira Apps)',
                desc: 'Klik Yes - Jika ada melanggan aplikasi MesinKira walaupun tidak pernah atau jarang digunakan.\nKlik No - Tidak pernah subscribe aplikasi MesinKira.'
            }
        ]
    },
    SECTION_5: {
        title: "Bahagian 5: Situasi Kewangan Perniagaan (Semasa)",
        infoMessage: "💡 Masukkan maklumat kewangan SEMASA sahaja. Sistem akan bandingkan dengan sesi-sesi lepas untuk track kemajuan.",
        items: [
            {
                label: 'Jumlah Pendapatan Perniagaan Semasa (RM sebulan)',
                field: 'UM_PENDAPATAN_SEMASA',
                placeholder: 'Cth: 8000',
                ulasanLabel: 'Ulasan Mentor *',
                ulasanField: 'UM_ULASAN_PENDAPATAN',
                ulasanPlaceholder: 'Cth: Pendapatan meningkat berbanding sesi lepas. Tambahan pelanggan dari online marketing.'
            },
            {
                label: 'Bilangan Terkini Pekerja Sepenuh Masa',
                field: 'UM_PEKERJA_SEMASA',
                placeholder: 'Cth: 2',
                ulasanLabel: 'Ulasan Mentor *',
                ulasanField: 'UM_ULASAN_PEKERJA',
                ulasanPlaceholder: 'Cth: Tambah 1 pekerja part-time untuk bantu packaging.'
            },
            {
                label: 'Bilangan Terkini Pekerja Part-Time Semasa',
                field: 'UM_PEKERJA_PARTTIME_SEMASA',
                placeholder: 'Cth: 2',
                ulasanLabel: 'Ulasan Mentor *',
                ulasanField: 'UM_ULASAN_PEKERJA_PARTTIME',
                ulasanPlaceholder: 'Cth: Mengambil pekerja sambilan untuk musim perayaan.'
            },
            {
                label: 'Nilai Aset Bukan Tunai Semasa (RM)',
                field: 'UM_ASET_BUKAN_TUNAI_SEMASA',
                placeholder: 'Cth: 15000',
                ulasanLabel: 'Ulasan Mentor *',
                ulasanField: 'UM_ULASAN_ASET_BUKAN_TUNAI',
                ulasanPlaceholder: 'Cth: Beli mesin baru guna geran BIMB.'
            },
            label: 'Simpanan Perniagaan Bulanan Semasa (RM)',
            field: 'UM_SIMPANAN_SEMASA',
            placeholder: 'Cth: 3000',
            ulasanLabel: 'Ulasan Mentor *',
            ulasanField: 'UM_ULASAN_SIMPANAN',
            ulasanPlaceholder: 'Cth: Usahawan mula ada simpanan kecemasan.'
            },
            // Zakat is special (Yes/No), so we handle it separately or give it a type
            {
    type: 'radio_yes_no',
        label: 'Pembayaran Zakat Perniagaan Semasa (Ya/Tidak)',
            field: 'UM_ZAKAT_SEMASA',
                ulasanLabel: 'Ulasan Mentor *',
                    ulasanField: 'UM_ULASAN_ZAKAT',
                        ulasanPlaceholder: 'Cth: Usahawan bayar zakat RM500 untuk tahun ini.'
}
        ]
    },
SECTION_6: {
    title: "Bahagian 6: Digitalisasi & Pemasaran Online (Semasa)",
        digital: {
        label: "Penggunaan Digital (Digitalization) - Pilih SATU (1) ATAU LEBIH bagi penggunaan digital SELEPAS mendapat pembiayaan BIMB.",
            field: "UM_DIGITAL_SEMASA",
                options: [
                    '1 - Data asas dan terhad (Limited and basic data) - Contoh: penggunaan teknologi komunikasi yang minima seperti WhatsApp dan Telegram',
                    '2 - Pengguna advance dan mempunyai peranti khusus untuk perniagaan (Advance user sophisticated device) - Contoh: Ada peranti lain seperti telefon pintar yang digunakan khusus untuk bisnes termasuk penggunaan aplikasi WhatsApp Bisnes.',
                    options: [
                        '1 - Data asas dan terhad (Limited and basic data) - Contoh: penggunaan teknologi komunikasi yang minima seperti WhatsApp dan Telegram',
                        '2 - Pengguna advance dan mempunyai peranti khusus untuk perniagaan (Advance user sophisticated device) - Contoh: Ada peranti lain seperti telefon pintar yang digunakan khusus untuk bisnes termasuk penggunaan aplikasi WhatsApp Bisnes.',
                        '3 - Transaksi kewangan melalui mudah alih atau e-wallet (Financial transaction via mobile or e-wallet)',
                        '4 - Laman web rasmi (Official website)'
                    ],
                    ulasanLabel: "Ulasan Mentor (Penggunaan Digital) *",
                    ulasanField: "UM_ULASAN_DIGITAL",
                    ulasanPlaceholder: "Cth: Usahawan sudah mula guna WhatsApp Business dan social media dengan konsisten."
        },
    marketing: {
        label: "Jualan dan Pemasaran Dalam Talian (Online Sales/Marketing) - Pilih SATU (1) ATAU LEBIH",
            field: "UM_MARKETING_SEMASA",
                options: [
                    '1 - Jualan Bisnes secara Online (Online Business Sales) - Contoh: TikTok Shop, Shopee, Lazada dsbnya.',
                    '2 - Pemasaran secara Online dan Live (Online marketing and live) - Contoh: mempromosi bisnes melalui Live, Facebook Ads, dan sebagainya',
                    '3 - Perniagaan campuran (Mixed Business) - Bisnes online dan Premis/kedai fizikal',
                    '4 - Premis / Kedai fizikal (Physical store)'
                ],
                    ulasanLabel: "Ulasan Mentor (Jualan dan Pemasaran) *",
                        ulasanField: "UM_ULASAN_MARKETING",
                            ulasanPlaceholder: "Cth: 40% daripada jualan kini datang dari online. Usahawan aktif buat FB live setiap minggu."
    }
}
};

export const INITIAL_UPWARD_MOBILITY_STATE = {
    // Section 3: Status & Mobiliti
    UM_STATUS: '',
    UM_KRITERIA_IMPROVEMENT: '',
    UM_TARIKH_LAWATAN_PREMIS: '',
    // Section 4: Bank Islam & Fintech (6 fields)
    UM_AKAUN_BIMB: '',
    UM_BIMB_BIZ: '',
    UM_AL_AWFAR: '',
    UM_MERCHANT_TERMINAL: '',
    UM_FASILITI_LAIN: '',
    UM_MESINKIRA: '',
    // Section 5: Situasi Kewangan (Semasa + Ulasan pairs)
    UM_PENDAPATAN_SEMASA: '',
    UM_ULASAN_PENDAPATAN: '',
    UM_PEKERJA_SEMASA: '',
    UM_ULASAN_PEKERJA: '',
    UM_PEKERJA_PARTTIME_SEMASA: '',
    UM_ULASAN_PEKERJA_PARTTIME: '',
    UM_ASET_BUKAN_TUNAI_SEMASA: '',
    UM_ULASAN_ASET_BUKAN_TUNAI: '',

    UM_SIMPANAN_SEMASA: '',
    UM_ULASAN_SIMPANAN: '',
    UM_ZAKAT_SEMASA: '',
    UM_ULASAN_ZAKAT: '',
    // Section 6: Digital & Marketing (Semasa + Ulasan pairs)
    UM_DIGITAL_SEMASA: [],
    UM_ULASAN_DIGITAL: '',
    UM_MARKETING_SEMASA: [],
    UM_ULASAN_MARKETING: '',
};

/**
 * Calculates the new value for a checkbox group field.
 * @param {string[]} currentArray - The current array of selected values.
 * @param {string} value - The value to toggle.
 * @param {boolean} checked - Whether the value is checked or unchecked.
 * @returns {string[]} The updated array of selected values.
 */
export const calculateCheckboxValue = (currentArray, value, checked) => {
    const arr = Array.isArray(currentArray) ? currentArray : [];
    if (checked) {
        return [...arr, value];
    } else {
        return arr.filter(item => item !== value);
    }
};

/**
 * Calculates the new value for the criteria improvement textarea when a tag is clicked.
 * @param {string} currentValue - The current text in the textarea.
 * @param {string} tag - The tag to add.
 * @returns {string} The updated text.
 */
export const calculateTagClickValue = (currentValue, tag) => {
    const val = currentValue || '';

    // Check if tag already exists (case-insensitive)
    if (val.toLowerCase().includes(tag.toLowerCase())) {
        return val;
    }

    // Append tag with comma separator if needed
    return val.trim() ? `${val.trim()}, ${tag}` : tag;
};

/**
 * Validates the Upward Mobility section.
 * @param {object} umState - The current Upward Mobility state object.
 * @param {boolean} isMIA - Whether the mentee is MIA (validation skipped if true).
 * @returns {string[]} An array of error messages.
 */
export const validateUpwardMobility = (umState, isMIA = false) => {
    if (isMIA) return [];

    const errors = [];

    // Section 3: Status & Mobiliti
    if (!umState.UM_STATUS || umState.UM_STATUS.trim() === '') {
        errors.push('Upward Mobility - Upward Mobility Status adalah wajib diisi');
    }

    // Section 4: Bank Islam & Fintech (all 6 required)
    if (!umState.UM_AKAUN_BIMB || umState.UM_AKAUN_BIMB.trim() === '') {
        errors.push('Upward Mobility - Akaun Semasa BIMB adalah wajib diisi');
    }
    if (!umState.UM_BIMB_BIZ || umState.UM_BIMB_BIZ.trim() === '') {
        errors.push('Upward Mobility - BIMB Biz adalah wajib diisi');
    }
    if (!umState.UM_AL_AWFAR || umState.UM_AL_AWFAR.trim() === '') {
        errors.push('Upward Mobility - Al-Awfar adalah wajib diisi');
    }
    if (!umState.UM_MERCHANT_TERMINAL || umState.UM_MERCHANT_TERMINAL.trim() === '') {
        errors.push('Upward Mobility - Merchant Terminal adalah wajib diisi');
    }
    if (!umState.UM_FASILITI_LAIN || umState.UM_FASILITI_LAIN.trim() === '') {
        errors.push('Upward Mobility - Fasiliti Lain BIMB adalah wajib diisi');
    }
    if (!umState.UM_MESINKIRA || umState.UM_MESINKIRA.trim() === '') {
        errors.push('Upward Mobility - MesinKira adalah wajib diisi');
    }

    // Section 5: Situasi Kewangan (Ulasan fields required)
    if (!umState.UM_ULASAN_PENDAPATAN || umState.UM_ULASAN_PENDAPATAN.trim() === '') {
        errors.push('Upward Mobility - Ulasan Mentor untuk Pendapatan adalah wajib diisi');
    }
    if (!umState.UM_ULASAN_PEKERJA || umState.UM_ULASAN_PEKERJA.trim() === '') {
        errors.push('Upward Mobility - Ulasan Mentor untuk Bilangan Pekerja adalah wajib diisi');
    }
    if (!umState.UM_ULASAN_PEKERJA_PARTTIME || umState.UM_ULASAN_PEKERJA_PARTTIME.trim() === '') {
        errors.push('Upward Mobility - Ulasan Mentor untuk Bilangan Pekerja Part-Time adalah wajib diisi');
    }
    if (!umState.UM_ULASAN_ASET_BUKAN_TUNAI || umState.UM_ULASAN_ASET_BUKAN_TUNAI.trim() === '') {
        errors.push('Upward Mobility - Ulasan Mentor untuk Aset Bukan Tunai adalah wajib diisi');
    }

    if (!umState.UM_ULASAN_SIMPANAN || umState.UM_ULASAN_SIMPANAN.trim() === '') {
        errors.push('Upward Mobility - Ulasan Mentor untuk Simpanan adalah wajib diisi');
    }
    if (!umState.UM_ULASAN_ZAKAT || umState.UM_ULASAN_ZAKAT.trim() === '') {
        errors.push('Upward Mobility - Ulasan Mentor untuk Zakat adalah wajib diisi');
    }

    // Section 6: Digital & Marketing (Ulasan fields required)
    if (!umState.UM_ULASAN_DIGITAL || umState.UM_ULASAN_DIGITAL.trim() === '') {
        errors.push('Upward Mobility - Ulasan Mentor untuk Penggunaan Digital adalah wajib diisi');
    }
    if (!umState.UM_ULASAN_MARKETING || umState.UM_ULASAN_MARKETING.trim() === '') {
        errors.push('Upward Mobility - Ulasan Mentor untuk Jualan dan Pemasaran adalah wajib diisi');
    }

    return errors;
};
