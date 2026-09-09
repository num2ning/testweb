// script.js

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

// 🚨 🚨 จัดการหน้าต่างป๊อปอัป (Popup Modal Logic) 🚨 🚨
function showDuplicateModal(text) {
    const modal = document.getElementById('duplicate-modal');
    const messageEl = document.getElementById('modal-dup-message');

    // ตั้งข้อความระบุรหัสตัวที่ซ้ำ
    messageEl.innerHTML = `รหัสที่ดึงได้ <strong style="color:#ef4444; font-family: monospace;">"${text}"</strong> มีบันทึกในระบบประวัติเรียบร้อยแล้ว`;

    // เปิดแสดงป๊อปอัป
    modal.classList.add('active');
}

function closeDuplicateModal() {
    const modal = document.getElementById('duplicate-modal');
    modal.classList.remove('active');

    // 🔓 ปลดล็อกระบบสแกนหลังจากที่ผู้ใช้กดปิดหน้าต่างแจ้งเตือนและนำแผ่นออกไปแล้ว
    // ป้องกันการลูปภาพกล้องตัวเดิมซ้ำหลังป๊อปอัปปิด
    setTimeout(() => {
        isProcessing = false;
    }, 1500);
}

// 🎯 ฟังก์ชันสแกนสำเร็จ
function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true; // ล็อกการทำงานทันที

    const startIndex = 8;
    const endIndex = 30;
    let extractedText = "";

    const splitElement = document.getElementById('result-split');

    if (decodedText.length >= startIndex) {
        extractedText = decodedText.substring(startIndex, endIndex);

        // 🔍 ตรวจสอบหาความซ้ำในประวัติ
        const isDuplicate = scanHistoryList.some(item => item.text === extractedText);

        if (isDuplicate) {
            playBeepSound('warning'); // แจ้งเสียงเตือนซ้ำ

            // แสดงผลลัพธ์บนจอเว็บแบบดั้งเดิมให้เห็น
            document.getElementById('result-all').innerText = decodedText;
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">⚠️ ตรวจพบค่าซ้ำ: ${extractedText}</span>`;

            // 🚨 เรียกแสดงผลลัพธ์ผ่าน Popup หน้าจอ เพื่อให้ยืนยันตัวตน
            showDuplicateModal(extractedText);

            // ยุติการไหลของโปรแกรม (ไม่ปลดล็อก isProcessing จนกว่าจะคลิกปุ่มตกลง)
            return;
        }

        // ✅ ผ่านเกณฑ์ ไม่ซ้ำในประวัติ (รหัสใหม่)
        playBeepSound('success');

        document.getElementById('result-all').innerText = decodedText;
        splitElement.innerHTML = `<span style="color: #10b981; font-weight: 700;">${extractedText}</span>`;

        scanHistoryList.push({
            text: extractedText,
            time: getCurrentTimeFormatted()
        });

        updateHistoryUI();

    } else {
        playBeepSound('warning');
        document.getElementById('result-all').innerText = decodedText;
        splitElement.innerText = "❌ ข้อความสั้นเกินไป (ไม่ถึง 9 ตัวอักษร)";
    }

    // สแกนรหัสผ่านสำเร็จ พักวงจรไว้ 2.5 วินาที เพื่อสลับแผ่นคิวอาร์แผ่นใหม่
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
        updateHistoryUI();
    }).catch(err => {
        document.getElementById('start-btn').style.display = 'inline-block';
        alert("❌ เปิดกล้องไม่สำเร็จ: " + err);
    });
}
