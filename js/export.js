// js/export.js - ДИАГНОСТИЧЕСКАЯ ВЕРСИЯ

async function exportToPDF() {
    if (typeof html2pdf === 'undefined') {
        alert("Библиотека PDF не загружена");
        return;
    }
    
    if (!rooms || rooms.length === 0) {
        alert("Нет данных для экспорта");
        return;
    }
    
    showSaveLoader();
    
    try {
        // Получаем SVG как картинку
        const svgImage = await getSvgAsImage();
        
        // Собираем данные сметы
        const estimate = calculateFullEstimateObject();
        
        // СОЗДАЕМ HTML С ЯВНЫМИ РАЗМЕРАМИ
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Смета</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: Arial, sans-serif;
                        background: white;
                        padding: 30px;
                    }
                    .page {
                        width: 100%;
                        max-width: 1100px;
                        margin: 0 auto;
                        background: white;
                    }
                    h1 {
                        color: #00bcd4;
                        font-size: 28px;
                        margin-bottom: 20px;
                        text-align: center;
                    }
                    .plan {
                        border: 2px solid #333;
                        padding: 20px;
                        margin: 20px 0;
                        text-align: center;
                        background: white;
                        min-height: 300px;
                    }
                    .plan img {
                        max-width: 100%;
                        height: auto;
                        display: block;
                        margin: 0 auto;
                    }
                    .plan p {
                        padding: 40px;
                        color: #999;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                        background: white;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 12px;
                        text-align: left;
                    }
                    th {
                        background: #00bcd4;
                        color: white;
                        font-weight: bold;
                    }
                    .total {
                        font-size: 20px;
                        font-weight: bold;
                        text-align: right;
                        margin-top: 20px;
                        padding-top: 15px;
                        border-top: 2px solid #333;
                    }
                    .footer {
                        margin-top: 40px;
                        font-size: 11px;
                        color: #999;
                        text-align: center;
                        padding: 20px 0;
                    }
                </style>
            </head>
            <body>
                <div class="page">
                    <h1>🏠 СМЕТА НА НАТЯЖНОЙ ПОТОЛОК</h1>
                    
                    <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 8px;">
                        <p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</p>
                        <p><strong>Комнат:</strong> ${rooms.length}</p>
                    </div>
                    
                    <div class="plan">
                        <h3 style="margin-bottom: 15px;">📐 План помещения</h3>
                        ${svgImage || '<p style="color: red;">⚠️ План не загружен</p>'}
                    </div>
                    
                    <h3 style="margin: 30px 0 15px 0;">💰 Смета материалов и работ</h3>
                    <table id="estimateTable">
                        <thead>
                            <tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Цена (руб)</th><th>Сумма (руб)</th></tr>
                        </thead>
                        <tbody id="estimateBody"></tbody>
                    </table>
                    
                    <div id="totalDisplay" class="total"></div>
                    
                    <div class="footer">
                        <p>Ceiling Plan PRO — профессиональный инструмент для проектирования</p>
                        <p>Данная смета действительна в течение 30 дней</p>
                    </div>
                </div>
                
                <script>
                    (function() {
                        console.log("🔍 Заполняем таблицу сметы...");
                        const estimateData = ${JSON.stringify(estimate)};
                        const tbody = document.getElementById('estimateBody');
                        let total = 0;
                        
                        console.log("📊 Данных сметы:", estimateData.items.length);
                        
                        if (estimateData.items && estimateData.items.length > 0) {
                            estimateData.items.forEach((item, index) => {
                                const row = tbody.insertRow();
                                row.insertCell(0).textContent = (index + 1).toString();
                                row.insertCell(1).textContent = item.name;
                                row.insertCell(2).textContent = item.quantity;
                                row.insertCell(3).textContent = item.price.toFixed(0);
                                row.insertCell(4).textContent = item.sum.toFixed(0);
                                total += item.sum;
                            });
                        } else {
                            const row = tbody.insertRow();
                            const cell = row.insertCell(0);
                            cell.colSpan = 5;
                            cell.textContent = 'Нет данных для отображения';
                            cell.style.textAlign = 'center';
                            cell.style.padding = '40px';
                            cell.style.color = '#999';
                        }
                        
                        document.getElementById('totalDisplay').innerHTML = '<strong>ИТОГО: ' + total.toFixed(0) + ' рублей</strong>';
                        console.log("✅ Таблица заполнена, итого:", total);
                    })();
                </script>
            </body>
            </html>
        `;
        
        // СОХРАНЯЕМ HTML ФАЙЛ ДЛЯ ДИАГНОСТИКИ
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const htmlUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = htmlUrl;
        a.download = 'diagnostic.html';
        a.click();
        URL.revokeObjectURL(htmlUrl);
        
        console.log("📄 HTML сохранен как diagnostic.html");
        console.log("📊 Длина HTML:", htmlContent.length);
        console.log("📊 SVG есть:", svgImage ? "да" : "нет");
        console.log("📊 Данные сметы:", estimate.items.length, "позиций");
        
        // Ждем
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Создаем PDF через iframe для лучшей совместимости
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        iframe.style.top = '-9999px';
        iframe.style.width = '1200px';
        iframe.style.height = '800px';
        document.body.appendChild(iframe);
        
        iframe.contentDocument.open();
        iframe.contentDocument.write(htmlContent);
        iframe.contentDocument.close();
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const opt = {
            margin: [0.5, 0.5, 0.5, 0.5],
            filename: `Смета_${new Date().toLocaleDateString('ru-RU')}.pdf`,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                logging: true,
                backgroundColor: '#ffffff',
                windowWidth: iframe.contentDocument.body.scrollWidth,
                windowHeight: iframe.contentDocument.body.scrollHeight
            },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        
        await html2pdf().set(opt).from(iframe.contentDocument.body).save();
        
        document.body.removeChild(iframe);
        hideSaveLoader();
        
        alert('✅ PDF сохранен! Также скачан файл diagnostic.html — откройте его в браузере, чтобы увидеть, как выглядит HTML.');
        
    } catch (error) {
        console.error("Ошибка:", error);
        hideSaveLoader();
        alert('Ошибка: ' + error.message);
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function showSaveLoader() {
    const loader = document.getElementById('saveLoader');
    if (loader) return;
    
    const loaderDiv = document.createElement('div');
    loaderDiv.id = 'saveLoader';
    loaderDiv.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; padding: 20px 30px; border-radius: 15px; z-index: 10000;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        font-size: 16px;
        font-weight: bold;
    `;
    loaderDiv.innerHTML = '⏳ Создание PDF...';
    document.body.appendChild(loaderDiv);
}

