import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendEmailVerification,
    reload
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
    increment
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* FIREBASE AYARLARI */
const firebaseConfig = {
    apiKey: "AIzaSyB8-SxAyXCyFw1lt6-EuktXJY6zXhmliwI",
    authDomain: "bordroai.firebaseapp.com",
    projectId: "bordroai",
    storageBucket: "bordroai.firebasestorage.app",
    messagingSenderId: "339688158624",
    appId: "1:339688158624:web:828709cea8cefde6a7a0c5",
    measurementId: "G-CKML9SDKVP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let aktifKullanici = null;
let sonAnaliz = null;

/* PDF WORKER */
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

/* SERVICE WORKER */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/sw.js")
            .then(() => console.log("BordroAI service worker aktif."))
            .catch(error => console.log("Service worker hatası:", error));
    });
}

/* SPLASH */
window.addEventListener("load", () => {
    const splash = document.getElementById("splash-screen");

    setTimeout(() => {
        if (splash) {
            splash.classList.add("splash-hidden");
        }
    }, 1400);
});

/* PANEL GEÇİŞİ */
window.tabGoster = function (panel) {
    const girisPanel = document.getElementById("giris-panel");
    const kayitPanel = document.getElementById("kayit-panel");
    const tabGirisBtn = document.getElementById("tabGirisBtn");
    const tabKayitBtn = document.getElementById("tabKayitBtn");
    const authMesaj = document.getElementById("authMesaj");

    if (authMesaj) {
        authMesaj.innerText = "";
        authMesaj.className = "message";
    }

    if (panel === "giris") {
        if (girisPanel) girisPanel.classList.remove("hidden");
        if (kayitPanel) kayitPanel.classList.add("hidden");
        if (tabGirisBtn) tabGirisBtn.classList.add("active");
        if (tabKayitBtn) tabKayitBtn.classList.remove("active");
    } else {
        if (girisPanel) girisPanel.classList.add("hidden");
        if (kayitPanel) kayitPanel.classList.remove("hidden");
        if (tabGirisBtn) tabGirisBtn.classList.remove("active");
        if (tabKayitBtn) tabKayitBtn.classList.add("active");
    }
};

function mesajYaz(metin, tip = "") {
    const authMesaj = document.getElementById("authMesaj");
    if (!authMesaj) return;

    authMesaj.innerText = metin;
    authMesaj.className = "message";

    if (tip) {
        authMesaj.classList.add(tip);
    }
}

function durumYaz(metin) {
    const durum = document.getElementById("durumMesaji");
    if (durum) {
        durum.innerText = metin;
    }
}

/* KAYIT OL */
window.kayitOl = async function () {
    const adSoyadInput = document.getElementById("kayitAdSoyad");
    const emailInput = document.getElementById("kayitEmail");
    const sifreInput = document.getElementById("kayitSifre");

    const adSoyad = adSoyadInput.value.trim();
    const email = emailInput.value.trim();
    const sifre = sifreInput.value.trim();

    if (!adSoyad || !email || !sifre) {
        mesajYaz("Lütfen tüm alanları doldur.", "error");
        return;
    }

    if (sifre.length < 6) {
        mesajYaz("Şifre en az 6 karakter olmalı.", "error");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, sifre);
        const user = userCredential.user;

        await updateProfile(user, {
            displayName: adSoyad
        });

        await sendEmailVerification(user);

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            adSoyad: adSoyad,
            email: email,
            emailVerified: false,
            analizSayisi: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });

        await setDoc(doc(db, "istatistikler", "genel"), {
            toplamKullanici: increment(1),
            updatedAt: serverTimestamp()
        }, { merge: true });

        await signOut(auth);

        adSoyadInput.value = "";
        emailInput.value = "";
        sifreInput.value = "";

        window.tabGoster("giris");

        mesajYaz(
            "Kayıt başarılı. Doğrulama maili gönderildi. Spam / Gereksiz / Tanıtımlar klasörünü de kontrol et.",
            "success"
        );

    } catch (error) {
        console.error("Kayıt hatası:", error);

        if (error.code === "auth/email-already-in-use") {
            mesajYaz("Bu e-posta adresi zaten kayıtlı. Giriş yapmayı dene.", "error");
        } else if (error.code === "auth/invalid-email") {
            mesajYaz("Geçerli bir e-posta adresi gir.", "error");
        } else if (error.code === "auth/weak-password") {
            mesajYaz("Şifre çok zayıf. En az 6 karakter kullan.", "error");
        } else if (error.code === "auth/too-many-requests") {
            mesajYaz("Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.", "error");
        } else {
            mesajYaz("Kayıt sırasında hata oluştu: " + error.message, "error");
        }
    }
};

