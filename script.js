

let html5QrCode;
let isProcessing = false;
let scanHistoryList = [];


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


function getCurrentTimeFormatted() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds} น.`;
}


function updateHistoryUI() {
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '';

    if (scanHistoryList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 1.5rem;">ไม่มีข้อมูล</td></tr>`;
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

function downloadHistory() {
    if (scanHistoryList.length === 0) {
        alert("ไม่มีข้อมูล");
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


function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true;


    const cleanedText = decodedText ? decodedText.trim() : "";
    const splitElement = document.getElementById('result-split');


    if (cleanedText === "") {
        playBeepSound('warning');
        document.getElementById('result-all').innerText = "สแกนสำเร็จแต่พบข้อความว่างเปล่า";
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ค่าที่สแกนได้เป็นค่าว่าง </span>`;


        setTimeout(() => {
            isProcessing = false;
        }, 1500);
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
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ไม่ใช่รหัสครุภัณฑ์ที่ถูกต้อง (${digitCount} Digits / 22)</span>`;


            setTimeout(() => {
                isProcessing = false;
            }, 1500);
            return;
        }


        const isDuplicate = scanHistoryList.some(item => item.text === extractedText);

        if (isDuplicate) {
            playBeepSound('warning');

            document.getElementById('result-all').innerText = cleanedText;
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">⚠️ ตรวจพบค่าซ้ำ: ${extractedText}</span>`;


            setTimeout(() => {
                isProcessing = false;
                console.log("ล้างสถานะล็อกหลังเจอค่าซ้ำเรียบร้อย...");
            }, 1500);
            return;
        }


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
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ข้อความสั้นเกินไป (สั้นกว่า 22 ตัวอักษร)</span>`;


        setTimeout(() => {
            isProcessing = false;
        }, 1500);
        return;
    }


    setTimeout(() => {
        isProcessing = false;
    }, 2500);
}


// script.js (แทนที่ฟังก์ชัน startScanner ด้วยเวอร์ชันเสถียรภาพสูง ป้องกันกล้องดับวูบ)

// 🎥 ฟังก์ชันเปิดกล้อง (ฉบับแก้ไขปัญหากล้องดับวูบบนมือถือ Android/iOS)
// 🎥 ฟังก์ชันเปิดกล้อง (ปรับปรุงประสิทธิภาพการจับภาพและระบบ Auto-Focus เพื่อการสแกนที่รวดเร็ว)
function startScanner() {
    document.getElementById('start-btn').style.display = 'none';

    document.getElementById('result-all').innerHTML = "<span style='color:#3b82f6;'>กำลังเชื่อมต่อกับฮาร์ดแวร์กล้อง...</span>";

    if (html5QrCode) {
        try { html5QrCode.clear(); } catch (e) { }
    }

    html5QrCode = new Html5Qrcode("reader");

    // ⚙️ การตั้งค่าที่ให้ภาพคมชัดและจับโฟกัสขอบ QR Code ได้แม่นยำที่สุด
    const config = {
        fps: 20, // ปรับมาที่ 20 fps เพื่อช่วยให้อัตราสแกนถี่ขึ้นโดยไม่โหลด CPU เกินไป

        // 🎯 ปรับปรุงสัดส่วนกล่องสแกนให้อยู่ที่ 65% ของหน้าจอ เพื่อให้กล้องสามารถจับภาพรอบนอกได้ชัดเจน
        qrbox: function (viewfinderWidth, viewfinderHeight) {
            let minEdgePercentage = 0.65;
            let minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
            // ป้องกันขนาดกล่องเล็กเกินไปจนถือเล็งยาก (ขั้นต่ำสุด 200px)
            let qrboxSize = Math.max(Math.floor(minEdgeSize * minEdgePercentage), 200);

            return {
                width: qrboxSize,
                height: qrboxSize
            };
        }
    };

    // 🎥 กำหนดสเปกของกล้องที่ต้องการ (บังคับให้ระบบเลือกความคมชัดระดับ HD และเปิดโฟกัสสูงสุด)
    const cameraConfig = {
        facingMode: "environment", // บังคับกล้องหลังมือถือ

        // 🎯 บังคับให้เบราว์เซอร์สุ่มความละเอียดภาพที่ระดับความละเอียด HD 720p 
        // ซึ่งเป็นระยะที่อ่านจุด QR Code ขนาดเล็กได้ดีที่สุด และไม่ทำให้หน้าจอกระตุก
        videoConstraints: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            // สั่งเปิดระบบโฟกัสแบบต่อเนื่องแบบเรียลไทม์ (Continuous Auto-Focus)
            focusMode: { ideal: "continuous" }
        }
    };

    // เริ่มเปิดใช้งานกล้อง
    html5QrCode.start(
        cameraConfig,
        config,
        onScanSuccess
    ).then(() => {
        document.getElementById('overlay').style.display = 'flex';
        document.getElementById('result-all').innerText = "กล้องทำงานปกติ กรุณาถือโทรศัพท์ห่างจาก QR Code ประมาณ 15-20 ซม.";
        updateHistoryUI();
    }).catch(err => {
        console.warn("ไม่สามารถเปิดกล้องหลังแบบความคมชัดสูงได้ ลองสลับแผนสำรอง...", err);

        // 🔄 แผนสำรอง: หากกล้องหลังแบบ HD มีปัญหา ให้เปิดกล้องมาตรฐานของอุปกรณ์
        html5QrCode.start(
            { facingMode: "environment" }, // ใช้ค่าเริ่มต้นไร้ข้อจำกัด Resolution
            { fps: 20, qrbox: { width: 220, height: 220 } },
            onScanSuccess
        ).then(() => {
            document.getElementById('overlay').style.display = 'flex';
            document.getElementById('result-all').innerText = "กล้องทำงานปกติ (โหมดภาพมาตรฐาน)";
            updateHistoryUI();
        }).catch(fallbackErr => {
            document.getElementById('start-btn').style.display = 'inline-block';
            const errorMsg = fallbackErr.message || fallbackErr;
            document.getElementById('result-all').innerHTML = `<span style="color:#ef4444; font-weight:bold;">Error: ${errorMsg}</span>`;
            alert("❌ ไม่สามารถสตาร์ทระบบกล้องได้:\n" + errorMsg);
        });
    });
}






function clearHistory() {

    const confirmClear = confirm("คุณต้องการลบรายการครุภัณฑ์ทั้งหมดใช่หรือไม่?\n(ข้อมูลทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้)");

    if (confirmClear) {

        scanHistoryList = [];


        updateHistoryUI();


        document.getElementById('result-all').innerText = "รอสแกนแผ่นใหม่...";
        document.getElementById('result-split').innerText = "-";


        playBeepSound('warning');

        console.log("ลบรายการครุภัณฑ์เรียบร้อยแล้ว");
    }
}

// script.js (เพิ่มโค้ดตรวจเช็คสถานะกล้องอัตโนมัติเมื่อโหลดหน้าเว็บ)

// 🩺 ฟังก์ชันหลักสำหรับวิเคราะห์และตรวจโรคการทำงานของกล้อง
async function checkCameraStatus() {
    const diagBox = document.getElementById('diagnostic-box');
    const diagIcon = document.getElementById('diag-icon');
    const diagMsg = document.getElementById('diag-message');

    // 1. ตรวจสอบความปลอดภัย HTTPS (Secure Context)
    if (!window.isSecureContext) {
        diagBox.className = "diag-box diag-error";
        diagIcon.innerText = "❌";
        diagMsg.innerHTML = "<strong>ระบบไม่ปลอดภัย:</strong> คุณไม่ได้รันหน้าเว็บผ่าน HTTPS หรือ localhost เบราว์เซอร์จะบล็อกกล้อง 100% (กรุณาเปิดใช้ SSL/HTTPS)";
        return;
    }

    // 2. ตรวจสอบว่าเบราว์เซอร์และเครื่องมี API กล้องหรือไม่
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        diagBox.className = "diag-box diag-error";
        diagIcon.innerText = "❌";
        diagMsg.innerHTML = "<strong>อุปกรณ์ไม่รองรับ:</strong> เบราว์เซอร์หรืออุปกรณ์นี้ไม่มีพอร์ตการขอเปิดใช้งานกล้อง";
        return;
    }

    try {
        // 3. ตรวจเช็คว่ามีอุปกรณ์กล้องอยู่บนตัวเครื่องจริงๆ ไหม
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');

        if (cameras.length === 0) {
            diagBox.className = "diag-box diag-error";
            diagIcon.innerText = "🔌";
            diagMsg.innerHTML = "<strong>ไม่พบกล้อง:</strong> ไม่พบกล้องเว็บแคมหรือตัวอุปกรณ์เลนส์บนเครื่องชิ้นนี้";
            return;
        }

        // 4. ตรวจเช็คสถานะสิทธิ์การเข้าถึง (Camera Permissions)
        if (navigator.permissions && navigator.permissions.query) {
            const permissionStatus = await navigator.permissions.query({ name: 'camera' });

            if (permissionStatus.state === 'granted') {
                diagBox.className = "diag-box diag-ready";
                diagIcon.innerText = "✅";
                diagMsg.innerHTML = "<strong>พร้อมใช้งาน:</strong> อุปกรณ์และสิทธิ์การเข้าถึงกล้องสมบูรณ์พร้อมเริ่มสแกน";
            } else if (permissionStatus.state === 'prompt') {
                diagBox.className = "diag-box diag-warn";
                diagIcon.innerText = "🔔";
                diagMsg.innerHTML = "<strong>รอการเปิดสิทธิ์:</strong> ระบบพร้อมใช้งานแล้ว กรุณากด <strong>'อนุญาต (Allow)'</strong> เมื่อกล้องถามหาขอสิทธิ์";
            } else if (permissionStatus.state === 'denied') {
                diagBox.className = "diag-box diag-error";
                diagIcon.innerText = "🚫";
                diagMsg.innerHTML = "<strong>กล้องโดนบล็อก:</strong> คุณเคยปฏิเสธสิทธิ์กล้องไว้ กรุณากดไอคอนแม่กุญแจข้างแถบพิมพ์ URL เพื่อปลดล็อกอนุญาต";
            }

            // ดักจับการสลับเปลี่ยนสิทธิ์ของผู้ใช้แบบเรลไทม์
            permissionStatus.onchange = () => {
                checkCameraStatus(); // รันตรวจเช็คใหม่เมื่อสิทธิ์เปลี่ยนแปลง
            };
        } else {
            // กรณีเป็นเบราว์เซอร์เก่าบางรุ่นที่ไม่รองรับ Permissions Query API แต่มีกล้องปกติ
            diagBox.className = "diag-box diag-ready";
            diagIcon.innerText = "✅";
            diagMsg.innerHTML = "<strong>พร้อมใช้งาน:</strong> ตรวจพบฮาร์ดแวร์กล้องแล้ว (กดปุ่มด้านล่างเพื่อเริ่มขอสิทธิ์สแกน)";
        }

    } catch (error) {
        diagBox.className = "diag-box diag-error";
        diagIcon.innerText = "❌";
        diagMsg.innerHTML = "<strong>เกิดข้อผิดพลาดในการวิเคราะห์:</strong> " + error.message;
        console.error("Diagnostic error: ", error);
    }
}

// 🚀 สั่งรันวิเคราะห์สถานะกล้องทันทีที่เปิดหน้าเว็บขึ้นมา
window.addEventListener('DOMContentLoaded', checkCameraStatus);


