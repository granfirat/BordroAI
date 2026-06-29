import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    serverTimestamp,
    collection,
    addDoc,
    getDocs,
    query,
    where
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

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let raporVerisi = {};
let aktifKullanici = null;

/* AÇILIŞ EKRANI */
window.addEventListener("load", () => {
    const splash = document.getElementById("splash-screen");

    if (!splash) return;

    setTimeout(() => {
        splash.classList.add("splash-hidden");

        setTimeout(() => {
            splash.remove();
        }, 900);
    }, 1800);
});

/* FIREBASE KULLANICI PANELİ */
onAuthStateChanged(auth, async (user) => {
    const authContainer = document.getElementById("authContainer");
    const appContainer = document.getElementById("appContainer");
    const kullaniciBilgi = document.getElementById("kullaniciBilgi");

    if (user) {
        aktifKullanici = user;

        authContainer.classList.add("hidden");
        appContainer.classList.remove("hidden");

        kullaniciBilgi.innerText =
            "Hoş geldin, " + (user.displayName || user.email);

        await setDoc(doc(db, "kullanicilar", user.uid), {
            uid: user.uid,
            adSoyad: user.displayName || "İsimsiz Kullanıcı",
            email: user.email,
            updatedAt: serverTimestamp()
        }, { merge: true });

        await sayaclariGuncelle();
        await gecmisAnalizleriGetir();

    } else {
        aktifKullanici = null;

        authContainer.classList.remove("hidden");
        appContainer.classList.add("hidden");

        const toplamKullaniciEl = document.getElementById("toplamKullanici");
        const toplamAnalizEl = document.getElementById("toplamAnaliz");

        if (toplamKullaniciEl) toplamKullaniciEl.innerText = "0";
        if (toplamAnalizEl) toplamAnalizEl.innerText = "0";
    }
});

/* KAYIT OL */
window.kayitOl = async function () {
    const adSoyad = document.getElementById("adSoyad").value.trim();
    const email = document.getElementById("email").value.trim();
    const sifre = document.getElementById("sifre").value.trim();
    const authMesaj = document.getElementById("authMesaj");

    if (!adSoyad || !email || !sifre) {
        authMesaj.innerText = "Lütfen tüm alanları doldurun.";
        return;
    }

    if (sifre.length < 6) {
        authMesaj.innerText = "Şifre en az 6 karakter olmalı.";
        return;
    }

    try {
        const sonuc = await createUserWithEmailAndPassword(auth, email, sifre);

        await updateProfile(sonuc.user, {
            displayName: adSoyad
        });

        await setDoc(doc(db, "kullanicilar", sonuc.user.uid), {
            uid: sonuc.user.uid,
            adSoyad: adSoyad,
            email: sonuc.user.email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });

        authMesaj.innerText = "Kayıt başarılı. Giriş yapıldı.";
        await sayaclariGuncelle();
        await gecmisAnalizleriGetir();

    } catch (error) {
        console.error(error);
        authMesaj.innerText = hataMesaji(error.code);
    }
};

/* GİRİŞ YAP */
window.girisYap = async function () {
    const email = document.getElementById("email").value.trim();
    const sifre = document.getElementById("sifre").value.trim();
    const authMesaj = document.getElementById("authMesaj");

    if (!email || !sifre) {
        authMesaj.innerText = "E-posta ve şifre girin.";
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, sifre);
        authMesaj.innerText = "Giriş başarılı.";
    } catch (error) {
        console.error(error);
        authMesaj.innerText = hataMesaji(error.code);
    }
};

/* ÇIKIŞ YAP */
window.cikisYap = async function () {
    await signOut(auth);
};

/* HATA MESAJLARI */
function hataMesaji(kod) {
    if (kod === "auth/email-already-in-use") return "Bu e-posta zaten kayıtlı. Giriş Yap butonunu kullan.";
    if (kod === "auth/invalid-email") return "Geçerli bir e-posta girin.";
    if (kod === "auth/weak-password") return "Şifre en az 6 karakter olmalı.";
    if (kod === "auth/invalid-credential") return "E-posta veya şifre hatalı.";
    if (kod === "auth/user-not-found") return "Bu e-posta ile kayıt bulunamadı.";
    if (kod === "auth/wrong-password") return "Şifre hatalı.";
    return "Bir hata oluştu: " + kod;
}