/* GİRİŞ YAP */
window.girisYap = async function () {
    const email = document.getElementById("girisEmail").value.trim();
    const sifre = document.getElementById("girisSifre").value.trim();

    if (!email || !sifre) {
        mesajYaz("Lütfen e-posta ve şifre gir.", "error");
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, sifre);
        const user = userCredential.user;

        await reload(user);

        if (!user.emailVerified) {
            try {
                await sendEmailVerification(user);
            } catch (mailError) {
                console.log("Doğrulama maili tekrar gönderilemedi:", mailError);
            }

            await signOut(auth);

            mesajYaz(
                "E-posta adresin doğrulanmamış. Sana tekrar doğrulama maili gönderdik. Mailini doğrulayıp tekrar giriş yap.",
                "error"
            );
            return;
        }

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            adSoyad: user.displayName || "",
            email: user.email,
            emailVerified: true,
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });

        mesajYaz("Giriş başarılı.", "success");

    } catch (error) {
        console.error("Giriş hatası:", error);

        if (
            error.code === "auth/wrong-password" ||
            error.code === "auth/user-not-found" ||
            error.code === "auth/invalid-credential"
        ) {
            mesajYaz("E-posta veya şifre hatalı.", "error");
        } else if (error.code === "auth/invalid-email") {
            mesajYaz("Geçerli bir e-posta adresi gir.", "error");
        } else {
            mesajYaz("Giriş sırasında hata oluştu: " + error.message, "error");
        }
    }
};

/* ÇIKIŞ */
window.cikisYap = async function () {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Çıkış hatası:", error);
        alert("Çıkış yapılırken hata oluştu.");
    }
};

/* OTURUM TAKİBİ */
onAuthStateChanged(auth, async user => {
    const authContainer = document.getElementById("auth-container");
    const appContainer = document.getElementById("app-container");

    if (user) {
        await reload(user);

        if (!user.emailVerified) {
            aktifKullanici = null;

            if (authContainer) authContainer.classList.remove("hidden");
            if (appContainer) appContainer.classList.add("hidden");

            return;
        }

        aktifKullanici = user;

        if (authContainer) authContainer.classList.add("hidden");
        if (appContainer) appContainer.classList.remove("hidden");

        await kullaniciPaneliniYukle();
        await window.gecmisAnalizleriYukle();

    } else {
        aktifKullanici = null;
        sonAnaliz = null;

        if (authContainer) authContainer.classList.remove("hidden");
        if (appContainer) appContainer.classList.add("hidden");
    }
});

/* KULLANICI PANELİ */
async function kullaniciPaneliniYukle() {
    if (!aktifKullanici) return;

    const kullaniciAdi = document.getElementById("kullaniciAdi");
    const panelAdSoyad = document.getElementById("panelAdSoyad");
    const panelEmail = document.getElementById("panelEmail");
    const panelDogrulama = document.getElementById("panelDogrulama");
    const panelAnalizSayisi = document.getElementById("panelAnalizSayisi");

    let kullaniciData = {};

    try {
        const userRef = doc(db, "users", aktifKullanici.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            kullaniciData = userSnap.data();
        } else {
            await setDoc(userRef, {
                uid: aktifKullanici.uid,
                adSoyad: aktifKullanici.displayName || "",
                email: aktifKullanici.email,
                emailVerified: aktifKullanici.emailVerified,
                analizSayisi: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });

            kullaniciData = {
                adSoyad: aktifKullanici.displayName || "",
                email: aktifKullanici.email,
                analizSayisi: 0
            };
        }

    } catch (error) {
        console.error("Kullanıcı paneli hatası:", error);
    }

    const adSoyad = kullaniciData.adSoyad || aktifKullanici.displayName || "Kullanıcı";
    const email = kullaniciData.email || aktifKullanici.email || "-";
    const analizSayisi = kullaniciData.analizSayisi || 0;

    if (kullaniciAdi) kullaniciAdi.innerText = adSoyad;
    if (panelAdSoyad) panelAdSoyad.innerText = adSoyad;
    if (panelEmail) panelEmail.innerText = email;
    if (panelDogrulama) panelDogrulama.innerText = aktifKullanici.emailVerified ? "Doğrulandı" : "Bekliyor";
    if (panelAnalizSayisi) panelAnalizSayisi.innerText = analizSayisi;

    await istatistikleriYukle();
}

