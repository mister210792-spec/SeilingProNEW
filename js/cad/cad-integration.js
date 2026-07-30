// js/cad/cad-integration.js
// ========================================
// ИНТЕГРАЦИЯ CAD-СИСТЕМЫ С СУЩЕСТВУЮЩИМ ПРИЛОЖЕНИЕМ
// ========================================

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let cadSystem = null;
let cadRenderer = null;
let cadTools = null;
let cadUI = null;
let cadInitialized = false;
let isCADMode = true; // true - новая система, false - старая

// --- ИНИЦИАЛИЗАЦИЯ ---
function initCADSystem() {
    console.log('🔧 Инициализация CAD-системы...');
    
    try {
        // 1. Создаем ядро
        cadSystem = new CADSystem();
        
        // 2. Создаем рендерер (используем существующий SVG)
        const svg = document.getElementById('canvas');
        cadRenderer = new CADRenderer(svg, cadSystem);
        
        // 3. Создаем инструменты
        cadTools = new CADTools(cadSystem, cadRenderer);
        
        // 4. Создаем UI (добавляет панели инструментов, командную строку и т.д.)
        cadUI = new CADUI(cadSystem, cadTools, cadRenderer);
        
        cadInitialized = true;
        console.log('✅ CAD-система инициализирована');
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка инициализации CAD:', error);
        return false;
    }
}

// --- МИГРАЦИЯ ДАННЫХ ИЗ СТАРОГО ФОРМАТА ---
function migrateRoomsToCAD(roomsData) {
    if (!cadSystem) {
        console.error('❌ CAD-система не инициализирована');
        return;
    }
    
    console.log('🔄 Миграция данных...');
    
    if (!roomsData || roomsData.length === 0) {
        console.log('📭 Нет данных для миграции');
        return;
    }
    
    // Создаем слой "Стены" для всех комнат
    const wallsLayer = cadSystem.addLayer('Стены', '#2c3e50');
    
    roomsData.forEach((room, roomIndex) => {
        // 1. Создаем слой для комнаты
        const roomLayer = cadSystem.addLayer(room.name || `Комната ${roomIndex + 1}`, '#2c3e50');
        cadSystem.setCurrentLayer(roomLayer);
        
        // 2. Преобразуем точки в полилинию
        if (room.points && room.points.length > 0) {
            try {
                const points = room.points.map(p => ({ 
                    x: p.x, 
                    y: p.y 
                }));
                
                const entity = cadSystem.createEntity('polyline', {
                    points: points,
                    closed: room.closed || false,
                    layer: roomLayer
                });
                
                console.log(`✅ Комната "${room.name}" мигрирована (${points.length} точек)`);
            } catch (error) {
                console.error(`❌ Ошибка миграции комнаты "${room.name}":`, error);
            }
        }
        
        // 3. Преобразуем элементы (светильники, карнизы и т.д.)
        if (room.elements && room.elements.length > 0) {
            const elementsLayer = cadSystem.addLayer('Элементы', '#fbc02d');
            cadSystem.setCurrentLayer(elementsLayer);
            
            room.elements.forEach((el, elIndex) => {
                try {
                    if (el.type === 'light' || el.type === 'rail') {
                        const light = cadSystem.createLightFixture(
                            el.x,
                            el.y,
                            el.subtype || 'GX53',
                            el.rotation || 0
                        );
                        
                        // Если есть ширина, добавляем как линейный объект
                        if (el.width && el.type === 'rail') {
                            light.width = el.width;
                            light.isLinear = true;
                        }
                        
                        console.log(`  ✅ Элемент ${elIndex + 1}: ${el.subtype || el.type}`);
                    } else if (el.type === 'pipe') {
                        // Обвод трубы - создаем круг
                        cadSystem.createCircle(el.x, el.y, 50);
                    } else {
                        // Другие элементы
                        cadSystem.createLightFixture(el.x, el.y, el.subtype || 'GX53');
                    }
                } catch (error) {
                    console.error(`❌ Ошибка миграции элемента ${elIndex + 1}:`, error);
                }
            });
        }
    });
    
    // Сбрасываем текущий слой
    cadSystem.setCurrentLayer(wallsLayer);
    
    // Сохраняем состояние
    cadSystem.history.saveState(cadSystem.entities);
    
    // Рендерим
    cadRenderer.render();
    
    console.log('✅ Миграция завершена');
}

// --- ОБРАТНАЯ МИГРАЦИЯ (из CAD в старый формат) ---
function migrateFromCADToRooms() {
    if (!cadSystem) return [];
    
    const rooms = [];
    let currentRoom = null;
    let currentPoints = [];
    
    // Группируем объекты по слоям
    const layerEntities = {};
    cadSystem.entities.forEach(entity => {
        if (!layerEntities[entity.layer]) {
            layerEntities[entity.layer] = [];
        }
        layerEntities[entity.layer].push(entity);
    });
    
    // Для каждого слоя создаем комнату
    Object.entries(layerEntities).forEach(([layerId, entities]) => {
        const layer = cadSystem.layers[layerId];
        if (!layer || layer.name === 'Стены' || layer.name === 'Элементы') return;
        
        const room = {
            name: layer.name || 'Полотно',
            points: [],
            closed: false,
            elements: [],
            id: Date.now() + Math.random(),
            materials: {
                canvasType: 'pvc_matte',
                wallProfiles: {}
            }
        };
        
        // Собираем точки из полилиний
        entities.forEach(entity => {
            if (entity.type === 'polyline' && entity.points) {
                room.points = entity.points.map(p => ({ x: p.x, y: p.y }));
                room.closed = entity.closed || false;
            }
            
            // Собираем элементы
            if (entity.type === 'light' || entity.type === 'rail') {
                const el = {
                    type: entity.type,
                    subtype: entity.subtype || 'GX53',
                    x: entity.position.x,
                    y: entity.position.y,
                    rotation: entity.rotation || 0
                };
                
                if (entity.width) {
                    el.width = entity.width;
                }
                
                room.elements.push(el);
            }
        });
        
        if (room.points.length > 0) {
            rooms.push(room);
        }
    });
    
    return rooms;
}

