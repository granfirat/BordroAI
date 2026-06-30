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
        const viewport = page.getViewport({ scale: 1.8 });

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

/* GÜÇLENDİRİLMİŞ ANALİZ MOTORU */
function analizEt(metin, dosyaAdi) {
    const satirlar = metin
        .split(/\r?\n/)
        .map(satir => satir.replace(/\s+/g, " ").trim())
        .filter(satir => satir.length > 0);

    const temizMetin = metin
        .replace(/₺/g, " TL ")
        .replace(/\s+/g, " ")
        .trim();

    const bulunanTutarlar = paraListesiBul(temizMetin);

    const netMaas = alanBul(temizMetin, satirlar, [
        "net ödenen tutar",
        "net odenen tutar",
        "net ödenecek tutar",
        "net odenecek tutar",
        "ödenecek net",
        "odenecek net",
        "ödenecek tutar",
        "odenecek tutar",
        "ödenen tutar",
        "odenen tutar",
        "net ödeme",
        "net odeme",
        "net maaş",
        "net maas",
        "net ücret",
        "net ucret",
        "banka ödeme",
        "banka odeme",
        "banka net",
        "hesaba yatan",
        "ele geçen",
        "ele gecen"
    ], "largest");

    const brutUcret = alanBul(temizMetin, satirlar, [
        "brüt ücret",
        "brut ucret",
        "brüt maaş",
        "brut maas",
        "brüt kazanç",
        "brut kazanc",
        "toplam brüt",
        "toplam brut",
        "aylık ücret",
        "aylik ucret",
        "normal ücret",
        "normal ucret",
        "normal kazanç",
        "normal kazanc",
        "esas kazanç",
        "esas kazanc",
        "prime esas kazanç",
        "prime esas kazanc",
        "sgk matrahı",
        "sgk matrahi"
    ], "largest");

    const toplamKazanc = alanBul(temizMetin, satirlar, [
        "toplam kazanç",
        "toplam kazanc",
        "kazançlar toplamı",
        "kazanclar toplami",
        "brüt kazanç toplamı",
        "brut kazanc toplami",
        "hakediş toplamı",
        "hakedis toplami",
        "ödeme toplamı",
        "odeme toplami"
    ], "largest");

    const toplamKesinti = alanBul(temizMetin, satirlar, [
        "toplam kesinti",
        "kesinti toplamı",
        "kesinti toplami",
        "kesintiler toplamı",
        "kesintiler toplami",
        "yasal kesinti",
        "yasal kesintiler",
        "toplam yasal kesinti",
        "kesilen toplam"
    ], "largest");

    const sgkKesintisi = alanBul(temizMetin, satirlar, [
        "sgk işçi",
        "sgk isci",
        "sgk primi işçi",
        "sgk primi isci",
        "sgk işçi payı",
        "sgk isci payi",
        "sigorta primi işçi",
        "sigorta primi isci",
        "sosyal güvenlik",
        "sosyal guvenlik",
        "malullük yaşlılık ölüm",
        "malulluk yaslilik olum",
        "malullük",
        "malulluk"
    ], "last");

    const issizlikKesintisi = alanBul(temizMetin, satirlar, [
        "işsizlik işçi",
        "issizlik isci",
        "işsizlik sigortası işçi",
        "issizlik sigortasi isci",
        "işsizlik primi",
        "issizlik primi"
    ], "last");

    const gelirVergisi = alanBul(temizMetin, satirlar, [
        "gelir vergisi",
        "gelir vergisi kesintisi",
        "gv kesintisi",
        "gelir vergisi tutarı",
        "gelir vergisi tutari",
        "hesaplanan gelir vergisi",
        "ödenecek gelir vergisi",
        "odenecek gelir vergisi"
    ], "last");

    const damgaVergisi = alanBul(temizMetin, satirlar, [
        "damga vergisi",
        "damga vergisi kesintisi",
        "dv kesintisi",
        "damga vergisi tutarı",
        "damga vergisi tutari"
    ], "last");

    const agi = alanBul(temizMetin, satirlar, [
        "agi",
        "asgari geçim indirimi",
        "asgari gecim indirimi"
    ], "last");

    const fazlaMesai = alanBul(temizMetin, satirlar, [
        "fazla mesai",
        "mesai ücreti",
        "mesai ucreti",
        "fazla çalışma",
        "fazla calisma",
        "resmi tatil",
        "bayram mesaisi",
        "hafta tatili"
    ], "largest");

    const primIkramiye = alanBul(temizMetin, satirlar, [
        "prim",
        "ikramiye",
        "performans",
        "ek ödeme",
        "ek odeme",
        "bonus"
    ], "largest");

    const yolYardimi = alanBul(temizMetin, satirlar, [
        "yol yardımı",
        "yol yardimi",
        "yol ücreti",
        "yol ucreti",
        "ulaşım",
        "ulasim"
    ], "largest");

    const yemekYardimi = alanBul(temizMetin, satirlar, [
        "yemek yardımı",
        "yemek yardimi",
        "yemek ücreti",
        "yemek ucreti"
    ], "largest");

    let finalNet = netMaas;
    let finalBrut = brutUcret || toplamKazanc;

    if (!finalNet) {
        finalNet = tahminiNetBul(bulunanTutarlar, finalBrut);
    }

    if (!finalBrut) {
        finalBrut = tahminiBrutBul(bulunanTutarlar, finalNet);
    }

    const tahminiToplamKesinti = toplamKesinti || kesintiToplamiTahminEt([
        sgkKesintisi,
        issizlikKesintisi,
        gelirVergisi,
        damgaVergisi
    ]);

    let ozet = "Bordro okundu.";

    if (netMaas) {
        ozet = `Net ödeme ${netMaas} TL olarak bulundu.`;
    } else if (finalNet) {
        ozet = `Net ödeme alanı direkt yakalanamadı. Tahmini net tutar ${finalNet} TL olabilir.`;
    } else {
        ozet = "Bordro okundu fakat net ödeme alanı yakalanamadı.";
    }

    return {
        dosyaAdi,
        ozet,
        netMaas: finalNet || "-",
        brutUcret: finalBrut || "-",
        toplamKesinti: tahminiToplamKesinti || "-",
        sgkKesintisi: sgkKesintisi || "-",
        issizlikKesintisi: issizlikKesintisi || "-",
        gelirVergisi: gelirVergisi || "-",
        damgaVergisi: damgaVergisi || "-",
        agi: agi || "-",
        fazlaMesai: fazlaMesai || "-",
        primIkramiye: primIkramiye || "-",
        yolYardimi: yolYardimi || "-",
        yemekYardimi: yemekYardimi || "-",
        bulunanTutarlar: bulunanTutarlar.slice(0, 12),
        createdAtLocal: new Date().toLocaleString("tr-TR")
    };
}