/* BORDRO OKUMA */
async function dosyaSec() {
    const dosya = document.getElementById("pdfSec").files[0];

    if (!dosya) {
        alert("Lütfen bir bordro dosyası seçin.");
        return;
    }

    temizle();

    const dosyaAdi = dosya.name.toLowerCase();

    try {
        let metin = "";

        if (
            dosyaAdi.endsWith(".jpg") ||
            dosyaAdi.endsWith(".jpeg") ||
            dosyaAdi.endsWith(".png")
        ) {
            document.getElementById("sonuc").innerText =
                "Görsel OCR ile okunuyor, lütfen bekleyin...";

            metin = await gorselOku(dosya);

        } else if (dosyaAdi.endsWith(".pdf")) {
            document.getElementById("sonuc").innerText =
                "PDF OCR ile okunuyor, lütfen bekleyin...";

            metin = await pdfOcrOku(dosya);

        } else {
            document.getElementById("sonuc").innerText =
                "Bu dosya türü desteklenmiyor.";
            return;
        }

        console.log("OKUNAN METİN:");
        console.log(metin);

        await bordroAnalizEt(metin);

    } catch (hata) {
        console.error(hata);
        document.getElementById("sonuc").innerText =
            "Bir hata oluştu. Console ekranını kontrol et.";
    }
}

/* TEMİZLE */
function temizle() {
    document.getElementById("sonuc").innerText = "";

    document.getElementById("analizKartlari").classList.add("hidden");
    document.getElementById("detayKartlari").classList.add("hidden");
    document.getElementById("toplamPanel").classList.add("hidden");
    document.getElementById("yorum").classList.add("hidden");
    document.getElementById("ozetPanel").classList.add("hidden");
    document.getElementById("skorPanel").classList.add("hidden");
    document.getElementById("kontrolPanel").classList.add("hidden");
    document.getElementById("raporBtn").classList.add("hidden");

    document
        .querySelectorAll("#analizKartlari .card strong, #detayKartlari .card strong")
        .forEach(kart => {
            kart.innerText = "Bulunamadı";
        });

    document.getElementById("toplamYasalKesinti").innerText = "0 TL";
    document.getElementById("toplamNetOdenen").innerText = "0 TL";
    document.getElementById("toplamEkOdeme").innerText = "0 TL";
    document.getElementById("bordroSkoru").innerText = "0";
    document.getElementById("skorAciklama").innerText = "Analiz bekleniyor.";
}

/* GÖRSEL OCR */
async function gorselOku(dosya) {
    const sonuc = await Tesseract.recognize(dosya, "tur");
    return sonuc.data.text;
}