/* GENEL İSTATİSTİKLER */
async function istatistikleriYukle() {
    const toplamKullanici = document.getElementById("toplamKullanici");
    const toplamAnaliz = document.getElementById("toplamAnaliz");

    try {
        const statsRef = doc(db, "istatistikler", "genel");
        const statsSnap = await getDoc(statsRef);

        if (statsSnap.exists()) {
            const data = statsSnap.data();

            if (toplamKullanici) toplamKullanici.innerText = data.toplamKullanici || 0;
            if (toplamAnaliz) toplamAnaliz.innerText = data.toplamAnaliz || 0;
        } else {
            await setDoc(statsRef, {
                toplamKullanici: 0,
                toplamAnaliz: 0,
                updatedAt: serverTimestamp()
            }, { merge: true });

            if (toplamKullanici) toplamKullanici.innerText = 0;
            if (toplamAnaliz) toplamAnaliz.innerText = 0;
        }

    } catch (error) {
        console.error("İstatistik okuma hatası:", error);

        if (toplamKullanici) toplamKullanici.innerText = "-";
        if (toplamAnaliz) toplamAnaliz.innerText = "-";
    }
}

/* DOSYA SEÇ VE ANALİZ ET */
window.dosyaSec = async function () {
    if (!aktifKullanici) {
        alert("Analiz yapmak için giriş yapmalısın.");
        return;
    }

    const input = document.getElementById("pdfSec");
    const dosya = input.files[0];

    if (!dosya) {
        alert("Lütfen bir bordro dosyası seç.");
        return;
    }

    const dosyaAdi = dosya.name.toLowerCase();

    if (
        !dosyaAdi.endsWith(".pdf") &&
        !dosyaAdi.endsWith(".jpg") &&
        !dosyaAdi.endsWith(".jpeg") &&
        !dosyaAdi.endsWith(".png")
    ) {
        alert("Sadece PDF, JPG veya PNG dosyası yükleyebilirsin.");
        return;
    }

    window.temizle(false);

    try {
        let metin = "";

        if (dosyaAdi.endsWith(".pdf")) {
            durumYaz("PDF okunuyor, lütfen bekle...");
            metin = await pdfOku(dosya);

            if (!metin || metin.trim().length < 30) {
                durumYaz("PDF görsel gibi duruyor. OCR ile okunuyor, bu biraz sürebilir...");
                metin = await pdfOcrOku(dosya);
            }

        } else {
            durumYaz("Görsel OCR ile okunuyor, lütfen bekle...");
            metin = await gorselOku(dosya);
        }

        if (!metin || metin.trim().length < 10) {
            durumYaz("Dosya okundu ama yeterli metin bulunamadı.");
            return;
        }

        sonAnaliz = analizEt(metin, dosya.name);

        sonucuGoster(sonAnaliz);

        durumYaz("Analiz tamamlandı. Sonuç hesabına kaydediliyor...");

        await analiziKaydet(sonAnaliz, metin);

        durumYaz("Analiz tamamlandı ve hesabına kaydedildi.");

        await kullaniciPaneliniYukle();
        await window.gecmisAnalizleriYukle();

    } catch (error) {
        console.error("Analiz hatası:", error);
        durumYaz("Analiz sırasında hata oluştu: " + error.message);
    }
};

/* PDF METİN OKUMA */
async function pdfOku(dosya) {
    const arrayBuffer = await dosya.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let tumMetin = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        const pageText = content.items
            .map(item => item.str)
            .join(" ");

        tumMetin += "\n" + pageText;
    }

    return tumMetin;
}

/* PDF OCR OKUMA */
async function pdfOcrOku(dosya) {
    const arrayBuffer = await dosya.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let tumMetin = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        durumYaz(`PDF OCR okunuyor... Sayfa ${i}/${pdf.numPages}`);

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.6 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const result = await Tesseract.recognize(canvas, "tur+eng");

        tumMetin += "\n" + result.data.text;
    }

    return tumMetin;
}