/* ALAN BULMA MOTORU */
function alanBul(tamMetin, satirlar, etiketler, secim = "last") {
    const normalEtiketler = etiketler.map(etiket => normalizeAra(etiket));

    for (let i = 0; i < satirlar.length; i++) {
        const satir = satirlar[i];
        const normalSatir = normalizeAra(satir);

        const eslesti = normalEtiketler.some(etiket => normalSatir.includes(etiket));

        if (eslesti) {
            let paralar = paraListesiBul(satir);

            if (paralar.length === 0 && satirlar[i + 1]) {
                paralar = paralar.concat(paraListesiBul(satirlar[i + 1]));
            }

            if (paralar.length === 0 && satirlar[i + 2]) {
                paralar = paralar.concat(paraListesiBul(satirlar[i + 2]));
            }

            paralar = benzersizParalar(paralar);

            if (paralar.length > 0) {
                return paraSec(paralar, secim);
            }
        }
    }

    const normalTamMetin = normalizeAra(tamMetin);

    for (const etiket of normalEtiketler) {
        const index = normalTamMetin.indexOf(etiket);

        if (index !== -1) {
            const parca = normalTamMetin.slice(index, index + 260);
            const paralar = paraListesiBul(parca);

            if (paralar.length > 0) {
                return paraSec(paralar, secim);
            }
        }
    }

    return "";
}

function paraSec(paralar, secim) {
    const temizler = benzersizParalar(paralar);

    if (temizler.length === 0) return "";

    if (secim === "largest") {
        return temizler
            .map(tutar => ({ tutar, sayi: paraSayiyaCevir(tutar) }))
            .filter(item => !isNaN(item.sayi))
            .sort((a, b) => b.sayi - a.sayi)[0].tutar;
    }

    if (secim === "smallest") {
        return temizler
            .map(tutar => ({ tutar, sayi: paraSayiyaCevir(tutar) }))
            .filter(item => !isNaN(item.sayi) && item.sayi > 0)
            .sort((a, b) => a.sayi - b.sayi)[0]?.tutar || "";
    }

    return temizler[temizler.length - 1];
}

function paraListesiBul(metin) {
    const eslesmeler = String(metin).match(/\d{1,3}(?:[.\s]\d{3})*,\d{2}/g) || [];

    return benzersizParalar(
        eslesmeler.map(tutar => tutar.replace(/\s/g, ""))
    );
}

function benzersizParalar(paralar) {
    return [...new Set(
        paralar
            .map(tutar => String(tutar).replace(/\s/g, "").trim())
            .filter(Boolean)
    )];
}

function paraSayiyaCevir(tutar) {
    if (!tutar || tutar === "-") return NaN;

    return Number(
        String(tutar)
            .replace(/\./g, "")
            .replace(",", ".")
            .replace(/[^\d.]/g, "")
    );
}

