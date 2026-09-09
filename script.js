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
            // เสียงติ๊ดสูงสั้นๆ แสดงว่าผ่าน 👍
            oscillator.type = 'sine';
            oscillator.frequency.value = 1200;
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.12);
        } else if (type === 'warning') {
            // เสียงทุ้มสั้นๆ 2 ครั้ง แสดงว่าซ้ำหรือเตือน ⚠️
            oscillator.type = 'triangle';
            oscillator.frequency.value = 300; // เสียงทุ้มต่ำ
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.15);
        }
    } catch (e) {
        console.warn("Audio Context blocked", e);
    }
}

function updateHistoryUI() {
    const ul = document.getElementById('history-ul');
    ul.innerHTML = '';

    scanHistoryList.forEach(text => {
        const li = document.createElement('li');
        li.innerText = text;
        ul.appendChild(li);
    });

    ul.scrollTop = ul.scrollHeight;
}

function downloadHistory() {
    if (scanHistoryList.length === 0) {
        alert("ยังไม่มีข้อมูลประวัติการสแกนให้ดาวน์โหลดครับ");
        return;
    }

    const textContent = scanHistoryList.join('\n');
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

// 🎯 ฟังก์ชันจัดการผลลัพธ์การสแกน (ปรับปรุงเพิ่มการตรวจสอบค่าซ้ำ)
function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true; // ล็อคระบบเพื่อรอการหน่วงเวลา

    // 1. แสดงข้อความเต็มทั้งหมดบนหน้าเว็บให้เห็นก่อนเสมอ
    document.getElementById('result-all').innerText = decodedText;

    const startIndex = 8;
    const endIndex = 30;
    let extractedText = "";

    const splitElement = document.getElementById('result-split');

    if (decodedText.length >= startIndex) {
        extractedText = decodedText.substring(startIndex, endIndex);

        // 🔍 [จุดสำคัญ] ตรวจสอบว่ามีข้อมูลที่ตัดใหม่นี้อยู่ในประวัติแล้วหรือยัง
        if (scanHistoryList.includes(extractedText)) {

            // 🚨 กรณีพบข้อมูลซ้ำ:
            playBeepSound('warning'); // เล่นเสียงเตือนทุ้มต่ำ
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">⚠️ ข้อความนี้สแกนไปแล้ว: ${extractedText}</span>`;

        } else {

            // ✅ กรณีข้อมูลใหม่ (ไม่ซ้ำ):
            playBeepSound('success'); // เล่นเสียงติ๊ดสแกนผ่านสำเร็จ
            splitElement.innerHTML = `<span style="color: #10b981; font-weight: 700;">${extractedText}</span>`;

            // บันทึกเข้าประวัติและอัปเดตหน้าจอ
            scanHistoryList.push(extractedText);
            updateHistoryUI();
        }

    } else {
        playBeepSound('warning');
        splitElement.innerText = "❌ ข้อความสั้นเกินไป (ไม่ถึง 9 ตัวอักษร)";
    }

    // หน่วงเวลา 2.5 วินาทีเพื่อให้เวลาผู้ใช้อ่านผลและสลับแผ่น QR Code
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
    }).catch(err => {
        document.getElementById('start-btn').style.display = 'inline-block';
        alert("❌ เปิดกล้องไม่สำเร็จ: " + err);
    });
}