/* GÖRSEL OCR */
async function gorselOku(dosya) {
    const result = await Tesseract.recognize(dosya, "tur+eng");
    return result.data.text;
}

/* ANALİZ MOTORU */
function analizEt(metin, dosyaAdi) {
    const temizMetin = metin
        .replace(/\s+/g, " ")
        .replace(/₺/g, "TL")
        .trim();

    const netMaas = kalemBul(temizMetin, [
        /net\s*ödenen\s*tutar[^\d]{0,60}([\d.\s]+,\d{2})/i,
        /net\s*ödenecek\s*tutar[^\d]{0,60}([\d.\s]+,\d{2})/i,
        /ödenecek\s*net[^\d]{0,60}([\d.\s]+,\d{2})/i,
        /net\s*maaş[^\d]{0,60}([\d.\s]+,\d{2})/i,
        /net\s*ücret[^\d]{0,60}([\d.\s]+,\d{2})/i,
        /net[^\d]{0,40}([\d.\s]+,\d{2})/i
    ]);

    const brutUcret = kalemBul(temizMetin, [
        /brüt\s*ücret[^\d]{0,60}([\d.\s]+,\d{2})/i,
        /brüt\s*maaş[^\d]{0,60}([\d.\s]+,\d{2})/i,
        /brut\s*ücret[^\d]{0,60}([\d.\s]+,\d{2})/i,
        /brut\s*maaş[^\d]{0,60}([\d.\s]+,\d{2})/i,
        /brüt[^\d]{0,40}([\d.\s]+,\d{2})/i,
        /brut[^\d]{0,40}([\d.\s]+,\d{2})/i
    ]);

    const toplamKesinti = kalemBul(temizMetin, [
        /toplam\s*kesinti[^\d]{0,60}([\d.\s]+,\d{2})/i,
        /kesintiler\s*toplamı[^\d]{0,60}([\d.\s]+,\d{2})/i,
        /kesinti\s*toplamı[^\d]{0,60}([\d.\s]+,\d{2})/i
    ]);

    const sgkKesintisi = kalemBul(temizMetin, [
        /sgk\s*işçi[^\d]{0,60}([\d.\s]+,\d{2})/i,
        /sgk\s*primi[^\d]{0,60}([\d.\s]+,\d{2})/i,
        /sosyal\s*güvenlik[^\d]{0,60}([\d.\s]+,\d{2})/i
    ]);

    const gelirVergisi = kalemBul(temizMetin, [
        /gelir\s*vergisi[^\d]{0,60}([\d.\s]+,\d{2})/i
    ]);

    const damgaVergisi = kalemBul(temizMetin, [
        /damga\s*vergisi[^\d]{0,60}([\d.\s]+,\d{2})/i
    ]);

    const tumParalar = paraListesiBul(temizMetin);

    let tahminiNet = netMaas;

    if (!tahminiNet && tumParalar.length > 0) {
        tahminiNet = enMantikliNetTahmin(tumParalar);
    }

    let ozet = "Bordro okundu.";

    if (netMaas) {
        ozet = `Net ödeme ${netMaas} TL olarak bulundu.`;
    } else if (tahminiNet) {
        ozet = `Net ödeme alanı direkt yakalanamadı. Tahmini net tutar ${tahminiNet} TL olabilir.`;
    } else if (tumParalar.length > 0) {
        ozet = "Bordro okundu fakat net ödeme alanı net yakalanamadı. Bulunan tutarlar listelendi.";
    } else {
        ozet = "Bordro okundu fakat otomatik tutar yakalanamadı.";
    }

    return {
        dosyaAdi,
        ozet,
        netMaas: tahminiNet || "-",
        brutUcret: brutUcret || "-",
        toplamKesinti: toplamKesinti || "-",
        sgkKesintisi: sgkKesintisi || "-",
        gelirVergisi: gelirVergisi || "-",
        damgaVergisi: damgaVergisi || "-",
        bulunanTutarlar: tumParalar.slice(0, 10),
        createdAtLocal: new Date().toLocaleString("tr-TR")
    };
}

function kalemBul(metin, kaliplar) {
    for (const kalip of kaliplar) {
        const eslesme = metin.match(kalip);

        if (eslesme && eslesme[1]) {
            return eslesme[1].replace(/\s/g, "");
        }
    }

    return "";
}

