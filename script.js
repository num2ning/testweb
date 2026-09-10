// script.js (ฉบับแก้ไขปัญหาหยุดสแกนเมื่อเจอค่าซ้ำและค่าผิดเงื่อนไข)

let html5QrCode;
let isProcessing = false;
let scanHistoryList = [];

// 🔊 ฟังก์ชันสร้างเสียงแจ้งเตือน (Beep) แบบปรับแต่งโทนได้
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

    // วาดจากล่าสุดขึ้นข้างบน เพื่อความสะดวกในการตรวจทาน
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

// 🎯 ฟังก์ชันสแกนสำเร็จ
function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true; // ล็อกระบบสแกนชั่วคราวเพื่อประมวลผลข้อมูล

    // 1. ดักสิทธิและตัดช่องว่างหัวท้ายที่อาจติดมาในรหัส QR
    const cleanedText = decodedText ? decodedText.trim() : "";
    const splitElement = document.getElementById('result-split');

    // 🛡️ ป้องกันค่าว่างดิบ
    if (cleanedText === "") {
        playBeepSound('warning');
        document.getElementById('result-all').innerText = "สแกนสำเร็จแต่พบข้อความว่างเปล่า";
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ค่าที่สแกนได้เป็นค่าว่าง (ไม่เก็บประวัติ)</span>`;

        // 🔄 ปลดล็อกกล้องและเริ่มสแกนต่อทันที
        resumeScanning(1500);
        return;
    }

    const startIndex = 8;
    const endIndex = 30;
    let extractedText = "";

    // 2. ตรวจสอบเงื่อนไขความยาว 22 Digits (ดึงตำแหน่ง 9 ถึง 30 ต้นฉบับต้องมีอย่างน้อย 30 ตัวอักษร)
    if (cleanedText.length >= endIndex) {
        extractedText = cleanedText.substring(startIndex, endIndex).trim();
        const digitCount = extractedText.length;

        if (digitCount !== 22) {
            playBeepSound('warning');
            document.getElementById('result-all').innerText = cleanedText;
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ข้อมูลไม่ตรงมาตรฐาน (${digitCount} Digits / ต้องการ 22)</span>`;

            // 🔄 ข้อมูลไม่ได้ขนาด ปลดล็อกกล้องและเริ่มสแกนต่อ
            resumeScanning(1500);
            return;
        }

        // 🔍 ตรวจสอบความซ้ำในประวัติ
        const isDuplicate = scanHistoryList.some(item => item.text === extractedText);

        if (isDuplicate) {
            playBeepSound('warning'); // แจ้งเสียงเตือนซ้ำ (เสียงบี๊บต่ำ)

            document.getElementById('result-all').innerText = cleanedText;
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">⚠️ ตรวจพบค่าซ้ำ: ${extractedText}</span>`;

            // 🔄 ตรวจพบรหัสซ้ำ ปลดล็อกกล้องให้ทำงานต่ออัตโนมัติภายใน 1.5 วินาที
            resumeScanning(1500);
            return;
        }

        // ✅ ผ่านเกณฑ์ความถูกต้องทั้งหมด (ไม่ว่าง, ไม่ซ้ำ, และมี 22 Digits พอดี)
        playBeepSound('success'); // แจ้งเตือนสแกนสำเร็จด้วยเสียงติ๊ดแหลมสูง

        document.getElementById('result-all').innerText = cleanedText;
        splitElement.innerHTML = `<span style="color: #10b981; font-weight: 700;">${extractedText}</span>`;

        scanHistoryList.push({
            text: extractedText,
            time: getCurrentTimeFormatted()
        });

        updateHistoryUI();

    } else {
        playBeepSound('warning');
        document.getElementById('result-all').innerText = cleanedText;
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ข้อความสั้นเกินไป (สั้นกว่า 30 ตัวอักษร)</span>`;

        // 🔄 ปลดล็อกกล้องและเริ่มสแกนต่อ
        resumeScanning(1500);
        return;
    }

    // กรณีสแกนค่าใหม่ผ่านสำเร็จ พักวงจรสแกน 2.5 วินาที เพื่อไม่ให้จับภาพแผ่นเดิมทันที
    resumeScanning(2500);
}

// 🔄 ฟังก์ชันช่วยตื่นตัวกล้องและปลดล็อกระบบ (ลบล้างอาการค้าง)
function resumeScanning(delayTime) {
    setTimeout(() => {
        isProcessing = false;

        // 🚨 สั่งให้ html5QrCode ทำการสแกนจับเฟรมวิดีโอต่อโดยตรง (Resume scanning)
        if (html5QrCode && html5QrCode.getState() === Html5QrcodeScannerState.PAUSED) {
            try {
                html5QrCode.resume();
                console.log("สตรีมกล้องกลับมาพร้อมทำงานต่อแล้ว...");
            } catch (err) {
                console.error("Resume failed: ", err);
            }
        }
    }, delayTime);
}

// 🎥 เริ่มสแกนกล้อง
function startScanner() {
    document.getElementById('start-btn').style.display = 'none';

    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            html5QrCode = new Html5Qrcode("reader");

            // ลองเปิดกล้องหลังก่อน
            html5QrCode.start(
                { facingMode: "environment" },
                { fps: 15, qrbox: { width: 250, height: 250 } },
                onScanSuccess
            ).then(() => {
                document.getElementById('overlay').style.display = 'flex';
                updateHistoryUI();
            }).catch(err => {
                console.warn("ไม่พบกล้องหลัง กำลังใช้งานกล้องตัวแรกสุด...", err);

                html5QrCode.start(
                    devices[0].id,
                    { fps: 15, qrbox: { width: 250, height: 250 } },
                    onScanSuccess
                ).then(() => {
                    document.getElementById('overlay').style.display = 'flex';
                    updateHistoryUI();
                }).catch(fallbackErr => {
                    document.getElementById('start-btn').style.display = 'inline-block';
                    alert("❌ ไม่สามารถเปิดกล้องได้: " + fallbackErr);
                });
            });

        } else {
            document.getElementById('start-btn').style.display = 'inline-block';
            alert("❌ ไม่พบอุปกรณ์กล้องบนเครื่องนี้");
        }
    }).catch(err => {
        document.getElementById('start-btn').style.display = 'inline-block';
        alert("❌ เบราว์เซอร์ปฏิเสธสิทธิ์การเข้าถึงกล้อง (กรุณากด Allow หรือตรวจสอบ HTTPS)\nรายละเอียด: " + err);
    });
}
