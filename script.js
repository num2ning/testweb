// --- Global Variables ---
let html5QrCode;
let isProcessing = false;
let scanHistoryList = [];


// --- 1. UI & Notification System (NEW) ---
/**
 * แสดงการแจ้งเตือนแบบ Toast บนหน้าจอ
 * @param {string} message ข้อความที่จะแสดง
 * @param {string} type ประเภทการแจ้งเตือน ('success', 'error', 'info')
 * @param {number} duration ระยะเวลาที่แสดง (ms)
 */
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.error("Toast container not found!");
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Animate out and remove
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }, duration);
}


// --- 2. Audio Feedback (UPDATED) ---
/**
 * เล่นเสียง Beep ตามสถานะ
 * @param {string} type ประเภทเสียง ('success', 'error', 'warning')
 */
function playBeepSound(type = 'success') {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);

        switch (type) {
            case 'success':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.12);
                break;
            case 'error': // เสียง Error ที่ชัดเจนขึ้น
                oscillator.type = 'sawtooth';
                gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
                oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
                oscillator.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 0.2);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.25);
                break;
            case 'warning': // เสียงเตือนสั้นๆ 2 ครั้ง
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.08);
                // สามารถเพิ่มเสียงครั้งที่ 2 ได้ถ้าต้องการ
                break;
        }
    } catch (e) {
        console.warn("Audio Context blocked", e);
    }
}


// --- 3. Core Logic & Data Handling (REFACTORED) ---

/**
 * (NEW) แยก Logic การตัดรหัสครุภัณฑ์ออกมา
 * @param {string} rawText ข้อความดิบที่ได้จากการสแกน
 * @returns {{extractedText: string, cutMethodMessage: string}} Object ที่มีรหัสที่ตัดแล้วและข้อความอธิบาย
 */
function extractAssetCode(rawText) {
    const cleanedText = rawText ? rawText.trim() : "";
    let extractedText = "";
    let cutMethodMessage = "";

    if (cleanedText.length < 30) {
        extractedText = cleanedText.substring(0, 22).trim();
        cutMethodMessage = "(ตัดตำแหน่ง 1-22)";
    } else {
        extractedText = cleanedText.substring(8, 30).trim();
        cutMethodMessage = "(ตัดตำแหน่ง 9-30)";
    }
    return { extractedText, cutMethodMessage };
}


/**
 * (REFACTORED) ฟังก์ชันหลักเมื่อสแกน QR Code สำเร็จ
 * @param {string} decodedText - The decoded text from the QR code.
 * @param {object} decodedResult - The detailed result object from the scanner.
 */
function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true;

    const splitElement = document.getElementById('result-split');
    const allResultElement = document.getElementById('result-all');

    const handleProcessingEnd = (delay) => {
        setTimeout(() => { isProcessing = false; }, delay);
    };

    const cleanedText = decodedText ? decodedText.trim() : "";

    if (cleanedText === "") {
        playBeepSound('error');
        allResultElement.innerText = "สแกนสำเร็จแต่พบข้อความว่างเปล่า";
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ค่าที่สแกนได้เป็นค่าว่าง</span>`;
        handleProcessingEnd(1500);
        return;
    }

    const { extractedText, cutMethodMessage } = extractAssetCode(cleanedText);
    const digitCount = extractedText.length;

    if (digitCount !== 22) {
        playBeepSound('error');
        allResultElement.innerText = cleanedText;
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ไม่ใช่รหัสครุภัณฑ์ ${cutMethodMessage} (${digitCount}/22)</span>`;
        handleProcessingEnd(1500);
        return;
    }

    const isDuplicate = scanHistoryList.some(item => item.text === extractedText);

    if (isDuplicate) {
        playBeepSound('error');
        allResultElement.innerText = cleanedText;
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">⚠️ มีรหัสนี้ในรายการแล้ว: ${extractedText}</span>`;
        handleProcessingEnd(1500);
        return;
    }

    playBeepSound('success');
    allResultElement.innerText = cleanedText;
    splitElement.innerHTML = `<span style="color: #10b981; font-weight: 700;">${extractedText}</span>`;

    scanHistoryList.push({
        text: extractedText,
        time: new Date().toLocaleTimeString('th-TH') // ใช้ Format ที่ง่ายขึ้น
    });

    updateHistoryUI();
    handleProcessingEnd(2500);
}


