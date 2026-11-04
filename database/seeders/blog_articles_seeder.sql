-- Seeder: blog_articles
-- Date: 2026-02-15
-- Description: Insert sample articles for agricultural education

-- Insert sample articles for educational content
INSERT INTO
    blog_articles (
        title,
        slug,
        excerpt,
        content,
        category_id,
        is_published,
        is_featured,
        author_name
    )
VALUES

-- Article 1: Budidaya Paria
(
    'Panduan Lengkap Budidaya Paria untuk Pemula',
    'panduan-budidaya-paria-pemula',
    'Panduan lengkap budidaya tanaman paria mulai dari persiapan lahan, penanaman, perawatan hingga panen. Cocok untuk petani pemula yang ingin memulai budidaya paria.',
    '## Persiapan Lahan

Lahan dibersihkan dari gulma dan rumput liar kemudian digemburkan dengan cara dibajak atau dicangkul. Pastikan pH tanah berkisar antara 6.0-7.0 untuk pertumbuhan optimal.

## Pembuatan Bedengan

Sistem penanaman paria menggunakan lanjangan para-para persegi dengan penanaman 1 baris maka lebar bedengan yang diperlukan adalah 50 - 60cm, jarak antar bedengan 3 meter. Tinggi bedengan sekitar 20-30 cm.

## Pupuk Dasar

Pupuk dasar yang digunakan NPK Phonska 30 gr : Fertiphos 20 gr per tanaman atau dengan contoh perhitungan per populasi 500 tanaman masing - masing NPK Phonska 15 kg: Fertiphos 10 kg ditabur secara merata diatas bedengan.

## Penanaman Benih

Benih paria ditanam dengan jarak tanam 40x40 cm. Setiap lubang tanam diisi 2-3 biji benih dengan kedalaman 2-3 cm.

## Perawatan

- Penyiraman dilakukan 2 kali sehari (pagi dan sore)
- Penyiangan gulma dilakukan setiap 2 minggu
- Pemupukan susulan dilakukan pada umur 2, 4, dan 6 minggu setelah tanam

## Panen

Paria dapat dipanen pada umur 60-70 hari setelah tanam. Ciri-ciri siap panen: buah berwarna hijau tua, ukuran maksimal, dan tekstur keras.',
    (
        SELECT id
        FROM blog_categories
        WHERE
            slug = 'tanaman-sayuran'
    ),
    true,
    true,
    'Tim Ahli Pertanian'
),

-- Article 2: Hidroponik Sederhana
(
    'Cara Memulai Hidroponik Sederhana di Rumah',
    'hidroponik-sederhana-rumah',
    'Belajar cara memulai berkebun hidroponik sederhana di rumah dengan budget minimal. Panduan lengkap untuk pemula yang ingin mencoba metode tanam modern.',
    '## Apa itu Hidroponik?

Hidroponik adalah metode bercocok tanam tanpa menggunakan tanah, melainkan dengan memanfaatkan air yang berisi larutan nutrisi.

## Keuntungan Hidroponik

- Hemat air dan lahan
- Pertumbuhan tanaman lebih cepat
- Hasil panen lebih berkualitas
- Bebas dari hama tanah
- Dapat dilakukan sepanjang tahun

## Alat dan Bahan yang Dibutuhkan

### Sistem NFT (Nutrient Film Technique):
- Pipa PVC diameter 4 inch
- Pompa air kecil
- Reservoir/bak penampung
- Net pot
- Rockwool atau cocopeat
- Larutan nutrisi AB mix

## Langkah Pembuatan

### 1. Persiapan Sistem
Potong pipa PVC sesuai kebutuhan, buat lubang untuk net pot dengan jarak 15-20 cm.

### 2. Instalasi Pompa
Pasang pompa air di reservoir, hubungkan dengan pipa distribusi.

### 3. Persiapan Media Tanam
Rendam rockwool dalam air pH 5.5-6.0 selama 30 menit.

### 4. Penanaman
Semai benih di rockwool, pindahkan ke net pot setelah berkecambah.

## Tips Sukses Hidroponik

- Jaga pH air antara 5.5-6.5
- Ganti nutrisi setiap 7-10 hari
- Pastikan sirkulasi air lancar
- Monitor suhu air (18-25°C)
- Berikan pencahayaan 12-16 jam/hari',
    (
        SELECT id
        FROM blog_categories
        WHERE
            slug = 'hidroponik'
    ),
    true,
    true,
    'Pak Hidro'
),

