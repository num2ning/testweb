function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true; // ล็อกระบบชั่วคราว ป้องกันการสแกนซ้ำซ้อนในเสี้ยววินาที

    const cleanedText = decodedText ? decodedText.trim() : "";
    const splitElement = document.getElementById('result-split');

    // 🛡️ 1. ตรวจสอบค่าว่างเปล่า
    if (cleanedText === "") {
        playBeepSound('warning');
        document.getElementById('result-all').innerText = "สแกนสำเร็จแต่พบข้อความว่างเปล่า";
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ค่าที่สแกนได้เป็นค่าว่าง (ไม่เก็บประวัติ)</span>`;

        setTimeout(() => { isProcessing = false; }, 1500);
        return;
    }

    let extractedText = "";
    let cutMethodMessage = "";

    // 🛡️ 2. ตรวจสอบเงื่อนไขความยาวและทำการตัดข้อความ
    if (cleanedText.length < 30) {
        // 🔹 กรณีข้อความ น้อยกว่า 30 ตัวอักษร -> ตัดตำแหน่งที่ 1 ถึง ตำแหน่งที่ 22 (ดัชนี 0 ถึง 22)
        extractedText = cleanedText.substring(0, 22).trim();
        cutMethodMessage = "(ตัดตำแหน่ง 1-22)";
    } else {
        // 🔸 กรณีข้อความ ตั้งแต่ 30 ตัวอักษรขึ้นไป -> ตัดตำแหน่งที่ 9 ถึง ตำแหน่งที่ 30 เหมือนเดิม (ดัชนี 8 ถึง 30)
        extractedText = cleanedText.substring(8, 30).trim();
        cutMethodMessage = "(ตัดตำแหน่ง 9-30)";
    }

    const digitCount = extractedText.length;

    // 🛡️ 3. ตรวจสอบความถูกต้องของความยาวผลลัพธ์ (ต้องได้ 22 หลักเท่านั้น)
    if (digitCount !== 22) {
        playBeepSound('warning');
        document.getElementById('result-all').innerText = cleanedText;
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">❌ ไม่ใช่รหัสครุภัณฑ์ที่ถูกต้อง ${cutMethodMessage} (${digitCount} Digits / ต้องการ 22)</span>`;

        setTimeout(() => { isProcessing = false; }, 1500);
        return;
    }

    // 🛡️ 4. ตรวจสอบหาความซ้ำซ้อนในประวัติ
    const isDuplicate = scanHistoryList.some(item => item.text === extractedText);

    if (isDuplicate) {
        playBeepSound('warning');
        document.getElementById('result-all').innerText = cleanedText;
        splitElement.innerHTML = `<span style="color: #ef4444; font-weight: 700;">⚠️ ตรวจพบค่าซ้ำ: ${extractedText}</span>`;

        // สลัดตัวล็อกหลังตรวจพบค่าซ้ำทันทีใน 1.5 วินาที เพื่อไม่ให้ระบบสแกนค้าง
        setTimeout(() => {
            isProcessing = false;
        }, 1500);
        return;
    }

    // ✅ ผ่านทุกเงื่อนไข (สแกนเสียงบี๊บสำเร็จ เข้าระบบ)
    playBeepSound('success');
    document.getElementById('result-all').innerText = cleanedText;
    splitElement.innerHTML = `<span style="color: #10b981; font-weight: 700;">${extractedText}</span>`;

    scanHistoryList.push({
        text: extractedText,
        time: getCurrentTimeFormatted()
    });

    updateHistoryUI();

    // พักเซนเซอร์ปกติ 2.5 วินาที ก่อนสแกนแผ่นถัดไป
    setTimeout(() => {
        isProcessing = false;
    }, 2500);
}