// --- 4. Scanner & History Management (REFACTORED) ---

/**
 * (REFACTORED) เริ่มกระบวนการสแกน QR Code
 */
function startScanner() {
    const startBtn = document.getElementById('start-btn');
    startBtn.style.display = 'none';

    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            html5QrCode = new Html5Qrcode("reader");

            const startCamera = (config) => {
                return html5QrCode.start(config, { fps: 15, qrbox: { width: 250, height: 250 } }, onScanSuccess);
            };

            startCamera({ facingMode: "environment" })
                .then(() => {
                    document.getElementById('overlay').style.display = 'flex';
                    updateHistoryUI();
                })
                .catch(err => {
                    console.warn("ไม่พบกล้องหลัง, ลองใช้กล้องตัวแรก...", err);
                    // Fallback to the first camera
                    startCamera(devices[0].id)
                        .then(() => {
                            document.getElementById('overlay').style.display = 'flex';
                            updateHistoryUI();
                        })
                        .catch(fallbackErr => {
                            startBtn.style.display = 'inline-block';
                            showToast("❌ ไม่สามารถเปิดกล้องได้", 'error'); // ใช้ Toast
                            console.error("Error starting camera:", fallbackErr);
                        });
                });
        } else {
            startBtn.style.display = 'inline-block';
            showToast("❌ ไม่พบอุปกรณ์กล้องบนเครื่องนี้", 'error'); // ใช้ Toast
        }
    }).catch(err => {
        startBtn.style.display = 'inline-block';
        showToast("❌ โปรดอนุญาตให้เบราว์เซอร์ใช้กล้อง", 'error'); // ใช้ Toast
        console.error("Camera permission error:", err);
    });
}

/**
 * (REFACTORED) ล้างประวัติการสแกน
 */
function clearHistory() {
    if (scanHistoryList.length === 0) {
        showToast("ไม่มีรายการให้ลบ", 'info');
        return;
    }

    // แทนที่ confirm() ด้วย Custom Modal หรือใช้ Toast + Undo ในอนาคต
    // แต่เพื่อความง่ายจะใช้ confirm ชั่วคราวไปก่อน
    const confirmClear = confirm("คุณต้องการลบรายการครุภัณฑ์ทั้งหมดใช่หรือไม่?\n(ข้อมูลทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้)");

    if (confirmClear) {
        scanHistoryList = [];
        updateHistoryUI();
        document.getElementById('result-all').innerText = "รอสแกนแผ่นใหม่...";
        document.getElementById('result-split').innerText = "-";
        playBeepSound('warning');
        showToast("ลบประวัติทั้งหมดเรียบร้อยแล้ว", 'success');
        console.log("ลบรายการครุภัณฑ์ทั้งหมดเรียบร้อยแล้ว");
    }
}


// --- 5. DOM Manipulation & Utilities ---
// (No changes needed for updateHistoryUI, downloadHistory, but they remain part of the code)

