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
    getDocs
    addDoc

} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

/* KULLANICI SAYACI */
function kullaniciSayaciKutusuOlustur() {
    const appContainer = document.getElementById("appContainer");

    if (!appContainer) return;
    if (document.getElementById("kullaniciSayaciKutusu")) return;

    const kutu = document.createElement("div");
    kutu.id = "kullaniciSayaciKutusu";
    kutu.style.background = "#111827";
    kutu.style.border = "1px solid #334155";
    kutu.style.borderRadius = "16px";
    kutu.style.padding = "20px";
    kutu.style.maxWidth = "260px";
    kutu.style.margin = "25px auto";
    kutu.style.textAlign = "center";
    kutu.style.color = "white";

    kutu.innerHTML = `
        <h3 style="color:#22c55e; margin-bottom:10px;">Toplam Kullanıcı</h3>
        <p id="toplamKullanici" style="font-size:36px; font-weight:bold; margin:0;">0</p>
    `;

    appContainer.prepend(kutu);
}

async function kullaniciSayisiniGetir() {
    try {
        const snapshot = await getDocs(collection(db, "users"));
        const toplam = snapshot.size;

        const alan = document.getElementById("toplamKullanici");

        if (alan) {
            alan.innerText = toplam;
        }
    } catch (error) {
        console.error("Kullanıcı sayısı alınamadı:", error);
    }
}async function analizSayisiniGetir() {
    try {
        const snapshot = await getDocs(collection(db, "analizler"));
        const toplam = snapshot.size;

        const alan = document.getElementById("toplamAnaliz");

        if (alan) {
            alan.innerText = toplam;
        }
    } catch (error) {
        console.error("Analiz sayısı alınamadı:", error);
    }
}

async function analizKaydet() {
    const user = auth.currentUser;

    if (!user) return;

    try {
        await addDoc(collection(db, "analizler"), {
            uid: user.uid,
            email: user.email,
            adSoyad: user.displayName || "",
            createdAt: serverTimestamp()
        });

        analizSayisiniGetir();
    } catch (error) {
        console.error("Analiz kaydedilemedi:", error);
    }
}

/* FIREBASE KULLANICI PANELİ */
onAuthStateChanged(auth, (user) => {
    const authContainer = document.getElementById("authContainer");
    const appContainer = document.getElementById("appContainer");
    const kullaniciBilgi = document.getElementById("kullaniciBilgi");

    if (user) {
        authContainer.classList.add("hidden");
        appContainer.classList.remove("hidden");

        kullaniciBilgi.innerText =
            "Hoş geldin, " + (user.displayName || user.email);

        kullaniciSayaciKutusuOlustur();
        kullaniciSayisiniGetir();
    } else {
        authContainer.classList.remove("hidden");
        appContainer.classList.add("hidden");
    }
});

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

        await setDoc(doc(db, "users", sonuc.user.uid), {
            uid: sonuc.user.uid,
            adSoyad: adSoyad,
            email: sonuc.user.email,
            createdAt: serverTimestamp()
        });

        await updateProfile(sonuc.user, {
            displayName: adSoyad
        });

        authMesaj.innerText = "Kayıt başarılı. Giriş yapıldı.";
        kullaniciSayisiniGetir();
    } catch (error) {
        console.error(error);
        authMesaj.innerText = hataMesaji(error.code);
    }
};

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

window.cikisYap = async function () {
    await signOut(auth);
};

function hataMesaji(kod) {
    if (kod === "auth/email-already-in-use") return "Bu e-posta zaten kayıtlı.";
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

        bordroAnalizEt(metin);
    } catch (hata) {
        console.error(hata);
        document.getElementById("sonuc").innerText =
            "Bir hata oluştu. Console ekranını kontrol et.";
    }
}

window.dosyaSec = dosyaSec;

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

    document.querySelectorAll(".card strong").forEach(kart => {
        kart.innerText = "Bulunamadı";
    });

    document.getElementById("toplamYasalKesinti").innerText = "0 TL";
    document.getElementById("toplamNetOdenen").innerText = "0 TL";
    document.getElementById("toplamEkOdeme").innerText = "0 TL";
    document.getElementById("bordroSkoru").innerText = "0";
    document.getElementById("skorAciklama").innerText = "Analiz bekleniyor...";
}

async function gorselOku(dosya) {
    const sonuc = await Tesseract.recognize(dosya, "tur");
    return sonuc.data.text;
}

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

function bordroAnalizEt(metin) {
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
        yorum
    };
}analizKaydet();

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
                : "Fazla mesai tespit edilemedi.",
        kesintiIcon: kesintiDegeri > 0 ? "🟢" : "🔴",
        kesintiText:
            kesintiDegeri > 0
                ? "Kesinti tutarı tespit edildi."
                : "Kesinti tutarı tespit edilemedi."
    };
}