-- Article 3: Pupuk Organik
(
    'Cara Membuat Pupuk Kompos dari Sampah Dapur',
    'pupuk-kompos-sampah-dapur',
    'Pelajari cara mengolah sampah organik dapur menjadi pupuk kompos berkualitas tinggi. Ramah lingkungan dan menghemat biaya pembelian pupuk.',
    '## Manfaat Pupuk Kompos

Pupuk kompos adalah pupuk organik yang dibuat dari penguraian bahan-bahan organik seperti sisa makanan, daun kering, dan sampah organik lainnya.

## Bahan yang Dibutuhkan

### Bahan Hijau (Nitrogen):
- Sisa sayuran dan buah
- Ampas kopi
- Daun segar
- Rumput yang baru dipotong

### Bahan Coklat (Karbon):
- Daun kering
- Kertas koran
- Sekam padi
- Serbuk gergaji

## Alat yang Dibutuhkan

- Komposter atau ember berlubang
- Sekop kecil
- Sarung tangan
- Thermometer tanah

## Cara Pembuatan

### Langkah 1: Persiapan Wadah
Siapkan komposter dengan lubang udara yang cukup untuk sirkulasi.

### Langkah 2: Layering
Buat lapisan berselang-seling:
- Lapisan pertama: bahan coklat (5 cm)
- Lapisan kedua: bahan hijau (3 cm)
- Ulangi hingga penuh

### Langkah 3: Perawatan
- Aduk setiap 2 minggu sekali
- Jaga kelembaban seperti spons yang diperas
- Suhu optimal 40-60°C

### Langkah 4: Monitoring
Kompos siap dalam 2-3 bulan, ciri-ciri:
- Berwarna coklat kehitaman
- Berbau tanah
- Tekstur gembur
- Suhu sama dengan lingkungan

## Tips Sukses

- Perbandingan bahan hijau:coklat = 1:2
- Potong bahan menjadi ukuran kecil
- Hindari daging dan produk susu
- Jaga sirkulasi udara yang baik',
    (
        SELECT id
        FROM blog_categories
        WHERE
            slug = 'pupuk-organik'
    ),
    true,
    false,
    'Bu Kompos'
),

-- Article 4: Hama dan Penyakit
(
    'Mengenali dan Mengatasi Hama Aphids pada Tanaman',
    'mengatasi-hama-aphids-tanaman',
    'Aphids adalah salah satu hama yang sering menyerang tanaman. Pelajari cara identifikasi dan pengendalian yang efektif dan ramah lingkungan.',
    '## Apa itu Aphids?

Aphids atau kutu daun adalah serangga kecil yang menghisap cairan tanaman. Mereka berukuran 1-3 mm dan dapat berwarna hijau, hitam, merah, atau putih.

## Ciri-ciri Serangan Aphids

### Gejala pada Tanaman:
- Daun mengkerut dan menguning
- Pertumbuhan tanaman terhambat
- Muncul cairan lengket (honeydew) pada daun
- Daun rontok prematur

### Identifikasi Hama:
- Koloni kecil di bagian bawah daun
- Serangga kecil bergerombol
- Meninggalkan kulit saat berganti kulit

## Faktor Penyebab

- Kelembaban tinggi
- Tanaman stress karena kekurangan air
- Pemupukan nitrogen berlebihan
- Kurangnya predator alami

## Cara Pengendalian

### 1. Pengendalian Fisik
- Semprotkan air bertekanan untuk mengusir aphids
- Buang bagian tanaman yang terserang parah
- Gunakan perangkap kuning untuk menangkap aphids bersayap

### 2. Pengendalian Biologis
- Lepaskan predator alami seperti ladybug
- Tanam tanaman pengusir seperti mint dan kemangi
- Budidayakan tanaman perangkap seperti nasturtium

### 3. Pengendalian Organik
- Semprot dengan larutan sabun insektisida
- Gunakan minyak neem
- Aplikasikan ekstrak bawang putih

## Resep Pestisida Organik

### Larutan Sabun:
- 2 sdm sabun cair + 1 liter air
- Semprotkan pada sore hari

### Ekstrak Bawang Putih:
- 100g bawang putih + 500ml air
- Blender, saring, encerkan 1:10
- Semprotkan setiap 3 hari

## Pencegahan

- Monitor tanaman secara rutin
- Jaga kelembaban yang optimal
- Berikan nutrisi seimbang
- Tanam tanaman companion yang tepat
- Jaga kebersihan area tanam',
    (
        SELECT id
        FROM blog_categories
        WHERE
            slug = 'hama-penyakit'
    ),
    true,
    false,
    'Pak Entomolog'
) ON CONFLICT (slug) DO NOTHING;