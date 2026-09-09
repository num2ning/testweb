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
            // เสียงทุ้มสั้นๆ แสดงว่าซ้ำหรือคำสั้นไป ⚠️
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

    // เลื่อน Scrollbar ลงด้านล่างสุดเมื่อมีประวัติเพิ่มขึ้น
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

// 🎯 ฟังก์ชันจัดการผลลัพธ์การสแกน (แก้ไขตรรกะตรวจเช็คซ้ำอย่างเข้มงวด)
function onScanSuccess(decodedText, decodedResult) {
    // 🛡️ ชั้นป้องกันที่ 1: ตรวจสอบสถานะการประมวลผลก่อนเป็นอันดับแรกสุดเพื่อล็อกระบบ
    if (isProcessing) return;
    isProcessing = true;

    // ดึงตำแหน่งของข้อมูลตัวอักษรที่ต้องการ (ตำแหน่งที่ 9 ถึง 30)
    const startIndex = 8; // อิงตาม Index 8 (ซึ่งคือตัวอักษรตัวที่ 9)
    const endIndex = 30;
    let extractedText = "";

    const splitElement = document.getElementById('result-split');

    if (decodedText.length >= startIndex) {
        // ตัดคำเฉพาะตำแหน่ง 9 ถึง 30 ออกมาก่อนทำการตรวจสอบใดๆ
        extractedText = decodedText.substring(startIndex, endIndex);

        // 🛡️ ชั้นป้องกันที่ 2: ตรวจสอบหาความซ้ำซ้อนในประวัติ (History Array) ด้วยค่าที่ตัดออกมาแล้ว
        if (scanHistoryList.includes(extractedText)) {
            // 🚨 กรณีที่พบค่าซ้ำในระบบประวัติ:
            playBeepSound('warning'); // แจ้งเตือนด้วยเสียงทุ้มต่ำ

            // แสดงผลบนหน้าจอว่าซ้ำ
            document.getElementById('result-all').innerText = decodedText;
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">⚠️ ข้อความนี้สแกนไปแล้ว: ${extractedText}</span>`;

            // ปลดล็อคอย่างรวดเร็ว (1 วินาที) เพื่อเปิดโอกาสให้ผู้ใช้นำ QR Code แผ่นอื่นมาสแกนต่อได้ทันที
            setTimeout(() => {
                isProcessing = false;
            }, 1000);

            return; // ⛔ ออกจากฟังก์ชันทันที โดยไม่นำค่าไปบันทึกลง History List
        }

        // ✅ กรณีผ่านการกรอง (เป็นค่าใหม่ ไม่ซ้ำแน่นอน):
        playBeepSound('success'); // เล่นเสียงสแกนผ่านสำเร็จ

        // อัปเดตข้อมูลการแสดงผลบนหน้าจอทั้ง 2 จุด
        document.getElementById('result-all').innerText = decodedText; // จุดแสดงข้อความเต็ม
        splitElement.innerHTML = `<span style="color: #10b981; font-weight: 700;">${extractedText}</span>`; // จุดแสดงเฉพาะ 9-30

        // เพิ่มค่าใหม่ลงในประวัติและอัปเดตหน้าจอทันที
        scanHistoryList.push(extractedText);
        updateHistoryUI();

    } else {
        // กรณีความยาวตัวอักษรไม่ถึงเกณฑ์ที่กำหนด
        playBeepSound('warning');
        document.getElementById('result-all').innerText = decodedText;
        splitElement.innerText = "❌ ข้อความสั้นเกินไป (ไม่ถึง 9 ตัวอักษร)";
    }

    // หน่วงเวลาสแกนปกติ 2.5 วินาที เพื่อหลีกเลี่ยงสตรีมวีดิโอจับภาพซ้ำรัวๆ
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
