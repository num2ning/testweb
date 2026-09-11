// script.js (ฉบับปรับปรุงตรรกะความปลอดภัยสูง แก้ปัญหาจอค้าง 100%)

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

// ⏳ บันทึกเวลาปัจจุบัน
function getCurrentTimeFormatted() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds} น.`;
}

// 🔄 อัปเดต UI รายการตารางประวัติ
function updateHistoryUI() {
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '';

    if (scanHistoryList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 1.5rem;">ยังไม่มีประวัติการสแกนเข้าสู่ระบบ</td></tr>`;
        return;
    }

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

// 🎯 ฟังก์ชันสแกนสำเร็จ
function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true; // ล็อกระบบสแกนชั่วคราวเพื่อประมวลผลข้อมูล

    const cleanedText = decodedText ? decodedText.trim() : "";
    const splitElement = document.getElementById('result-split');

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

        const isDuplicate = scanHistoryList.some(item => item.text === extractedText);

        if (isDuplicate) {
            playBeepSound('warning');
            document.getElementById('result-all').innerText = cleanedText;
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">⚠️ รหัสนี้ถูกสแกนไปแล้ว: ${extractedText}</span>`;
            setTimeout(() => { isProcessing = false; }, 1500);
            return;
        }

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
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ รหัสต้นฉบับยาว ${cleanedText.length} หลัก (สั้นเกินไป ไม่สามารถดึงตำแหน่งที่ 9-30 ได้)</span>`;
        setTimeout(() => { isProcessing = false; }, 1500);
        return;
    }

    setTimeout(() => {
        isProcessing = false;
    }, 2500);
}

// 🩺 ฟังก์ชันหลักสำหรับวิเคราะห์และตรวจสอบระบบกล้อง (ตรรกะใหม่ ปลอดภัยสูงสุด ไม่นำพาจอค้าง)
async function checkCameraStatus() {
    const diagBox = document.getElementById('diagnostic-box');
    const diagIcon = document.getElementById('diag-icon');
    const diagMsg = document.getElementById('diag-message');

    // ตรวจสอบขั้นต้น
    if (!diagBox || !diagIcon || !diagMsg) return;

    // 1. ตรวจสอบความปลอดภัย HTTPS (Secure Context)
    if (!window.isSecureContext) {
        diagBox.className = "diag-box diag-error";
        diagIcon.innerText = "❌";
        diagMsg.innerHTML = "<strong>ระบบไม่ปลอดภัย:</strong> คุณไม่ได้ใช้งานผ่าน HTTPS หรือ localhost เบราว์เซอร์จะบล็อกกล้อง 100%";
        return;
    }

    // 2. ตรวจสอบว่าเบราว์เซอร์รองรับ API กล้องหรือไม่
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        diagBox.className = "diag-box diag-error";
        diagIcon.innerText = "❌";
        diagMsg.innerHTML = "<strong>อุปกรณ์ไม่รองรับ:</strong> เบราว์เซอร์หรืออุปกรณ์นี้ไม่มีพอร์ตสำหรับเรียกเปิดกล้อง";
        return;
    }

    try {
        // 3. ตรวจสอบจำนวนเลนส์กล้องที่มีจริงบนเครื่อง
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');

        if (cameras.length === 0) {
            diagBox.className = "diag-box diag-error";
            diagIcon.innerText = "🔌";
            diagMsg.innerHTML = "<strong>ไม่พบกล้อง:</strong> ไม่พบกล้องเว็บแคมหรือเลนส์ถ่ายภาพบนเครื่องนี้";
            return;
        }

        // 4. ตรวจสอบสิทธิ์การเข้าถึง (Safe Permissions Query)
        // ใส่ try-catch ซ้อนภายใน เพื่อป้องกันไม่ให้เบราว์เซอร์ที่ไม่มี Permission Query API แครชเงียบ
        let permissionGranted = false;
        try {
            if (navigator.permissions && navigator.permissions.query) {
                const permissionStatus = await navigator.permissions.query({ name: 'camera' });

                if (permissionStatus.state === 'granted') {
                    permissionGranted = true;
                } else if (permissionStatus.state === 'prompt') {
                    diagBox.className = "diag-box diag-warn";
                    diagIcon.innerText = "🔔";
                    diagMsg.innerHTML = "<strong>รออนุญาต:</strong> พร้อมใช้งาน กรุณากด <strong>'อนุญาต (Allow)'</strong> เมื่อระบบขอใช้กล้อง";
                    return;
                } else if (permissionStatus.state === 'denied') {
                    diagBox.className = "diag-box diag-error";
                    diagIcon.innerText = "🚫";
                    diagMsg.innerHTML = "<strong>กล้องถูกบล็อก:</strong> กรุณากดปุ่มแม่กุญแจข้างแถบ URL และเปลี่ยนสิทธิ์เป็น 'อนุญาต'";
                    return;
                }

                // สังเกตการณ์ตรวจจับกรณีสลับเปลี่ยนสิทธิ์
                permissionStatus.onchange = () => {
                    checkCameraStatus();
                };
            }
        } catch (permissionError) {
            console.warn("ไม่รองรับ Permissions API ในระดับลึก แต่ตรวจพบอุปกรณ์กล้องปกติ", permissionError);
        }

        // หากผ่านเกณฑ์ทั้งหมดเสร็จสิ้น หรือเบราว์เซอร์ผ่านกลไกการจองพอร์ต
        diagBox.className = "diag-box diag-ready";
        diagIcon.innerText = "✅";
        diagMsg.innerHTML = "<strong>ระบบพร้อมใช้งาน:</strong> ตรวจพบอุปกรณ์กล้องแล้ว กดปุ่มด้านล่างเพื่อเริ่มการสแกน";

    } catch (error) {
        // ดักจับข้อยกเว้นทุกประการและแสดงเป็นข้อความความล้มเหลว แทนการปล่อยให้แอปค้างเงียบ
        diagBox.className = "diag-box diag-error";
        diagIcon.innerText = "⚠️";
        diagMsg.innerHTML = "<strong>การตรวจสอบระบบล้มเหลว:</strong> " + error.message;
        console.error("Diagnostic failed: ", error);
    }
}

// 🎥 เริ่มสแกนกล้อง
function startScanner() {
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('result-all').innerHTML = "<span style='color:#3b82f6;'>กำลังประมวลผลภาพกล้อง...</span>";

    if (html5QrCode) {
        try { html5QrCode.clear(); } catch (e) { }
    }

    html5QrCode = new Html5Qrcode("reader");

    const config = {
        fps: 15,
        qrbox: 250,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
    };

    const cameraConstraints = {
        facingMode: "environment",
        videoConstraints: {
            width: { ideal: 640 },
            height: { ideal: 480 }
        }
    };

    html5QrCode.start(
        cameraConstraints,
        config,
        onScanSuccess
    ).then(() => {
        document.getElementById('overlay').style.display = 'flex';
        document.getElementById('result-all').innerText = "กล้องพร้อมใช้งาน กรุณานำ QR Code มาจ่อตรงกลางกรอบ";
        updateHistoryUI();

        // เมื่อกล้องเปิดใช้งานสำเร็จ ให้ซ่อนกล่องสถานะตรวจสอบ Diagnostic ไปเพื่อความสะอาดของหน้าจอ
        const diagBox = document.getElementById('diagnostic-box');
        if (diagBox) diagBox.style.display = 'none';

    }).catch(err => {
        console.warn("ไม่สามารถรันกล้องหลังแบบกำหนดสเปกได้ สลับเข้าสู่โหมดกล้องอัตโนมัติ...", err);

        html5QrCode.start(
            { facingMode: "environment" },
            { fps: 15, qrbox: 220 },
            onScanSuccess
        ).then(() => {
            document.getElementById('overlay').style.display = 'flex';
            document.getElementById('result-all').innerText = "กล้องพร้อมใช้งาน (โหมดมาตรฐาน)";
            updateHistoryUI();

            const diagBox = document.getElementById('diagnostic-box');
            if (diagBox) diagBox.style.display = 'none';
        }).catch(fallbackErr => {
            document.getElementById('start-btn').style.display = 'inline-block';
            document.getElementById('result-all').innerHTML = `<span style="color:#ef4444; font-weight:bold;">Error: ${fallbackErr}</span>`;
            alert("❌ ไม่สามารถเปิดระบบกล้องได้: " + fallbackErr);
        });
    });
}

// เรียกใช้การรันสถานะสุขภาพของกล้องเมื่อโหลดหน้าเว็บ
window.addEventListener('DOMContentLoaded', checkCameraStatus);