/* PDF OCR */
async function pdfOcrOku(dosya) {
    const arrayBuffer = await dosya.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let tumMetin = "";

    for (let sayfaNo = 1; sayfaNo <= pdf.numPages; sayfaNo++) {
        document.getElementById("sonuc").innerText =
            "PDF OCR okunuyor... Sayfa " + sayfaNo + "/" + pdf.numPages;

        const sayfa = await pdf.getPage(sayfaNo);
        const viewport = sayfa.getViewport({ scale: 3 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await sayfa.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const ocrSonuc = await Tesseract.recognize(canvas, "tur");
        tumMetin += ocrSonuc.data.text + " ";
    }

    return tumMetin;
}

/* BORDRO ANALİZ */
async function bordroAnalizEt(metin) {
    document.getElementById("sonuc").innerText =
        "Bordro okundu. Analiz tamamlandı.";

    const temizMetin = metniTemizle(metin);

    const netMaas = netMaasBul(temizMetin);
    const mesai = mesaiBul(temizMetin);
    const prim = primBul(temizMetin);
    const kesinti = kesintiBul(temizMetin);

    const sgkPrimi = sgkPrimiBul(temizMetin);
    const gelirVergisi = gelirVergisiBul(temizMetin);
    const damgaVergisi = damgaVergisiBul(temizMetin);
    const besTutari = besTutariBul(temizMetin);

    const toplamYasalKesintiDeger =
        paraDegeriniAl(sgkPrimi) +
        paraDegeriniAl(gelirVergisi) +
        paraDegeriniAl(damgaVergisi) +
        paraDegeriniAl(besTutari);

    const toplamYasalKesinti = paraFormatla(toplamYasalKesintiDeger);

    const toplamEkOdemeDeger =
        paraDegeriniAl(mesai) +
        paraDegeriniAl(prim);

    const toplamEkOdeme = paraFormatla(toplamEkOdemeDeger);

    document.getElementById("analizKartlari").classList.remove("hidden");
    document.getElementById("detayKartlari").classList.remove("hidden");
    document.getElementById("toplamPanel").classList.remove("hidden");
    document.getElementById("yorum").classList.remove("hidden");
    document.getElementById("ozetPanel").classList.remove("hidden");
    document.getElementById("skorPanel").classList.remove("hidden");
    document.getElementById("kontrolPanel").classList.remove("hidden");
    document.getElementById("raporBtn").classList.remove("hidden");

    const anaKartlar =
        document.querySelectorAll("#analizKartlari .card strong");

    anaKartlar[0].innerText = netMaas;
    anaKartlar[1].innerText = mesai;
    anaKartlar[2].innerText = prim;
    anaKartlar[3].innerText = kesinti;

    const detayKartlar =
        document.querySelectorAll("#detayKartlari .card strong");

    detayKartlar[0].innerText = sgkPrimi;
    detayKartlar[1].innerText = gelirVergisi;
    detayKartlar[2].innerText = damgaVergisi;
    detayKartlar[3].innerText = besTutari;

    document.getElementById("toplamYasalKesinti").innerText =
        toplamYasalKesinti;

    document.getElementById("toplamNetOdenen").innerText =
        netMaas;

    document.getElementById("toplamEkOdeme").innerText =
        toplamEkOdeme;

    let bulunanSayisi = [
        netMaas,
        mesai,
        prim,
        kesinti,
        sgkPrimi,
        gelirVergisi,
        damgaVergisi
    ].filter(x => x !== "Bulunamadı").length;

    let analizDurumu = "Başarılı";
    let riskSeviyesi = "Düşük";

    if (bulunanSayisi < 6) {
        analizDurumu = "Kısmi Başarılı";
        riskSeviyesi = "Orta";
    }

    if (bulunanSayisi < 3) {
        analizDurumu = "Zayıf Okuma";
        riskSeviyesi = "Yüksek";
    }

    document.getElementById("analizDurumu").innerText = analizDurumu;
    document.getElementById("riskSeviyesi").innerText = riskSeviyesi;

    let skor = 0;

    if (netMaas !== "Bulunamadı") skor += 25;
    if (mesai !== "Bulunamadı") skor += 20;
    if (prim !== "Bulunamadı") skor += 15;
    if (kesinti !== "Bulunamadı") skor += 20;
    if (sgkPrimi !== "Bulunamadı") skor += 7;
    if (gelirVergisi !== "Bulunamadı") skor += 7;
    if (damgaVergisi !== "Bulunamadı") skor += 6;

    document.getElementById("bordroSkoru").innerText = skor;

    document.getElementById("skorAciklama").innerText =
        skor >= 90
            ? "Bordro başarıyla analiz edildi. Ana kalemler ve alt kesintiler tespit edildi."
            : "Bordro analiz edildi fakat bazı kalemler eksik olabilir.";

    const kontrol = kontrolMotoru(netMaas, mesai, prim, kesinti);

    document.getElementById("maasKontrolIcon").innerText =
        kontrol.maasIcon;

    document.getElementById("maasKontrolText").innerText =
        kontrol.maasText;

    document.getElementById("mesaiKontrolIcon").innerText =
        kontrol.mesaiIcon;

    document.getElementById("mesaiKontrolText").innerText =
        kontrol.mesaiText;

    document.getElementById("kesintiKontrolIcon").innerText =
        kontrol.kesintiIcon;

    document.getElementById("kesintiKontrolText").innerText =
        kontrol.kesintiText;

    const yorum =
        "Bordronuz başarıyla OCR ile okundu. Net maaşınız " + netMaas +
        ", net fazla mesai ödemeniz " + mesai +
        ", prim toplamınız " + prim +
        ", toplam kesintileriniz " + kesinti +
        " olarak tespit edildi. Alt kesintilerde SGK primi " + sgkPrimi +
        ", gelir vergisi " + gelirVergisi +
        ", damga vergisi " + damgaVergisi +
        ", BES tutarı " + besTutari +
        " olarak okundu. Toplam yasal kesinti " + toplamYasalKesinti +
        ", toplam prim ve mesai ödemeniz " + toplamEkOdeme +
        " olarak hesaplandı. Bordro skorunuz " + skor + "/100.";

    document.querySelector("#yorum p").innerText = yorum;

    raporVerisi = {
        netMaas,
        mesai,
        prim,
        kesinti,
        sgkPrimi,
        gelirVergisi,
        damgaVergisi,
        besTutari,
        toplamYasalKesinti,
        toplamEkOdeme,
        skor,
        analizDurumu,
        riskSeviyesi,
        yorum,
        maasKontrol: kontrol.maasText,
        mesaiKontrol: kontrol.mesaiText,
        kesintiKontrol: kontrol.kesintiText
    };

    await analizKaydet();
    await sayaclariGuncelle();
    await gecmisAnalizleriGetir();
}

/* ANALİZİ FIRESTORE'A KAYDET */
async function analizKaydet() {
    if (!aktifKullanici) {
        console.warn("Kullanıcı giriş yapmamış. Analiz kaydedilmedi.");
        return;
    }

    try {
        await addDoc(collection(db, "analizler"), {
            uid: aktifKullanici.uid,
            email: aktifKullanici.email,
            adSoyad: aktifKullanici.displayName || aktifKullanici.email,

            netMaas: raporVerisi.netMaas,
            mesai: raporVerisi.mesai,
            prim: raporVerisi.prim,
            kesinti: raporVerisi.kesinti,
            sgkPrimi: raporVerisi.sgkPrimi,
            gelirVergisi: raporVerisi.gelirVergisi,
            damgaVergisi: raporVerisi.damgaVergisi,
            besTutari: raporVerisi.besTutari,
            toplamYasalKesinti: raporVerisi.toplamYasalKesinti,
            toplamEkOdeme: raporVerisi.toplamEkOdeme,
            skor: raporVerisi.skor,
            analizDurumu: raporVerisi.analizDurumu,
            riskSeviyesi: raporVerisi.riskSeviyesi,
            yorum: raporVerisi.yorum,

            createdAt: serverTimestamp()
        });

        console.log("Analiz Firestore'a kaydedildi.");

    } catch (error) {
        console.error("Analiz kaydedilemedi:", error);
    }
}

/* GÜVENLİ SAYAÇLAR */
async function sayaclariGuncelle() {
    const toplamKullaniciEl = document.getElementById("toplamKullanici");
    const toplamAnalizEl = document.getElementById("toplamAnaliz");

    if (!aktifKullanici) {
        if (toplamKullaniciEl) toplamKullaniciEl.innerText = "0";
        if (toplamAnalizEl) toplamAnalizEl.innerText = "0";
        return;
    }

    try {
        if (toplamKullaniciEl) {
            toplamKullaniciEl.innerText = "1";
        }

        const analizSorgusu = query(
            collection(db, "analizler"),
            where("uid", "==", aktifKullanici.uid)
        );

        const snapshot = await getDocs(analizSorgusu);

        if (toplamAnalizEl) {
            toplamAnalizEl.innerText = snapshot.size;
        }

    } catch (error) {
        console.error("Güvenli sayaçlar güncellenemedi:", error);

        if (toplamKullaniciEl) toplamKullaniciEl.innerText = "1";
        if (toplamAnalizEl) toplamAnalizEl.innerText = "0";
    }
}

/* GEÇMİŞ ANALİZLERİ GETİR */
async function gecmisAnalizleriGetir() {
    const gecmisListe = document.getElementById("gecmisListe");

    if (!gecmisListe) return;

    if (!aktifKullanici) {
        gecmisListe.innerHTML =
            '<p class="empty-text">Geçmiş analizleri görmek için giriş yapmalısınız.</p>';
        return;
    }

    try {
        gecmisListe.innerHTML =
            '<p class="empty-text">Geçmiş analizler yükleniyor...</p>';

        const analizSorgusu = query(
            collection(db, "analizler"),
            where("uid", "==", aktifKullanici.uid)
        );

        const snapshot = await getDocs(analizSorgusu);

        if (snapshot.empty) {
            gecmisListe.innerHTML =
                '<p class="empty-text">Henüz kayıtlı analiziniz yok.</p>';
            return;
        }

        const analizler = [];

        snapshot.forEach((docItem) => {
            analizler.push({
                id: docItem.id,
                ...docItem.data()
            });
        });

        analizler.sort((a, b) => {
            const tarihA = a.createdAt?.seconds || 0;
            const tarihB = b.createdAt?.seconds || 0;
            return tarihB - tarihA;
        });

        gecmisListe.innerHTML = "";

        analizler.slice(0, 10).forEach((analiz) => {
            const tarih = analiz.createdAt
                ? analiz.createdAt.toDate().toLocaleString("tr-TR")
                : "Tarih yok";

            let riskClass = "risk-low";

            if (analiz.riskSeviyesi === "Orta") {
                riskClass = "risk-mid";
            }

            if (analiz.riskSeviyesi === "Yüksek") {
                riskClass = "risk-high";
            }

            const kart = document.createElement("div");
            kart.className = "history-card";

            kart.innerHTML = `
                <div class="history-item">
                    <span>Tarih</span>
                    <strong>${metinGuvenli(tarih)}</strong>
                </div>

                <div class="history-item">
                    <span>Net Maaş</span>
                    <strong>${metinGuvenli(analiz.netMaas || "Bulunamadı")}</strong>
                </div>

                <div class="history-item">
                    <span>Mesai</span>
                    <strong>${metinGuvenli(analiz.mesai || "Bulunamadı")}</strong>
                </div>

                <div class="history-item">
                    <span>Prim</span>
                    <strong>${metinGuvenli(analiz.prim || "Bulunamadı")}</strong>
                </div>

                <div class="history-item">
                    <span>Skor</span>
                    <strong class="history-score">${metinGuvenli(String(analiz.skor || 0))}/100</strong>
                </div>

                <div class="history-item">
                    <span>Risk</span>
                    <strong class="${riskClass}">${metinGuvenli(analiz.riskSeviyesi || "Bilinmiyor")}</strong>
                </div>
            `;

            gecmisListe.appendChild(kart);
        });

    } catch (error) {
        console.error("Geçmiş analizler getirilemedi:", error);

        gecmisListe.innerHTML =
            '<p class="empty-text">Geçmiş analizler yüklenirken hata oluştu.</p>';
    }
}

/* KONTROL MOTORU */
function kontrolMotoru(netMaas, mesai, prim, kesinti) {
    const net = paraDegeriniAl(netMaas);
    const mesaiDegeri = paraDegeriniAl(mesai);
    const kesintiDegeri = paraDegeriniAl(kesinti);

    return {
        maasIcon: net > 0 ? "🟢" : "🔴",
        maasText:
            net > 0
                ? "Net maaş başarıyla tespit edildi."
                : "Net maaş tespit edilemedi.",

        mesaiIcon: mesaiDegeri > 0 ? "🟢" : "🟡",
        mesaiText:
            mesaiDegeri > 0
                ? "Fazla mesai ödemesi tespit edildi."
                : "Fazla mesai tespit edilemedi. Mesai yaptıysanız ayrıca kontrol edin.",

        kesintiIcon: kesintiDegeri > 0 ? "🟢" : "🔴",
        kesintiText:
            kesintiDegeri > 0
                ? "Kesinti tutarı tespit edildi."
                : "Kesinti tutarı tespit edilemedi."
    };
}

/* PDF RAPOR İNDİR */
function raporIndir() {
    if (!raporVerisi || !raporVerisi.netMaas) {
        alert("Önce bordro analizi yapmalısınız.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, 210, 32, "F");

    pdf.setTextColor(34, 197, 94);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text("BordroAI", 20, 20);

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.text("Yapay zeka destekli bordro analiz raporu", 60, 20);

    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(pdfMetni("Analiz Raporu"), 20, 48);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(
        pdfMetni("Bu rapor BordroAI tarafindan OCR ile okunan bordro verilerine gore olusturulmustur."),
        20,
        57
    );

    pdf.setDrawColor(34, 197, 94);
    pdf.line(20, 64, 190, 64);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text(pdfMetni("Bordro Sonuclari"), 20, 78);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(pdfMetni("Net Maas: " + raporVerisi.netMaas), 20, 92);
    pdf.text(pdfMetni("Net Fazla Mesai: " + raporVerisi.mesai), 20, 103);
    pdf.text(pdfMetni("Prim Toplami: " + raporVerisi.prim), 20, 114);
    pdf.text(pdfMetni("Toplam Kesinti: " + raporVerisi.kesinti), 20, 125);

    pdf.setFont("helvetica", "bold");
    pdf.text(pdfMetni("Alt Kesinti Kalemleri"), 20, 145);

    pdf.setFont("helvetica", "normal");
    pdf.text(pdfMetni("SGK Primi: " + raporVerisi.sgkPrimi), 20, 158);
    pdf.text(pdfMetni("Gelir Vergisi: " + raporVerisi.gelirVergisi), 20, 169);
    pdf.text(pdfMetni("Damga Vergisi: " + raporVerisi.damgaVergisi), 20, 180);
    pdf.text(pdfMetni("BES Tutari: " + raporVerisi.besTutari), 20, 191);

    pdf.setFont("helvetica", "bold");
    pdf.text(pdfMetni("Toplam Sonuc"), 20, 211);

    pdf.setFont("helvetica", "normal");
    pdf.text(pdfMetni("Toplam Yasal Kesinti: " + raporVerisi.toplamYasalKesinti), 20, 224);
    pdf.text(pdfMetni("Toplam Prim + Mesai: " + raporVerisi.toplamEkOdeme), 20, 235);
    pdf.text(pdfMetni("Bordro Skoru: " + raporVerisi.skor + "/100"), 20, 246);

    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 270, 210, 27, "F");

    pdf.setTextColor(34, 197, 94);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("BordroAI", 20, 282);

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(pdfMetni("BordroAI'yi kullandiginiz icin tesekkur ederiz."), 60, 282);

    pdf.setFontSize(8);
    pdf.text(pdfMetni("Bu rapor bilgilendirme amaclidir. Resmi belge yerine gecmez."), 60, 289);

    pdf.save("BordroAI-Analiz-Raporu.pdf");
}

/* METİN TEMİZLEME */
function metniTemizle(metin) {
    return metin
        .replace(/\s+/g, " ")
        .replace(/İ/g, "I").replace(/ı/g, "i")
        .replace(/Ö/g, "O").replace(/ö/g, "o")
        .replace(/Ü/g, "U").replace(/ü/g, "u")
        .replace(/Ğ/g, "G").replace(/ğ/g, "g")
        .replace(/Ş/g, "S").replace(/ş/g, "s")
        .replace(/Ç/g, "C").replace(/ç/g, "c")
        .replace(/:/g, " : ");
}

/* PDF TÜRKÇE KARAKTER TEMİZLEME */
function pdfMetni(metin) {
    return metin
        .replace(/ğ/g, "g").replace(/Ğ/g, "G")
        .replace(/ü/g, "u").replace(/Ü/g, "U")
        .replace(/ş/g, "s").replace(/Ş/g, "S")
        .replace(/ı/g, "i").replace(/İ/g, "I")
        .replace(/ö/g, "o").replace(/Ö/g, "O")
        .replace(/ç/g, "c").replace(/Ç/g, "C");
}

/* GÜVENLİ HTML METNİ */
function metinGuvenli(deger) {
    return String(deger)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* PARA BULMA FONKSİYONLARI */
function netMaasBul(metin) {
    const eslesme =
        metin.match(/NET\s*ODENEN\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/NETODENEN\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/NET\s*KAZANC\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/NET\s*UCRET\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/ODENECEK\s*NET\s*:\s*([\d.]+,\d+)/i);

    return eslesme ? paraTemizle(eslesme[1]) : "Bulunamadı";
}

function mesaiBul(metin) {
    const eslesme =
        metin.match(/(?:FRM150|FM150|F\.?M.*?150|F\.?M.*?4150|FM4150).*?(\d+,\d+).*?(\d+\.\d+,\d+).*?(\d+\.\d+,\d+)/i) ||
        metin.match(/FAZLA\s*MESAI.*?([\d.]+,\d+)/i) ||
        metin.match(/MESAI\s*UCRETI.*?([\d.]+,\d+)/i);

    if (!eslesme) return "Bulunamadı";

    return paraTemizle(eslesme[3] || eslesme[1]);
}

function primBul(metin) {
    let toplam = 0;

    const devamsizlik =
        metin.match(/DEVAMSIZLIK\s*PRIMI.*?([\d.]+,\d+).*?([\d.]+,\d+)/i) ||
        metin.match(/DEVAMSIZLIK\s*PRIMI.*?([\d.]+,\d+)/i);

    const performans =
        metin.match(/PERFORMANS\s*PRIMI.*?([\d.]+,\d+).*?([\d.]+,\d+)/i) ||
        metin.match(/PERFORMANS\s*PRIMI.*?([\d.]+,\d+)/i);

    const genelPrim =
        metin.match(/PRIM\s*ODEMESI.*?([\d.]+,\d+)/i) ||
        metin.match(/PRIM\s*TUTARI.*?([\d.]+,\d+)/i);

    if (devamsizlik) {
        toplam += paraSayiyaCevir(devamsizlik[2] || devamsizlik[1]);
    }

    if (performans) {
        toplam += paraSayiyaCevir(performans[2] || performans[1]);
    }

    if (genelPrim) {
        toplam += paraSayiyaCevir(genelPrim[1]);
    }

    return toplam > 0 ? paraFormatla(toplam) : "Bulunamadı";
}

function kesintiBul(metin) {
    const eslesme =
        metin.match(/YASAL\s*KESINTI\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/TOPLAM\s*KESINTI\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/KESINTILER\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/KESINTI\s*TOPLAMI\s*:\s*([\d.]+,\d+)/i);

    return eslesme ? paraTemizle(eslesme[1]) : "Bulunamadı";
}

function sgkPrimiBul(metin) {
    const eslesme =
        metin.match(/SGK\s*PRIMI\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/SGK\s*ISCI\s*PAYI\s*:\s*([\d.]+,\d+)/i);

    return eslesme ? paraTemizle(eslesme[1]) : "Bulunamadı";
}

function gelirVergisiBul(metin) {
    const eslesme =
        metin.match(/GELIR\s*VERGISI\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/GELIR\s*VERGISI\s*KESINTISI\s*:\s*([\d.]+,\d+)/i);

    return eslesme ? paraTemizle(eslesme[1]) : "Bulunamadı";
}

function damgaVergisiBul(metin) {
    const eslesme =
        metin.match(/DAMGA\s*VERGISI\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/DAMGA\s*VERGISI\s*KESINTISI\s*:\s*([\d.]+,\d+)/i);

    return eslesme ? paraTemizle(eslesme[1]) : "Bulunamadı";
}

function besTutariBul(metin) {
    const eslesme =
        metin.match(/BES\s*TUTARI\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/BES\s*KESINTISI\s*:\s*([\d.]+,\d+)/i);

    return eslesme ? paraTemizle(eslesme[1]) : "Bulunamadı";
}

/* PARA YARDIMCILARI */
function paraTemizle(deger) {
    return deger ? deger.trim() + " TL" : "Bulunamadı";
}

function paraFormatla(sayi) {
    return sayi.toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + " TL";
}

function paraDegeriniAl(deger) {
    if (!deger || deger === "Bulunamadı") return 0;

    return Number(
        deger
            .replace("TL", "")
            .replace(/\./g, "")
            .replace(",", ".")
            .replace(/[^\d.]/g, "")
    );
}

function paraSayiyaCevir(deger) {
    if (!deger) return 0;

    return Number(
        deger
            .replace(/\./g, "")
            .replace(",", ".")
            .replace(/[^\d.]/g, "")
    );
}

/* HTML ONCLICK İÇİN */
window.dosyaSec = dosyaSec;
window.raporIndir = raporIndir;
window.gecmisAnalizleriGetir = gecmisAnalizleriGetir;