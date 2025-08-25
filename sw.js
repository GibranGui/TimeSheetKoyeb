// sw.js (Optimized for Koyeb Free)
const CACHE_NAME = 'timesheet-cache-v3';
const urlsToCache = [
  './',
  './index.html',
  './js/tailwindcss.js',
  './css/inter-font.css',
  './css/fontawesome.min.css',
  './js/supabase.min.js',
  './js/jspdf.umd.min.js',
  './js/jspdf.plugin.autotable.min.js',
  './icon-192x192.png',
  './icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  // Hanya cache request GET dan hindari caching Supabase API
  if (event.request.method === 'GET' && !event.request.url.includes('supabase.co')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => response || fetch(event.request))
    );
  } else {
    event.respondWith(fetch(event.request));
  }
});

// Menangani pesan dari aplikasi utama
self.addEventListener('message', (event) => {
  if (event.data.type === 'REGISTER_GEOFENCE') {
    registerGeofence(event.data.geofence);
  } else if (event.data.type === 'UNREGISTER_GEOFENCE') {
    unregisterGeofence();
  }
});

// Mendaftarkan geofence
async function registerGeofence(geofence) {
  try {
    // Hapus geofence yang ada terlebih dahulu
    const registrations = await self.navigator.geofencing.getRegistrations();
    for (const registration of registrations) {
      await self.navigator.geofencing.removeRegistration(registration.id);
    }

    // Daftarkan geofence baru
    await self.navigator.geofencing.addRegistration({
      name: 'muatan-area',
      latitude: geofence.latitude,
      longitude: geofence.longitude,
      radius: geofence.radius
    });
    
    console.log('Geofence berhasil didaftarkan untuk pemantauan latar belakang');
  } catch (error) {
    console.error('Gagal mendaftarkan geofence:', error);
  }
}

// Menghapus pendaftaran geofence
async function unregisterGeofence() {
  try {
    const registrations = await self.navigator.geofencing.getRegistrations();
    for (const registration of registrations) {
      await self.navigator.geofencing.removeRegistration(registration.id);
    }
    console.log('Geofence berhasil dihapus');
  } catch (error) {
    console.error('Gagal menghapus geofence:', error);
  }
}

// Menangani event geofence
self.addEventListener('geofenceenter', (event) => {
  event.waitUntil(handleGeofenceEvent('enter', event));
});

self.addEventListener('geofenceleave', (event) => {
  event.waitUntil(handleGeofenceEvent('leave', event));
});

// Variabel untuk cooldown
let lastTriggerTime = 0;
const TRIGGER_COOLDOWN = 30000; // 30 detik

async function handleGeofenceEvent(type, event) {
  console.log(`Geofence ${type} event diterima di latar belakang`);
  
  // Kirim notifikasi ke aplikasi utama
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({
      type: `GEOFENCE_${type.toUpperCase()}`,
      timestamp: new Date().toISOString(),
      geofence: event.registration.name
    });
  }
  
  // Jika keluar area, catat ritase (dengan cooldown)
  if (type === 'leave') {
    const currentTime = Date.now();
    if (currentTime - lastTriggerTime > TRIGGER_COOLDOWN) {
      // Simpan data ritase untuk disinkronkan nanti
      const ritaseData = {
        type: 'auto_ritase',
        timestamp: new Date().toISOString(),
        geofence: event.registration.name
      };
      
      // Simpan di IndexedDB untuk sinkronisasi nanti
      await saveBackgroundRitase(ritaseData);
      lastTriggerTime = currentTime;
      
      // Tampilkan notifikasi
      self.registration.showNotification('Auto-Ritase', {
        body: 'Ritase tercatat otomatis saat meninggalkan area muatan.',
        icon: './icon-192x192.png',
        tag: 'ritase-notification'
      });
    }
  }
}

// Menyimpan ritase latar belakang
async function saveBackgroundRitase(ritaseData) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['backgroundRitase'], 'readwrite');
    const store = transaction.objectStore('backgroundRitase');
    await store.add(ritaseData);
  } catch (error) {
    console.error('Gagal menyimpan ritase latar belakang:', error);
  }
}

// Membuka koneksi database
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('LaporanKerjaDB_v10_Offline', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('backgroundRitase')) {
        db.createObjectStore('backgroundRitase', { autoIncrement: true });
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}
