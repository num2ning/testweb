// script.js (ฉบับสมบูรณ์ แก้ไขอาการค้างเมื่อสแกนเจอค่าซ้ำ)

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

// 🚨 จัดการหน้าต่างป๊อปอัป (Popup Modal Logic)
function showDuplicateModal(text) {
    const modal = document.getElementById('duplicate-modal');
    const messageEl = document.getElementById('modal-dup-message');

    // ตั้งข้อความระบุรหัสตัวที่ซ้ำ
    messageEl.innerHTML = `รหัสที่ดึงได้ <strong style="color:#ef4444; font-family: monospace;">"${text}"</strong> มีบันทึกในระบบประวัติเรียบร้อยแล้ว`;

    // เปิดแสดงป๊อปอัป
    modal.classList.add('active');
}

// 🔓 ปลดล็อกระบบสแกนเมื่อผู้ใช้กดปิดหน้าต่างแจ้งเตือน
function closeDuplicateModal() {
    const modal = document.getElementById('duplicate-modal');
    modal.classList.remove('active');

    // หน่วงเวลาสั้นๆ (0.5 วินาที) หลังป๊อปอัปหายไป เพื่อความพร้อมในการสแกนรหัสอื่นต่อ
    setTimeout(() => {
        isProcessing = false;
        console.log("ระบบพร้อมสแกนต่อแล้ว...");
    }, 500);
}

// 🎯 ฟังก์ชันสแกนสำเร็จ
function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true; // ล็อกการทำงานทันที

    // 1. ตัดช่องว่างหัวท้ายที่อาจติดมาในรหัส QR
    const cleanedText = decodedText ? decodedText.trim() : "";
    const splitElement = document.getElementById('result-split');

    // 🛡️ ป้องกันค่าว่างดิบ
    if (cleanedText === "") {
        playBeepSound('warning');
        document.getElementById('result-all').innerText = "สแกนสำเร็จแต่พบข้อความว่างเปล่า";
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ค่าที่สแกนได้เป็นค่าว่าง (ไม่เก็บประวัติ)</span>`;

        // ปลดล็อกระบบอย่างรวดเร็วเพื่อสแกนใบอื่น
        setTimeout(() => {
            isProcessing = false;
        }, 1500);
        return;
    }

    const startIndex = 8;
    const endIndex = 30;
    let extractedText = "";

    // 2. ตรวจสอบเงื่อนไขความยาว 22 Digits
    if (cleanedText.length >= endIndex) {
        extractedText = cleanedText.substring(startIndex, endIndex).trim();
        const digitCount = extractedText.length;

        if (digitCount !== 22) {
            playBeepSound('warning');
            document.getElementById('result-all').innerText = cleanedText;
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ข้อมูลไม่ตรงมาตรฐาน (${digitCount} Digits / ต้องการ 22)</span>`;

            // ไม่ตรงมาตรฐาน ปลดล็อกเร็ว (1.5 วินาที) เพื่อสแกนใบใหม่
            setTimeout(() => {
                isProcessing = false;
            }, 1500);
            return;
        }

        // 🔍 ตรวจสอบความซ้ำในประวัติ
        const isDuplicate = scanHistoryList.some(item => item.text === extractedText);

        if (isDuplicate) {
            playBeepSound('warning'); // แจ้งเสียงเตือนซ้ำ

            document.getElementById('result-all').innerText = cleanedText;
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">⚠️ ตรวจพบค่าซ้ำ: ${extractedText}</span>`;

            // 🚨 เรียกแสดงผลลัพธ์ผ่าน Popup หน้าจอ เพื่อหยุดระบบ
            showDuplicateModal(extractedText);

            // ⛔ ยุติการทำงานและไม่ยอมรันตัวสแกนต่อจนกว่าผู้ใช้จะกดปุ่ม "ตกลง" เพื่อเคลียร์สถานะในฟังก์ชัน closeDuplicateModal()
            return;
        }

        // ✅ ผ่านเกณฑ์ความถูกต้องทั้งหมด (ไม่ว่าง, ไม่ซ้ำ, และมี 22 Digits พอดี)
        playBeepSound('success');

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

        // ปลดล็อกระบบอย่างรวดเร็ว
        setTimeout(() => {
            isProcessing = false;
        }, 1500);
        return;
    }

    // กรณีสแกนค่าปกติผ่านสำเร็จ พักวงจรสแกน 2.5 วินาที
    setTimeout(() => {
        isProcessing = false;
    }, 2500);
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
                // คอมคอมพิวเตอร์ทั่วไปสลับไปกล้องหน้า
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
