'use strict';
const BASE = 'https://data.bmkg.go.id/DataMKG/TEWS/';
const KOTA = {
  'Jakarta':[-6.2088,106.8456],'Surabaya':[-7.2575,112.7521],'Bandung':[-6.9175,107.6191],
  'Yogyakarta':[-7.7956,110.3695],'Medan':[3.5952,98.6722],'Padang':[-0.9471,100.4172],
  'Palembang':[-2.9761,104.7754],'Denpasar':[-8.6705,115.2126],'Mataram':[-8.5833,116.1167],
  'Makassar':[-5.1477,119.4327],'Palu':[-0.8917,119.8707],'Manado':[1.4748,124.8421],
  'Ambon':[-3.6954,128.1814],'Jayapura':[-2.5337,140.7181]
};
const $ = id => document.getElementById(id);
let lokasi = JSON.parse(localStorage.getItem('sk_lokasi') || 'null');
let daftar = [];
let terpilih = 0;

/* ---------- Utilitas ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function jarak(lat1, lon1, lat2, lon2) {
  const r = x => x * Math.PI / 180, R = 6371;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 +
            Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function parse(g) {
  const [lat, lon] = g.Coordinates.split(',').map(Number);
  return {
    lat, lon,
    mag: parseFloat(g.Magnitude),
    dalam: parseFloat(g.Kedalaman),
    wilayah: g.Wilayah,
    potensi: g.Potensi || '',
    waktu: `${g.Tanggal}, ${g.Jam}`,
    dirasakan: g.Dirasakan || '',
    shake: g.Shakemap ? BASE + g.Shakemap : ''
  };
}

/* Perkiraan kasar intensitas (skala MMI 1-10) dari magnitudo dan jarak hiposenter */
function perkiraanMMI(g) {
  if (!lokasi) return null;
  const km = jarak(lokasi[0], lokasi[1], g.lat, g.lon);
  const hipo = Math.max(Math.hypot(km, g.dalam), 1);
  const mmi = 1.5 * g.mag - 3.5 * Math.log10(hipo) + 3;
  return { km, mmi: Math.max(1, Math.min(10, Math.round(mmi))) };
}

function tingkat(mmi) {
  if (mmi <= 2) return {c:'lv1', t:'Tidak terasa', aksi:['Tidak perlu tindakan khusus. Tetap pantau informasi resmi BMKG.']};
  if (mmi <= 4) return {c:'lv2', t:'Terasa ringan', aksi:[
    'Tetap tenang, jangan berlari keluar bangunan.',
    'Jauhi kaca dan benda yang bisa jatuh.',
    'Periksa sekitar setelah getaran berhenti.']};
  if (mmi <= 6) return {c:'lv3', t:'Guncangan sedang', aksi:[
    'Merunduk, lindungi kepala dan leher, berpegangan pada meja yang kokoh.',
    'Jauhi jendela, lemari tinggi, dan lampu gantung.',
    'Setelah guncangan berhenti, keluar dengan tenang lewat tangga (bukan lift).',
    'Matikan kompor dan listrik jika aman, cek bau gas.',
    'Waspadai gempa susulan.']};
  return {c:'lv4', t:'Guncangan kuat, berpotensi merusak', aksi:[
    'Segera merunduk, berlindung di bawah meja kokoh, lindungi kepala.',
    'Jangan berdiri dekat kaca, dinding retak, atau tiang.',
    'Setelah berhenti, evakuasi ke lapangan terbuka, jauhi bangunan dan tiang listrik.',
    'Bawa tas siaga bencana dan ponsel; matikan listrik dan gas.',
    'Bantu orang yang rentan (anak-anak, lansia, penyandang disabilitas).',
    'Tunggu arahan BPBD, siapkan diri menghadapi gempa susulan.']};
}

/* ---------- Tampilan ---------- */
function gambarSeismograf(mmi) {
  const amp = lokasi ? 4 + mmi * 3.5 : 6;
  let p = [], y;
  for (let x = 0; x <= 600; x += 6) {
    const pusat = x > 180 && x < 420 ? Math.sin((x - 180) / 240 * Math.PI) : 0.08;
    y = 40 + (Math.random() * 2 - 1) * amp * pusat * 1.6;
    p.push(x + ',' + y.toFixed(1));
  }
  $('trace').setAttribute('points', p.join(' '));
}