function paraListesiBul(metin) {
    const eslesmeler = metin.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || [];
    return [...new Set(eslesmeler)];
}

function enMantikliNetTahmin(tutarlar) {
    const sayilar = tutarlar
        .map(tutar => {
            const sayi = Number(
                tutar
                    .replace(/\./g, "")
                    .replace(",", ".")
            );

            return {
                orijinal: tutar,
                sayi
            };
        })
        .filter(item => !isNaN(item.sayi) && item.sayi > 0);

    if (!sayilar.length) return "";

    const mantikli = sayilar
        .filter(item => item.sayi >= 5000 && item.sayi <= 250000)
        .sort((a, b) => b.sayi - a.sayi);

    if (mantikli.length) {
        return mantikli[0].orijinal;
    }

    return sayilar.sort((a, b) => b.sayi - a.sayi)[0].orijinal;
}

/* SONUÇ GÖSTER */
function sonucuGoster(analiz) {
    const sonucKart = document.getElementById("sonucKart");
    const sonuc = document.getElementById("sonuc");

    if (!sonucKart || !sonuc) return;

    sonucKart.classList.remove("hidden");

    sonuc.innerHTML = `
        <div class="result-box">
            <p><strong>${guvenliYazi(analiz.ozet)}</strong></p>

            <div class="result-line">
                <span>Dosya</span>
                <strong>${guvenliYazi(analiz.dosyaAdi)}</strong>
            </div>

            <div class="result-line">
                <span>Net Maaş</span>
                <strong>${tutarYaz(analiz.netMaas)}</strong>
            </div>

            <div class="result-line">
                <span>Brüt Ücret</span>
                <strong>${tutarYaz(analiz.brutUcret)}</strong>
            </div>

            <div class="result-line">
                <span>Toplam Kesinti</span>
                <strong>${tutarYaz(analiz.toplamKesinti)}</strong>
            </div>

            <div class="result-line">
                <span>SGK Kesintisi</span>
                <strong>${tutarYaz(analiz.sgkKesintisi)}</strong>
            </div>

            <div class="result-line">
                <span>Gelir Vergisi</span>
                <strong>${tutarYaz(analiz.gelirVergisi)}</strong>
            </div>

            <div class="result-line">
                <span>Damga Vergisi</span>
                <strong>${tutarYaz(analiz.damgaVergisi)}</strong>
            </div>
        </div>

        <div class="result-box">
            <p><strong>Bulunan İlk Tutarlar</strong></p>
            <p>${analiz.bulunanTutarlar.length ? analiz.bulunanTutarlar.map(tutar => guvenliYazi(tutar + " TL")).join("<br>") : "Tutar bulunamadı."}</p>
        </div>
    `;
}

function tutarYaz(deger) {
    if (!deger || deger === "-") {
        return "-";
    }

    return guvenliYazi(deger + " TL");
}

/* ANALİZİ KAYDET */
async function analiziKaydet(analiz, hamMetin) {
    if (!aktifKullanici) return;

    await addDoc(collection(db, "analizler"), {
        uid: aktifKullanici.uid,
        email: aktifKullanici.email,
        dosyaAdi: analiz.dosyaAdi,
        ozet: analiz.ozet,
        netMaas: analiz.netMaas,
        brutUcret: analiz.brutUcret,
        toplamKesinti: analiz.toplamKesinti,
        sgkKesintisi: analiz.sgkKesintisi,
        gelirVergisi: analiz.gelirVergisi,
        damgaVergisi: analiz.damgaVergisi,
        bulunanTutarlar: analiz.bulunanTutarlar,
        hamMetinKisa: hamMetin.slice(0, 2500),
        createdAt: serverTimestamp()
    });

    await setDoc(doc(db, "users", aktifKullanici.uid), {
        analizSayisi: increment(1),
        updatedAt: serverTimestamp()
    }, { merge: true });

    await setDoc(doc(db, "istatistikler", "genel"), {
        toplamAnaliz: increment(1),
        updatedAt: serverTimestamp()
    }, { merge: true });
}

