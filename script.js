

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


function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true;


    const cleanedText = decodedText ? decodedText.trim() : "";
    const splitElement = document.getElementById('result-split');

    if (cleanedText === "") {
        playBeepSound('warning');
        document.getElementById('result-all').innerText = "สแกนสำเร็จแต่พบข้อความว่างเปล่า";
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ค่าที่สแกนได้เป็นค่าว่าง (ไม่เก็บประวัติ)</span>`;


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
            splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ไม่ใช่รหัสครุภัณฑ์ที่ถูกต้อง (${digitCount} Digits / ต้องการ 22)</span>`;


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


function startScanner() {
    document.getElementById('start-btn').style.display = 'none';

    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            html5QrCode = new Html5Qrcode("reader");


            const config = {
                fps: 30,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                disableFlip: false
            };

            html5QrCode.start(
                {
                    facingMode: "environment",

                    videoConstraints: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                },
                config,
                onScanSuccess
            ).then(() => {
                document.getElementById('overlay').style.display = 'flex';
                updateHistoryUI();
            }).catch(err => {
                console.warn("ไม่พบกล้องหลัง กำลังใช้งานกล้องตัวแรกสุด...", err);

                html5QrCode.start(
                    devices[0].id,
                    config,
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
        alert("❌ เบราว์เซอร์ปฏิเสธสิทธิ์การเข้าถึงกล้อง\nรายละเอียด: " + err);
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