function tampilkanDetail() {
  const g = daftar[terpilih];
  if (!g) { $('detail-isi').innerHTML = '<p class="muted">Data gempa belum tersedia.</p>'; return; }
  const e = perkiraanMMI(g);
  const tsunami = /berpotensi tsunami/i.test(g.potensi) && !/tidak/i.test(g.potensi);
  let html = `<div class="head"><div class="mag">M ${g.mag.toFixed(1)}</div>
    <div><strong>${esc(g.wilayah)}</strong><br><span class="muted">${esc(g.waktu)} · kedalaman ${g.dalam} km</span></div></div>`;
  html += tsunami
    ? '<div class="tsunami">Berpotensi tsunami. Jika berada di pesisir, segera menjauh ke tempat tinggi dan ikuti arahan petugas.</div>'
    : `<div class="aman">${esc(g.potensi || 'Informasi potensi tsunami tidak tersedia')}.</div>`;
  if (e) {
    const t = tingkat(e.mmi);
    html += `<p>Jarak dari lokasimu: <strong>${Math.round(e.km)} km</strong>.
      Perkiraan guncangan: <span class="badge ${t.c}">${t.t} (MMI ±${e.mmi})</span></p>
      <h3>Yang harus kamu lakukan</h3><ol class="aksi">${t.aksi.map(a => `<li>${esc(a)}</li>`).join('')}</ol>`;
    gambarSeismograf(e.mmi);
  } else {
    html += '<p class="muted">Pilih lokasimu di atas untuk melihat jarak dan saran tindakan.</p>';
    gambarSeismograf(1);
  }
  if (g.dirasakan) html += `<p><strong>Dirasakan:</strong> ${esc(g.dirasakan)}</p>`;
  if (g.shake) html += `<img class="shake" src="${esc(g.shake)}" alt="Peta guncangan (shakemap) dari BMKG" loading="lazy" onerror="this.remove()">`;
  $('detail-isi').innerHTML = html;
}

function tampilkanDaftar() {
  $('daftar').innerHTML = daftar.map((g, i) => {
    const e = perkiraanMMI(g);
    return `<li><button type="button" data-i="${i}" ${i === terpilih ? 'aria-current="true"' : ''}>
      <span class="m">${g.mag.toFixed(1)}</span>
      <span>${esc(g.wilayah)}<small>${esc(g.waktu)}${e ? ' · ' + Math.round(e.km) + ' km darimu' : ''}</small></span></button></li>`;
  }).join('');
}

function render() { tampilkanDetail(); tampilkanDaftar(); }

/* ---------- Data ---------- */
function setStatus(teks, offline) {
  const s = $('status');
  s.textContent = teks;
  s.classList.toggle('offline', !!offline);
}

async function ambil(nama) {
  const r = await fetch(BASE + nama, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function muatData() {
  try {
    const [terbaru, terkini] = await Promise.all([ambil('autogempa.json'), ambil('gempaterkini.json')]);
    const semua = [terbaru.Infogempa.gempa, ...terkini.Infogempa.gempa];
    // hindari duplikat gempa yang sama
    const unik = semua.filter((g, i) => semua.findIndex(x => x.DateTime === g.DateTime) === i);
    localStorage.setItem('sk_data', JSON.stringify({ t: Date.now(), data: unik }));
    daftar = unik.map(parse);
    setStatus('Data BMKG diperbarui ' + new Date().toLocaleTimeString('id-ID'));
  } catch (err) {
    const cache = JSON.parse(localStorage.getItem('sk_data') || 'null');
    if (cache) {
      daftar = cache.data.map(parse);
      setStatus('Mode offline: menampilkan data tersimpan (' + new Date(cache.t).toLocaleString('id-ID') + ')', true);
    } else {
      setStatus('Tidak ada koneksi dan belum ada data tersimpan.', true);
    }
  }
  if (terpilih >= daftar.length) terpilih = 0;
  render();
}

/* ---------- Lokasi ---------- */
function simpanLokasi(lat, lon, nama) {
  lokasi = [lat, lon];
  localStorage.setItem('sk_lokasi', JSON.stringify(lokasi));
  localStorage.setItem('sk_lokasi_nama', nama);
  $('lokasi-info').textContent = 'Lokasi: ' + nama;
  render();
}

function mulai() {
  Object.keys(KOTA).forEach(k => $('kota').add(new Option(k, k)));
  if (lokasi) $('lokasi-info').textContent = 'Lokasi: ' + (localStorage.getItem('sk_lokasi_nama') || 'tersimpan');

  $('kota').addEventListener('change', e => {
    const k = e.target.value;
    if (k) simpanLokasi(KOTA[k][0], KOTA[k][1], k);
  });

  $('btn-gps').addEventListener('click', () => {
    if (!navigator.geolocation) { $('lokasi-info').textContent = 'Browser tidak mendukung lokasi. Pilih kota saja.'; return; }
    $('lokasi-info').textContent = 'Mencari lokasi…';
    navigator.geolocation.getCurrentPosition(
      p => simpanLokasi(p.coords.latitude, p.coords.longitude, 'lokasi perangkat'),
      () => { $('lokasi-info').textContent = 'Izin lokasi ditolak. Pilih kota dari daftar.'; },
      { timeout: 10000 }
    );
  });

  $('daftar').addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    terpilih = Number(b.dataset.i);
    render();
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  window.addEventListener('online', muatData);
  window.addEventListener('offline', () => setStatus('Mode offline: data tersimpan ditampilkan', true));

  muatData();
  setInterval(muatData, 60000);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

mulai();
