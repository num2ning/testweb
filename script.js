// script.js (ฉบับเสถียรภาพสูงสุด รองรับกล้องมือถือและคอมพิวเตอร์ทุกรุ่น)

let html5QrCode;
let isProcessing = false;
let scanHistoryList = [];

// 🔊 ฟังก์ชันสร้างเสียงบี๊บ
function playBeepSound(type = 'success') {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (type === 'success') {
            oscillator.type = 'sine';
            oscillator.frequency.value = 1200;
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.12);
        } else if (type === 'warning') {
            oscillator.type = 'triangle';
            oscillator.frequency.value = 300;
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.15);
        }
    } catch (e) {
        console.warn("Audio Context blocked", e);
    }
}

// ⏳ ดึงเวลาปัจจุบันในฟอร์แมต HH:MM:SS น.
function getCurrentTimeFormatted() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds} น.`;
}

// 🔄 อัปเดตตารางรายการประวัติ
function updateHistoryUI() {
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '';

    if (scanHistoryList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 1.5rem;">ยังไม่มีประวัติการสแกนเข้าสู่ระบบ</td></tr>`;
        return;
    }

    // แสดงประวัติล่าสุดไว้บนสุด
    for (let i = scanHistoryList.length - 1; i >= 0; i--) {
        const item = scanHistoryList[i];

        const row = document.createElement('tr');

        const cellIndex = document.createElement('td');
        cellIndex.className = 'col-index';
        cellIndex.innerText = i + 1;

        const cellData = document.createElement('td');
        cellData.className = 'col-data';
        cellData.innerText = item.text;

        const cellTime = document.createElement('td');
        cellTime.className = 'col-time';
        cellTime.innerText = item.time;

        row.appendChild(cellIndex);
        row.appendChild(cellData);
        row.appendChild(cellTime);

        tbody.appendChild(row);
    }
}

// 🗑️ ล้างประวัติทั้งหมด
function clearHistory() {
    const confirmClear = confirm("คุณต้องการล้างประวัติการสแกนทั้งหมดใช่หรือไม่?");
    if (confirmClear) {
        scanHistoryList = [];
        updateHistoryUI();
        document.getElementById('result-all').innerText = "รอสแกนแผ่นใหม่...";
        document.getElementById('result-split').innerText = "-";
        playBeepSound('warning');
    }
}