/* GEÇMİŞ ANALİZLER */
window.gecmisAnalizleriYukle = async function () {
    const gecmisListe = document.getElementById("gecmisListe");
    const panelAnalizSayisi = document.getElementById("panelAnalizSayisi");

    if (!gecmisListe || !aktifKullanici) return;

    gecmisListe.innerHTML = `<p class="empty-text">Geçmiş analizler yükleniyor...</p>`;

    try {
        const q = query(
            collection(db, "analizler"),
            where("uid", "==", aktifKullanici.uid)
        );

        const snapshot = await getDocs(q);

        if (panelAnalizSayisi) {
            panelAnalizSayisi.innerText = snapshot.size;
        }

        await setDoc(doc(db, "users", aktifKullanici.uid), {
            analizSayisi: snapshot.size,
            updatedAt: serverTimestamp()
        }, { merge: true });

        if (snapshot.empty) {
            gecmisListe.innerHTML = `<p class="empty-text">Henüz analiz bulunmuyor.</p>`;
            return;
        }

        const analizler = [];

        snapshot.forEach(docSnap => {
            analizler.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        analizler.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime;
        });

        gecmisListe.innerHTML = analizler.slice(0, 10).map(analiz => {
            const tarih = analiz.createdAt?.toDate
                ? analiz.createdAt.toDate().toLocaleString("tr-TR")
                : "-";

            return `
                <div class="history-item">
                    <strong>${guvenliYazi(analiz.dosyaAdi || "Bordro Analizi")}</strong>
                    <small>${guvenliYazi(tarih)}</small>
                    <p>${guvenliYazi(analiz.ozet || "Analiz tamamlandı.")}</p>
                    <small>Net Maaş: ${tutarYaz(analiz.netMaas || "-")}</small>
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Geçmiş analiz hatası:", error);
        gecmisListe.innerHTML = `<p class="empty-text">Geçmiş analizler yüklenemedi: ${guvenliYazi(error.message)}</p>`;
    }
};

/* PDF RAPOR */
window.raporIndir = function () {
    if (!sonAnaliz) {
        alert("Önce bir bordro analizi yapmalısın.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text("BordroAI Analiz Raporu", 15, 20);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    let y = 38;

    const satirlar = [
        ["Dosya", sonAnaliz.dosyaAdi],
        ["Tarih", sonAnaliz.createdAtLocal],
        ["Ozet", sonAnaliz.ozet],
        ["Net Maas", sonAnaliz.netMaas + " TL"],
        ["Brut Ucret", sonAnaliz.brutUcret + " TL"],
        ["Toplam Kesinti", sonAnaliz.toplamKesinti + " TL"],
        ["SGK Kesintisi", sonAnaliz.sgkKesintisi + " TL"],
        ["Gelir Vergisi", sonAnaliz.gelirVergisi + " TL"],
        ["Damga Vergisi", sonAnaliz.damgaVergisi + " TL"]
    ];

    satirlar.forEach(([baslik, deger]) => {
        pdf.setFont("helvetica", "bold");
        pdf.text(baslik + ":", 15, y);

        pdf.setFont("helvetica", "normal");
        const parcalar = pdf.splitTextToSize(String(deger), 125);
        pdf.text(parcalar, 65, y);

        y += parcalar.length * 7 + 3;
    });

    y += 8;

    pdf.setFont("helvetica", "bold");
    pdf.text("Bulunan Tutarlar:", 15, y);

    y += 8;

    pdf.setFont("helvetica", "normal");

    if (sonAnaliz.bulunanTutarlar.length) {
        sonAnaliz.bulunanTutarlar.forEach(tutar => {
            pdf.text("- " + tutar + " TL", 20, y);
            y += 7;
        });
    } else {
        pdf.text("Tutar bulunamadi.", 20, y);
    }

    pdf.save("BordroAI-Rapor.pdf");
};

/* TEMİZLE */
window.temizle = function (inputuTemizle = true) {
    const sonucKart = document.getElementById("sonucKart");
    const sonuc = document.getElementById("sonuc");
    const durum = document.getElementById("durumMesaji");
    const input = document.getElementById("pdfSec");

    if (sonucKart) sonucKart.classList.add("hidden");
    if (sonuc) sonuc.innerHTML = "";
    if (durum) durum.innerText = "";

    if (inputuTemizle && input) {
        input.value = "";
    }

    sonAnaliz = null;
};

/* GÜVENLİ YAZI */
function guvenliYazi(deger) {
    return String(deger ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}