function hideSaveLoader() {
    const loader = document.getElementById('saveLoader');
    if (loader) loader.remove();
}

async function getSvgAsImage() {
    const svgElement = document.getElementById('canvas');
    if (!svgElement) {
        return '<p style="color: red;">⚠️ План не найден (SVG элемент отсутствует)</p>';
    }
    
    return new Promise((resolve) => {
        try {
            const clone = svgElement.cloneNode(true);
            const width = svgElement.clientWidth || 800;
            const height = svgElement.clientHeight || 600;
            
            console.log("📐 Размер SVG:", width, "x", height);
            
            clone.setAttribute('width', width);
            clone.setAttribute('height', height);
            clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            
            // Белый фон
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', '100%');
            rect.setAttribute('height', '100%');
            rect.setAttribute('fill', 'white');
            clone.insertBefore(rect, clone.firstChild);
            
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(clone);
            
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0);
                const pngUrl = canvas.toDataURL('image/png');
                console.log("✅ PNG создан, размер:", Math.round(pngUrl.length / 1024), "KB");
                resolve(`<img src="${pngUrl}" style="max-width: 100%; border: 1px solid #ddd;">`);
            };
            img.onerror = (err) => {
                console.error("Ошибка загрузки SVG:", err);
                resolve(`<div style="padding: 40px; background: #f0f0f0; border: 1px solid red;">⚠️ Ошибка загрузки плана: SVG не конвертируется</div>`);
            };
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        } catch (e) {
            console.error("Ошибка:", e);
            resolve('<p style="color: red;">Ошибка: ' + e.message + '</p>');
        }
    });
}

function calculateFullEstimateObject() {
    const items = [];
    let total = 0;
    
    if (!rooms) return { items, total };
    
    rooms.forEach((room, roomIndex) => {
        // Площадь
        let area = room.area;
        if (!area && room.closed && room.points) {
            let a = 0;
            for(let i = 0; i < room.points.length; i++) {
                let j = (i + 1) % room.points.length;
                a += room.points[i].x * room.points[j].y - room.points[j].x * room.points[i].y;
            }
            area = Math.abs(a / 2) / 1000000;
        }
        
        if (area && area > 0) {
            const price = 500;
            items.push({
                name: `Полотно "${room.name || 'Комната ' + (roomIndex+1)}"`,
                quantity: `${area.toFixed(2)} м²`,
                price: price,
                sum: area * price
            });
            total += area * price;
        }
        
        // Элементы
        if (room.elements && room.elements.length > 0) {
            room.elements.forEach(el => {
                items.push({
                    name: el.subtype || el.type || 'Элемент',
                    quantity: '1 шт',
                    price: 300,
                    sum: 300
                });
                total += 300;
            });
        }
    });
    
    console.log("📊 Смета рассчитана:", items.length, "позиций, итого:", total);
    
    return { items, total };
}

// Экспорт
window.exportToPDF = exportToPDF;

console.log("✅ Диагностическая версия export.js загружена");