// 📥 ดาวน์โหลดประวัติเป็น .txt
function downloadHistory() {
    if (scanHistoryList.length === 0) {
        alert("ยังไม่มีข้อมูลประวัติการสแกนให้ดาวน์โหลดครับ");
        return;
    }

    const textContent = scanHistoryList.map(item => item.text).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;

    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `QR_Scan_History_${dateStr}.txt`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

// 🎯 ฟังก์ชันสแกนสำเร็จ (Success Callback)
function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true; // ล็อกป้อนกันการสแกนซ้ำซ้อนชั่วคราว

    const cleanedText = decodedText ? decodedText.trim() : "";
    const splitElement = document.getElementById('result-split');

    // ตรวจสอบค่าว่าง
    if (cleanedText === "") {
        playBeepSound('warning');
        document.getElementById('result-all').innerText = "สแกนสำเร็จแต่พบข้อความว่างเปล่า";
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ค่าเป็นค่าว่าง (ไม่เก็บประวัติ)</span>`;
        setTimeout(() => { isProcessing = false; }, 1500);
        return;
    }

    const startIndex = 8;
    const endIndex = 30;
    let extractedText = "";

    // ตรวจสอบเงื่อนไขความยาว 22 หลัก (ข้อมูลต้นฉบับต้องมีอย่างน้อย 30 ตัวอักษรขึ้นไป)
    if (cleanedText.length >= endIndex) {
        extractedText = cleanedText.substring(startIndex, endIndex).trim();
        const digitCount = extractedText.length;

        if (digitCount !== 22) {
            playBeepSound('warning');
            document.getElementById('result-all').innerText = cleanedText;
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ รหัสตัดได้ยาว ${digitCount} หลัก (ต้องการ 22 หลัก)</span>`;
            setTimeout(() => { isProcessing = false; }, 1500);
            return;
        }

        // ตรวจเช็คข้อมูลซ้ำในประวัติ
        const isDuplicate = scanHistoryList.some(item => item.text === extractedText);

        if (isDuplicate) {
            playBeepSound('warning');
            document.getElementById('result-all').innerText = cleanedText;
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">⚠️ รหัสนี้ถูกสแกนไปแล้ว: ${extractedText}</span>`;
            setTimeout(() => { isProcessing = false; }, 1500);
            return;
        }

        // บันทึกสำเร็จ
        playBeepSound('success');
        document.getElementById('result-all').innerText = cleanedText;
        splitElement.innerHTML = `<span style="color: #1d4ed8; font-weight: 700;">${extractedText}</span>`;

        scanHistoryList.push({
            text: extractedText,
            time: getCurrentTimeFormatted()
        });
        updateHistoryUI();

    } else {
        playBeepSound('warning');
        document.getElementById('result-all').innerText = cleanedText;
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ รหัสต้นฉบับสั้นเกินไป (${cleanedText.length} หลัก) ไม่สามารถดึงตำแหน่งที่ 9-30 ได้</span>`;
        setTimeout(() => { isProcessing = false; }, 1500);
        return;
    }

    // กรณีสแกนผ่านสำเร็จ พักวงจรสแกน 2.5 วินาที
    setTimeout(() => {
        isProcessing = false;
    }, 2500);
}

// 🎥 ฟังก์ชันเปิดกล้อง (สเปกแบบปลอดภัยสูงสุด ไร้ข้อจำกัดเชิงลึกเพื่อการป้องกันแครช)
function startScanner() {
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('result-all').innerHTML = "<span style='color:#3b82f6;'>กำลังประมวลผลกล้อง...</span>";

    if (html5QrCode) {
        try { html5QrCode.clear(); } catch (e) { }
    }

    html5QrCode = new Html5Qrcode("reader");

    // ⚙️ การตั้งค่าที่คลีนที่สุด (ไม่มีการบังคับความละเอียดของพิกเซลที่อาจทำกล้องแครช)
    const config = {
        fps: 15,
        qrbox: 230, // ขนาดกล่องเล็งสมดุล 230x230px

        // 🎯 บังคับประมวลผลเฉพาะรูปแบบ QR_CODE เท่านั้น ปลดล็อกความเร็วสแกนติดง่าย 100%
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
    };

    // เปิดใช้งานกล้องหลังในโหมด Standard
    html5QrCode.start(
        { facingMode: "environment" }, // ร้องขอใช้งานกล้องหลังเป็นหลัก
        config,
        onScanSuccess
    ).then(() => {
        document.getElementById('overlay').style.display = 'flex';
        document.getElementById('result-all').innerText = "กล้องพร้อมใช้งาน กรุณานำ QR Code มาวางตรงกลางกรอบ";
        updateHistoryUI();
    }).catch(err => {
        console.warn("ไม่สามารถเปิดกล้องหลังแบบกำหนดเองได้ กำลังใช้แผนสำรองกล้องเริ่มต้น...", err);

        // 🔄 แผนสำรอง: เปิดกล้องเว็บแคมตัวแรกสุดที่อุปกรณ์ตรวจเจอ (เช่น บน PC หรือระบบที่ระบุชื่อเลนส์ไม่ได้)
        html5QrCode.start(
            { facingMode: "user" }, // สลับลองเปิดกล้องหน้า/กล้องหลักทั่วไป
            config,
            onScanSuccess
        ).then(() => {
            document.getElementById('overlay').style.display = 'flex';
            document.getElementById('result-all').innerText = "กล้องหน้าพร้อมใช้งาน";
            updateHistoryUI();
        }).catch(fallbackErr => {
            document.getElementById('start-btn').style.display = 'inline-block';
            document.getElementById('result-all').innerHTML = `<span style="color:#ef4444; font-weight:bold;">Error: ${fallbackErr}</span>`;
            alert("❌ ไม่สามารถสตาร์ทระบบกล้องได้เนื่องจาก: " + fallbackErr);
        });
    });
}

// เริ่มวาดตารางประวัติเริ่มต้นเมื่อโหลดหน้าจอ
window.addEventListener('DOMContentLoaded', updateHistoryUI);