// --- ПЕРЕКЛЮЧЕНИЕ МЕЖДУ РЕЖИМАМИ ---
function toggleCADMode() {
    isCADMode = !isCADMode;
    
    if (isCADMode) {
        console.log('🔄 Переключение в CAD-режим');
        // Скрываем старый UI
        document.querySelector('.side-menu')?.classList.add('hidden');
        // Показываем CAD UI
        document.getElementById('cad-toolbar')?.classList.remove('hidden');
        document.getElementById('cad-command-line')?.classList.remove('hidden');
    } else {
        console.log('🔄 Переключение в классический режим');
        // Показываем старый UI
        document.querySelector('.side-menu')?.classList.remove('hidden');
        // Скрываем CAD UI
        document.getElementById('cad-toolbar')?.classList.add('hidden');
        document.getElementById('cad-command-line')?.classList.add('hidden');
    }
}

// --- ОБНОВЛЕНИЕ СТАТИСТИКИ ---
function updateCADStats() {
    if (!cadSystem) return;
    
    // Обновляем статистику на основе CAD-данных
    const entities = cadSystem.getVisibleEntities();
    let totalArea = 0;
    let totalPerim = 0;
    let elementsCount = 0;
    
    entities.forEach(entity => {
        if (entity.type === 'polyline' && entity.closed && entity.area) {
            totalArea += entity.area || 0;
        }
        if (entity.type === 'light' || entity.type === 'rail') {
            elementsCount++;
        }
    });
    
    // Обновляем DOM
    document.getElementById('totalArea').textContent = totalArea.toFixed(2) + ' м²';
    document.getElementById('totalElements').textContent = `Элементов: ${elementsCount}`;
    
    return { totalArea, totalPerim, elementsCount };
}

// --- ГЕНЕРАЦИЯ СМЕТЫ ИЗ CAD ---
function generateCADEstimate() {
    if (!cadSystem) {
        alert('CAD-система не инициализирована');
        return;
    }
    
    const entities = cadSystem.entities;
    const items = [];
    let total = 0;
    
    // Собираем площади полилиний
    entities.forEach(entity => {
        if (entity.type === 'polyline' && entity.closed && entity.area) {
            items.push({
                name: `Полотно (${entity.layer ? cadSystem.layers[entity.layer]?.name || 'Комната' : 'Комната'})`,
                quantity: `${entity.area.toFixed(2)} м²`,
                price: 500,
                sum: entity.area * 500
            });
            total += entity.area * 500;
        }
        
        if (entity.type === 'light') {
            items.push({
                name: `Светильник ${entity.subtype || 'GX53'}`,
                quantity: '1 шт',
                price: entity.price || 350,
                sum: entity.price || 350
            });
            total += entity.price || 350;
        }
    });
    
    // Показываем результат
    console.log('📊 Смета:', items);
    alert(`Итого: ${total.toFixed(0)} руб. (${items.length} позиций)`);
    
    return { items, total };
}

// --- ОБРАБОТЧИКИ ДЛЯ СУЩЕСТВУЮЩИХ ФУНКЦИЙ ---
// Переопределяем старые функции для работы с CAD

// Сохранение проекта
function saveProjectWithCAD() {
    if (!currentUser || !currentUser.uid) {
        alert('Пожалуйста, войдите в систему');
        return;
    }
    
    // Конвертируем CAD в старый формат для совместимости
    const roomsData = migrateFromCADToRooms();
    
    // Показываем модальное окно с данными клиента
    showClientInfoModalWithData(roomsData);
}

// Загрузка проекта
function loadProjectWithCAD(projectId) {
    if (!currentUser || !currentUser.uid) return;
    
    if (confirm('Загрузить этот проект?')) {
        db.collection('users').doc(currentUser.uid).collection('projects').doc(projectId).get()
            .then((doc) => {
                if (doc.exists) {
                    const project = doc.data();
                    const roomsData = project.data || [];
                    
                    // Очищаем CAD
                    cadSystem.entities = [];
                    cadSystem.history.saveState(cadSystem.entities);
                    
                    // Мигрируем данные
                    migrateRoomsToCAD(roomsData);
                    
                    // Обновляем UI
                    cadRenderer.render();
                    updateCADStats();
                    
                    closeProjectsModal();
                    showNotification(`Проект "${project.name}" загружен в CAD`);
                }
            })
            .catch(error => {
                console.error('Ошибка загрузки:', error);
                alert('Ошибка загрузки: ' + error.message);
            });
    }
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// --- ЭКСПОРТ ФУНКЦИЙ ---
window.cadSystem = cadSystem;
window.cadRenderer = cadRenderer;
window.cadTools = cadTools;
window.cadUI = cadUI;
window.initCADSystem = initCADSystem;
window.migrateRoomsToCAD = migrateRoomsToCAD;
window.migrateFromCADToRooms = migrateFromCADToRooms;
window.toggleCADMode = toggleCADMode;
window.updateCADStats = updateCADStats;
window.generateCADEstimate = generateCADEstimate;
window.saveProjectWithCAD = saveProjectWithCAD;
window.loadProjectWithCAD = loadProjectWithCAD;

console.log('✅ Модуль интеграции CAD загружен');