/* RAPOR İNDİR */
function raporIndir() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    pdf.setFontSize(22);
    pdf.text("BordroAI Analiz Raporu", 20, 25);

    pdf.setFontSize(12);
    pdf.text(pdfMetni("Net Maaş: " + raporVerisi.netMaas), 20, 45);
    pdf.text(pdfMetni("Net Mesai: " + raporVerisi.mesai), 20, 57);
    pdf.text(pdfMetni("Prim: " + raporVerisi.prim), 20, 69);
    pdf.text(pdfMetni("Kesinti: " + raporVerisi.kesinti), 20, 81);
    pdf.text(pdfMetni("SGK Primi: " + raporVerisi.sgkPrimi), 20, 93);
    pdf.text(pdfMetni("Gelir Vergisi: " + raporVerisi.gelirVergisi), 20, 105);
    pdf.text(pdfMetni("Damga Vergisi: " + raporVerisi.damgaVergisi), 20, 117);
    pdf.text(pdfMetni("BES Tutarı: " + raporVerisi.besTutari), 20, 129);
    pdf.text(pdfMetni("Toplam Yasal Kesinti: " + raporVerisi.toplamYasalKesinti), 20, 141);
    pdf.text(pdfMetni("Toplam Ek Ödeme: " + raporVerisi.toplamEkOdeme), 20, 153);
    pdf.text(pdfMetni("Bordro Skoru: " + raporVerisi.skor + "/100"), 20, 165);

    pdf.save("BordroAI-Analiz-Raporu.pdf");
}

window.raporIndir = raporIndir;

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

function pdfMetni(metin) {
    return metin
        .replace(/ğ/g, "g").replace(/Ğ/g, "G")
        .replace(/ü/g, "u").replace(/Ü/g, "U")
        .replace(/ş/g, "s").replace(/Ş/g, "S")
        .replace(/ı/g, "i").replace(/İ/g, "I")
        .replace(/ö/g, "o").replace(/Ö/g, "O")
        .replace(/ç/g, "c").replace(/Ç/g, "C");
}

/* PARA BULMA FONKSİYONLARI */
function netMaasBul(metin) {
    const eslesme =
        metin.match(/NET\s*ODENEN\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/NETODENEN\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/NET\s*KAZANC\s*:\s*([\d.]+,\d+)/i);

    return eslesme ? paraTemizle(eslesme[1]) : "Bulunamadı";
}

function mesaiBul(metin) {
    const eslesme =
        metin.match(/(?:FRM150|FM150|F\.?M.*?150|F\.?M.*?4150|FM4150).*?(\d+,\d+).*?(\d+\.\d+,\d+).*?(\d+\.\d+,\d+)/i);

    return eslesme ? paraTemizle(eslesme[3]) : "Bulunamadı";
}

function primBul(metin) {
    let toplam = 0;

    const devamsizlik =
        metin.match(/DEVAMSIZLIK\s*PRIMI.*?([\d.]+,\d+).*?([\d.]+,\d+)/i) ||
        metin.match(/DEVAMSIZLIK\s*PRIMI.*?([\d.]+,\d+)/i);

    const performans =
        metin.match(/PERFORMANS\s*PRIMI.*?([\d.]+,\d+).*?([\d.]+,\d+)/i) ||
        metin.match(/PERFORMANS\s*PRIMI.*?([\d.]+,\d+)/i);

    if (devamsizlik) {
        toplam += paraSayiyaCevir(devamsizlik[2] || devamsizlik[1]);
    }

    if (performans) {
        toplam += paraSayiyaCevir(performans[2] || performans[1]);
    }

    return toplam > 0 ? paraFormatla(toplam) : "Bulunamadı";
}

function kesintiBul(metin) {
    const eslesme =
        metin.match(/YASAL\s*KESINTI\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/TOPLAM\s*KESINTI\s*:\s*([\d.]+,\d+)/i) ||
        metin.match(/KESINTILER\s*:\s*([\d.]+,\d+)/i);

    return eslesme ? paraTemizle(eslesme[1]) : "Bulunamadı";
}

function sgkPrimiBul(metin) {
    const eslesme =
        metin.match(/SGK\s*PRIMI\s*:\s*([\d.]+,\d+)/i);

    return eslesme ? paraTemizle(eslesme[1]) : "Bulunamadı";
}

function gelirVergisiBul(metin) {
    const eslesme =
        metin.match(/GELIR\s*VERGISI\s*:\s*([\d.]+,\d+)/i);

    return eslesme ? paraTemizle(eslesme[1]) : "Bulunamadı";
}

function damgaVergisiBul(metin) {
    const eslesme =
        metin.match(/DAMGA\s*VERGISI\s*:\s*([\d.]+,\d+)/i);

    return eslesme ? paraTemizle(eslesme[1]) : "Bulunamadı";
}

function besTutariBul(metin) {
    const eslesme =
        metin.match(/BES\s*TUTARI\s*:\s*([\d.]+,\d+)/i);

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