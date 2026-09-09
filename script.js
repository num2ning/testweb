// script.js

let html5QrCode;
let isProcessing = false;

// เปลี่ยนโครงสร้างตัวแปรเพื่อเก็บวัตถุประวัติ { text: 'ข้อมูล', time: 'เวลา' }
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

// ⏳ ดึงเวลาปัจจุบันของผู้ใช้ในฟอร์แมต HH:MM:SS น.
function getCurrentTimeFormatted() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds} น.`;
}

// 🔄 อัปเดตและแสดงตารางรายการประวัติ (Table Row Builder)
function updateHistoryUI() {
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = ''; // ล้างตารางเดิมเพื่อแสดงตารางอัปเดตใหม่

    // ตรวจสอบว่ามีรายการในประวัติหรือไม่ หากไม่มีให้ใส่แถวว่าง
    if (scanHistoryList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 1.5rem;">ยังไม่มีประวัติการสแกนเข้าสู่ระบบ</td></tr>`;
        return;
    }

    // วาดแถวตารางย้อนกลับ (รายการสแกนล่าสุดจะเด้งไปแสดงอยู่ข้างบนสุดเพื่อให้อ่านง่าย)
    // หากต้องการให้ของใหม่อยู่ล่างสุด ให้เปลี่ยนเป็นลูปแบบปกติได้ครับ
    for (let i = scanHistoryList.length - 1; i >= 0; i--) {
        const item = scanHistoryList[i];

        const row = document.createElement('tr');

        // 1. คอลัมน์ ลำดับรายการ
        const cellIndex = document.createElement('td');
        cellIndex.className = 'col-index';
        cellIndex.innerText = i + 1;

        // 2. คอลัมน์ ข้อความที่ตัดได้
        const cellData = document.createElement('td');
        cellData.className = 'col-data';
        cellData.innerText = item.text;

        // 3. คอลัมน์ เวลาสแกน
        const cellTime = document.createElement('td');
        cellTime.className = 'col-time';
        cellTime.innerText = item.time;

        row.appendChild(cellIndex);
        row.appendChild(cellData);
        row.appendChild(cellTime);

        tbody.appendChild(row);
    }
}

// 📥 ดาวน์โหลดประวัติทั้งหมดเป็นไฟล์ข้อความ (.txt)
function downloadHistory() {
    if (scanHistoryList.length === 0) {
        alert("ยังไม่มีข้อมูลประวัติการสแกนให้ดาวน์โหลดครับ");
        return;
    }

    // รวมข้อมูลเฉพาะส่วน 'รหัสข้อความที่ตัดแล้ว' คั่นด้วยการขึ้นบรรทัดใหม่
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
    isProcessing = true;

    const startIndex = 8; // ข้อความตัวอักษรตำแหน่งที่ 9 (ดัชนี 8)
    const endIndex = 30;
    let extractedText = "";

    const splitElement = document.getElementById('result-split');

    if (decodedText.length >= startIndex) {
        extractedText = decodedText.substring(startIndex, endIndex);

        // 🔍 ค้นหาค่าซ้ำภายในอาร์เรย์ (แมพหาเฉพาะฟิลด์ .text)
        const isDuplicate = scanHistoryList.some(item => item.text === extractedText);

        if (isDuplicate) {
            playBeepSound('warning'); // แจ้งเตือนเสียงทุ้มต่ำ

            document.getElementById('result-all').innerText = decodedText;
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">⚠️ ข้อความนี้สแกนไปแล้ว: ${extractedText}</span>`;

            setTimeout(() => {
                isProcessing = false;
            }, 1000);

            return;
        }

        // ✅ ผ่านเกณฑ์ความซ้ำซ้อน (รหัสใหม่)
        playBeepSound('success'); // แจ้งเตือนติ๊ดผ่านสำเร็จ

        document.getElementById('result-all').innerText = decodedText;
        splitElement.innerHTML = `<span style="color: #10b981; font-weight: 700;">${extractedText}</span>`;

        // เก็บทั้ง "ข้อความที่ตัดแล้ว" และ "เวลาปัจจุบันที่สแกนเสร็จ"
        scanHistoryList.push({
            text: extractedText,
            time: getCurrentTimeFormatted()
        });

        updateHistoryUI(); // วาดตารางใหม่

    } else {
        playBeepSound('warning');
        document.getElementById('result-all').innerText = decodedText;
        splitElement.innerText = "❌ ข้อความสั้นเกินไป (ไม่ถึง 9 ตัวอักษร)";
    }

    // พักวงจรสแกน 2.5 วินาทีเพื่อเปิดโอกาสให้เลื่อนแผ่นรหัสใหม่เข้ามา
    setTimeout(() => {
        isProcessing = false;
    }, 2500);
}

function startScanner() {
    html5QrCode = new Html5Qrcode("reader");
    document.getElementById('start-btn').style.display = 'none';

    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess
    ).then(() => {
        document.getElementById('overlay').style.display = 'flex';
        updateHistoryUI(); // วาดตารางว่างเปล่าเริ่มต้นเมื่อกล้องเปิดทำงานสำเร็จ
    }).catch(err => {
        document.getElementById('start-btn').style.display = 'inline-block';
        alert("❌ เปิดกล้องไม่สำเร็จ: " + err);
    });
}