function getCurrentTimeFormatted() {
    // แนะนำให้ใช้ toLocaleTimeString เพื่อความง่าย
    return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateHistoryUI() {
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '';

    if (scanHistoryList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 1.5rem;">ไม่มีรายการครุภัณฑ์</td></tr>`;
        return;
    }

    // เรียงจากใหม่ไปเก่า
    [...scanHistoryList].reverse().forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="col-index">${scanHistoryList.length - index}</td>
            <td class="col-data">${item.text}</td>
            <td class="col-time">${item.time}</td>
        `;
        tbody.appendChild(row);
    });
}


function downloadHistory() {
    if (scanHistoryList.length === 0) {
        showToast("ไม่มีข้อมูลให้ดาวน์โหลด", 'info');
        return;
    }

    const textContent = scanHistoryList.map(item => item.text).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_Scan_History_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("กำลังดาวน์โหลดประวัติ...", 'success');
}

/**
 * (NEW) ฟังก์ชันสำหรับตั้งค่าระดับการซูม
 * @param {number} value - ระดับการซูมที่ต้องการ
 */
function setZoom(value) {
    if (currentVideoTrack && zoomCapabilities) {
        // ตรวจสอบให้แน่ใจว่าค่าอยู่ในช่วงที่กล้องรองรับ
        const clampedValue = Math.max(zoomCapabilities.min, Math.min(value, zoomCapabilities.max));

        currentVideoTrack.applyConstraints({
            advanced: [{ zoom: clampedValue }]
        }).catch(e => {
            console.error('ไม่สามารถตั้งค่าซูมได้:', e);
        });
    }
}


/**
 * (REFACTORED) แก้ไขฟังก์ชัน startScanner เพื่อรองรับการซูม
 */
function startScanner() {
    const startBtn = document.getElementById('start-btn');
    const zoomControls = document.getElementById('zoom-controls');
    const zoomSlider = document.getElementById('zoom-slider');

    startBtn.style.display = 'none';
    zoomControls.style.display = 'none'; // ซ่อนไว้ก่อน

    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            html5QrCode = new Html5Qrcode("reader");

            const onCameraStartSuccess = () => {
                document.getElementById('overlay').style.display = 'flex';
                updateHistoryUI();

                // --- ส่วนที่เพิ่มเข้ามาสำหรับการซูม ---
                try {
                    currentVideoTrack = html5QrCode.getRunningTrack();
                    if (currentVideoTrack) {
                        const capabilities = currentVideoTrack.getCapabilities();

                        // ตรวจสอบว่ากล้องนี้รองรับ 'zoom' หรือไม่
                        if (capabilities.zoom) {
                            zoomCapabilities = capabilities.zoom;

                            // ตั้งค่าแถบเลื่อน (Slider)
                            zoomSlider.min = zoomCapabilities.min;
                            zoomSlider.max = zoomCapabilities.max;
                            zoomSlider.step = zoomCapabilities.step;
                            zoomSlider.value = currentVideoTrack.getSettings().zoom || zoomCapabilities.min; // ใช้ค่าปัจจุบัน ถ้ามี

                            // เพิ่ม Event Listener ให้กับแถบเลื่อน
                            zoomSlider.addEventListener('input', (event) => {
                                setZoom(event.target.value);
                            });

                            // แสดงแถบควบคุมการซูม
                            zoomControls.style.display = 'block';
                            console.log("กล้องรองรับการซูม:", zoomCapabilities);
                        } else {
                            console.warn("กล้องนี้ไม่รองรับการซูม");
                        }
                    }
                } catch (e) {
                    console.error("เกิดข้อผิดพลาดขณะตั้งค่าการซูม:", e);
                }
                // --- จบส่วนที่เพิ่มเข้ามา ---
            };

            const scanConfig = { fps: 10, qrbox: { width: 220, height: 180 } };
            const debouncedOnScanSuccess = debounce(onScanSuccess, 500);

            // พยายามเปิดกล้องหลังก่อน
            html5QrCode.start({ facingMode: "environment" }, scanConfig, debouncedOnScanSuccess)
                .then(onCameraStartSuccess)
                .catch(err => {
                    console.warn("ไม่พบกล้องหลัง, ลองใช้กล้องตัวแรก...", err);
                    // Fallback ไปใช้กล้องตัวแรก
                    html5QrCode.start(devices[0].id, scanConfig, debouncedOnScanSuccess)
                        .then(onCameraStartSuccess)
                        .catch(fallbackErr => {
                            startBtn.style.display = 'inline-block';
                            showToast("❌ ไม่สามารถเปิดกล้องได้", 'error');
                        });
                });

        } else {
            startBtn.style.display = 'inline-block';
            showToast("❌ ไม่พบอุปกรณ์กล้องบนเครื่องนี้", 'error');
        }
    }).catch(err => {
        startBtn.style.display = 'inline-block';
        showToast("❌ โปรดอนุญาตให้เบราว์เซอร์ใช้กล้อง", 'error');
    });
}
