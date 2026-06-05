async function dosyaSec() {
    const dosya = document.getElementById("pdfSec").files[0];

    if (!dosya) {
        alert("Lütfen bir bordro dosyası seçin.");
        return;
    }

    const dosyaAdi = dosya.name.toLowerCase();

    document.getElementById("sonuc").innerText =
        "Dosya seçildi: " + dosya.name;

    if (dosyaAdi.endsWith(".pdf")) {
        document.getElementById("sonuc").innerText =
            "PDF algılandı. PDF okuma sistemi hazırlanıyor...";
    }
    else if (
        dosyaAdi.endsWith(".jpg") ||
        dosyaAdi.endsWith(".jpeg") ||
        dosyaAdi.endsWith(".png")
    ) {
        document.getElementById("sonuc").innerText =
            "Görsel algılandı. OCR sistemi hazırlanıyor...";
    }
    else {
        document.getElementById("sonuc").innerText =
            "Bu dosya türü desteklenmiyor. Lütfen PDF, JPG veya PNG yükleyin.";
        return;
    }

    setTimeout(function() {
        document.getElementById("analizKartlari").classList.remove("hidden");
        document.getElementById("yorum").classList.remove("hidden");
    }, 1000);
}