function paraFormatla(sayi) {
    if (isNaN(sayi)) return "";

    return sayi.toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function normalizeAra(metin) {
    return String(metin)
        .toLocaleLowerCase("tr-TR")
        .replace(/ç/g, "c")
        .replace(/ğ/g, "g")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ş/g, "s")
        .replace(/ü/g, "u")
        .replace(/â/g, "a")
        .replace(/î/g, "i")
        .replace(/û/g, "u")
        .replace(/\s+/g, " ")
        .trim();
}

function tahminiNetBul(tutarlar, brut) {
    if (!tutarlar || tutarlar.length === 0) return "";

    const brutSayi = paraSayiyaCevir(brut);

    const sayilar = tutarlar
        .map(tutar => ({ tutar, sayi: paraSayiyaCevir(tutar) }))
        .filter(item => !isNaN(item.sayi) && item.sayi >= 1000);

    if (sayilar.length === 0) return "";

    if (!isNaN(brutSayi) && brutSayi > 0) {
        const bruttenBuyukler = sayilar
            .filter(item => item.sayi >= brutSayi * 0.35 && item.sayi <= brutSayi * 2.5)
            .sort((a, b) => b.sayi - a.sayi);

        if (bruttenBuyukler.length > 0) {
            return bruttenBuyukler[0].tutar;
        }
    }

    return sayilar.sort((a, b) => b.sayi - a.sayi)[0].tutar;
}

function tahminiBrutBul(tutarlar, net) {
    if (!tutarlar || tutarlar.length === 0) return "";

    const netSayi = paraSayiyaCevir(net);

    const sayilar = tutarlar
        .map(tutar => ({ tutar, sayi: paraSayiyaCevir(tutar) }))
        .filter(item => !isNaN(item.sayi) && item.sayi >= 1000);

    if (sayilar.length === 0) return "";

    if (!isNaN(netSayi) && netSayi > 0) {
        const adaylar = sayilar
            .filter(item => item.sayi !== netSayi && item.sayi >= netSayi * 0.45 && item.sayi <= netSayi * 1.8)
            .sort((a, b) => b.sayi - a.sayi);

        if (adaylar.length > 0) {
            return adaylar[0].tutar;
        }
    }

    return sayilar.sort((a, b) => b.sayi - a.sayi)[0].tutar;
}

function kesintiToplamiTahminEt(kalemler) {
    const toplam = kalemler
        .map(paraSayiyaCevir)
        .filter(sayi => !isNaN(sayi) && sayi > 0)
        .reduce((a, b) => a + b, 0);

    if (toplam <= 0) return "";

    return paraFormatla(toplam);
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
                <span>Brüt Ücret / Kazanç</span>
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
                <span>İşsizlik Kesintisi</span>
                <strong>${tutarYaz(analiz.issizlikKesintisi)}</strong>
            </div>

            <div class="result-line">
                <span>Gelir Vergisi</span>
                <strong>${tutarYaz(analiz.gelirVergisi)}</strong>
            </div>

            <div class="result-line">
                <span>Damga Vergisi</span>
                <strong>${tutarYaz(analiz.damgaVergisi)}</strong>
            </div>

            <div class="result-line">
                <span>Fazla Mesai</span>
                <strong>${tutarYaz(analiz.fazlaMesai)}</strong>
            </div>

            <div class="result-line">
                <span>Prim / İkramiye</span>
                <strong>${tutarYaz(analiz.primIkramiye)}</strong>
            </div>

            <div class="result-line">
                <span>Yol Yardımı</span>
                <strong>${tutarYaz(analiz.yolYardimi)}</strong>
            </div>

            <div class="result-line">
                <span>Yemek Yardımı</span>
                <strong>${tutarYaz(analiz.yemekYardimi)}</strong>
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
        issizlikKesintisi: analiz.issizlikKesintisi,
        gelirVergisi: analiz.gelirVergisi,
        damgaVergisi: analiz.damgaVergisi,
        agi: analiz.agi,
        fazlaMesai: analiz.fazlaMesai,
        primIkramiye: analiz.primIkramiye,
        yolYardimi: analiz.yolYardimi,
        yemekYardimi: analiz.yemekYardimi,
        bulunanTutarlar: analiz.bulunanTutarlar,
        hamMetinKisa: hamMetin.slice(0, 4000),
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
        ["Brut Ucret / Kazanc", sonAnaliz.brutUcret + " TL"],
        ["Toplam Kesinti", sonAnaliz.toplamKesinti + " TL"],
        ["SGK Kesintisi", sonAnaliz.sgkKesintisi + " TL"],
        ["Issizlik Kesintisi", sonAnaliz.issizlikKesintisi + " TL"],
        ["Gelir Vergisi", sonAnaliz.gelirVergisi + " TL"],
        ["Damga Vergisi", sonAnaliz.damgaVergisi + " TL"],
        ["Fazla Mesai", sonAnaliz.fazlaMesai + " TL"],
        ["Prim / Ikramiye", sonAnaliz.primIkramiye + " TL"],
        ["Yol Yardimi", sonAnaliz.yolYardimi + " TL"],
        ["Yemek Yardimi", sonAnaliz.yemekYardimi + " TL"]
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