let html5QrCode;
let isProcessing = false;
let scanHistoryList = [];

function playBeepSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.value = 1200;
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.12);
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

function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true;

    playBeepSound();

    document.getElementById('result-all').innerText = decodedText;

    const startIndex = 8;
    const endIndex = 30;
    let extractedText = "";

    if (decodedText.length >= startIndex) {
        extractedText = decodedText.substring(startIndex, endIndex);
        document.getElementById('result-split').innerText = extractedText;

        scanHistoryList.push(extractedText);
        updateHistoryUI();

    } else {
        document.getElementById('result-split').innerText = "❌ ข้อความสั้นเกินไป (ไม่ถึง 9 ตัวอักษร)";
    }

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
