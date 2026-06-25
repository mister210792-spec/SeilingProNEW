// core.js - ПОЛНАЯ ВЕРСИЯ

// Основные переменные
const svg = document.getElementById("canvas");
const GRID_SNAP_MM = 10; 
const LIGHT_SNAP_MM = 50; 
const MM_TO_PX = 3.78;

let scale = 0.18;
let offsetX = 100;
let offsetY = 100;
let rooms = [];
let activeRoom = 0;
let dragId = null;
let dragElem = null;
let isPanning = false;
let startPanX, startPanY;
let mousePos = { x: 0, y: 0, shift: false };
let isHoveringFirstPoint = false;
let currentTool = 'draw';
let showDiagonals = true;
let showMeasures = true;
let history = [];
// Флаг для пропуска модального окна (будет использоваться из projects.js)
window.skipRoomTypeModal = false;
// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

function saveState() {
    if (history.length > 50) history.shift();
    history.push(JSON.stringify(rooms));
}

function undo() {
    if (history.length > 0) {
        rooms = JSON.parse(history.pop());
        if (activeRoom >= rooms.length) activeRoom = Math.max(0, rooms.length - 1);
        renderTabs();
        draw();
    }
}

function setTool(tool) {
    currentTool = (currentTool === tool) ? 'draw' : tool;
    document.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('tool-' + tool);
    if (btn && currentTool !== 'draw') btn.classList.add('active');
}

function toggleDiagonals() {
    showDiagonals = !showDiagonals;
    document.getElementById("toggleDiags").classList.toggle("btn-toggle-active", showDiagonals);
    draw();
}

function toggleMeasures() {
    showMeasures = !showMeasures;
    document.getElementById("toggleMeasures").classList.toggle("btn-toggle-active", showMeasures);
    draw();
}

function renameRoom() {
    let r = rooms[activeRoom];
    let newName = prompt("Введите название помещения:", r.name);
    if (newName) {
        saveState();
        r.name = newName;
        renderTabs();
        updateStats();
    }
}

function mmToPx(mm, axis) {
    return axis === 'x' ? (mm * MM_TO_PX * scale) + offsetX : (mm * MM_TO_PX * scale) + offsetY;
}

function pxToMm(px, axis) {
    return axis === 'x' ? (px - offsetX) / (MM_TO_PX * scale) : (px - offsetY) / (MM_TO_PX * scale);
}

function snap(mm, firstMm = null, step = GRID_SNAP_MM) {
    if (firstMm !== null && Math.abs(mm - firstMm) < 50) return firstMm;
    return Math.round(mm / step) * step;
}

function getSnappedPos(mx, my, currentEl = null) {
    let r = rooms[activeRoom];
    let fx = snap(mx, null, LIGHT_SNAP_MM);
    let fy = snap(my, null, LIGHT_SNAP_MM);
    if (r.elements) {
        r.elements.forEach(el => {
            if (el === currentEl) return;
            if (Math.abs(fx - el.x) < 80) fx = el.x;
            if (Math.abs(fy - el.y) < 80) fy = el.y;
        });
    }
    return { x: fx, y: fy };
}

function drawGrid() {
    const s100 = 100 * MM_TO_PX * scale; 
    if (s100 > 5) {
        for (let x = offsetX % s100; x < svg.clientWidth; x += s100) {
            svg.appendChild(createLine(x, 0, x, svg.clientHeight, "#f1f1f1", 0.5));
        }
        for (let y = offsetY % s100; y < svg.clientHeight; y += s100) {
            svg.appendChild(createLine(0, y, svg.clientWidth, y, "#f1f1f1", 0.5));
        }
    }
}

function createLine(x1, y1, x2, y2, c, w, d) {
    let l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", x1);
    l.setAttribute("y1", y1);
    l.setAttribute("x2", x2);
    l.setAttribute("y2", y2);
    l.setAttribute("stroke", c);
    l.setAttribute("stroke-width", w);
    if (d) l.setAttribute("stroke-dasharray", d);
    return l;
}

function renderText(x, y, txt, cls) {
    let t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", x);
    t.setAttribute("y", y);
    t.setAttribute("class", cls);
    t.textContent = txt;
    svg.appendChild(t);
    return t;
}

// ========== ПОЛНАЯ ФУНКЦИЯ DRAW ==========

function draw(isExport = false) {
    updateZoomLevel();
    svg.innerHTML = "";
    if (!isExport) drawGrid();
    
    let r = rooms[activeRoom];
    if (!r) return;
    
    if (r.closed && r.points.length > 3 && showDiagonals) {
        for (let i = 0; i < r.points.length; i++) {
            for (let j = i + 2; j < r.points.length; j++) {
                if (i === 0 && j === r.points.length - 1) continue;
                let p1 = r.points[i], p2 = r.points[j];
                svg.appendChild(createLine(mmToPx(p1.x, 'x'), mmToPx(p1.y, 'y'), mmToPx(p2.x, 'x'), mmToPx(p2.y, 'y'), "rgba(142, 68, 173, 0.15)", 1, "4,4"));
                let d = Math.round(Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2)/10);
                renderText(mmToPx((p1.x+p2.x)/2, 'x'), mmToPx((p1.y+p2.y)/2, 'y'), d, "diag-label");
            }
        }
    }
    
    if (r.points.length > 0) {
        let pts = r.points.map(p => `${mmToPx(p.x, 'x')},${mmToPx(p.y, 'y')}`).join(" ");
        let poly = document.createElementNS("http://www.w3.org/2000/svg", r.closed ? "polygon" : "polyline");
        poly.setAttribute("points", pts);
        poly.setAttribute("fill", r.closed ? "rgba(0,188,212,0.05)" : "none");
        poly.setAttribute("stroke", "#2c3e50");
        poly.setAttribute("stroke-width", 2.5);
        svg.appendChild(poly);
        
        r.points.forEach((p, i) => {
            if (!r.closed && i === r.points.length - 1) return;
            let pNext = r.points[(i + 1) % r.points.length];
            let d = Math.round(Math.sqrt((pNext.x-p.x)**2 + (pNext.y-p.y)**2)/10);
            if (d > 0) {
                let txt = renderText(mmToPx((p.x+pNext.x)/2, 'x'), mmToPx((p.y+pNext.y)/2, 'y'), d + " см", "length-label");
                if (!isExport && window.isMobile) {
                    txt.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openWallResize(i);
                    }, { passive: false });
                } else if (!isExport) {
                    txt.onclick = () => resizeWall(i);
                }
            }
        });
    }
    
    // Умный луч для десктопа - отображение размера при рисовании
    if (r.points.length > 0 && !r.closed && !dragId && !dragElem && !isExport && currentTool === 'draw' && !window.isMobile) {
        let last = r.points[r.points.length - 1];
        let first = r.points[0];
        let rawX = pxToMm(mousePos.x, 'x');
        let rawY = pxToMm(mousePos.y, 'y');
        let sX = snap(rawX, first ? first.x : null);
        let sY = snap(rawY, first ? first.y : null);
        
        if (!mousePos.shift) {
            if (Math.abs(sX - last.x) > Math.abs(sY - last.y)) {
                sY = last.y;
            } else {
                sX = last.x;
            }
        }
        
        isHoveringFirstPoint = (r.points.length >= 3 && first && 
            Math.sqrt((mousePos.x - mmToPx(first.x, 'x'))**2 + 
                      (mousePos.y - mmToPx(first.y, 'y'))**2) < 25);
        
        svg.appendChild(createLine(
            mmToPx(last.x, 'x'), mmToPx(last.y, 'y'),
            mmToPx(sX, 'x'), mmToPx(sY, 'y'),
            isHoveringFirstPoint ? "var(--success)" : "var(--primary)",
            2, "6,4"
        ));
        
        if (first && (Math.abs(sX - first.x) < 2 || Math.abs(sY - first.y) < 2)) {
            svg.appendChild(createLine(
                mmToPx(first.x, 'x'), mmToPx(first.y, 'y'),
                mmToPx(sX, 'x'), mmToPx(sY, 'y'),
                "#bbb", 1, "4,4"
            ));
        }
        
        let dist = Math.round(Math.sqrt((sX - last.x)**2 + (sY - last.y)**2) / 10);
        if (dist > 0) {
            renderText(
                mmToPx((last.x + sX)/2, 'x'),
                mmToPx((last.y + sY)/2, 'y') - 10,
                dist + " см",
                "live-label"
            );
        }
    }
    
    if (r.elements) {
        r.elements.forEach((el, idx) => {
            let def = getElementDef(el.subtype);
            let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("transform", `rotate(${el.rotation || 0}, ${mmToPx(el.x, 'x')}, ${mmToPx(el.y, 'y')})`);
            
            const isLinear = def.type === 'linear' || el.type === 'rail';
            
            if (r.closed && showMeasures) drawElementMeasures(el, r);
            
            if (isLinear) {
                let w = el.width || 2000;
                let color = el.type === 'rail' ? "#fb8c00" : (el.subtype === 'TRACK' ? "#333" : "var(--light)");
                let line = createLine(mmToPx(el.x - w/2, 'x'), mmToPx(el.y, 'y'), mmToPx(el.x + w/2, 'x'), mmToPx(el.y, 'y'), color, 5);
                line.setAttribute("stroke-linecap", "round");
                g.appendChild(line);
                
                let label = renderText(mmToPx(el.x, 'x'), mmToPx(el.y, 'y') - 10, `${w/10} см`, el.type === 'rail' ? "rail-label" : "light-label");
                
                if (!isExport && window.isMobile) {
                    label.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openElementResize(el);
                    }, { passive: false });
                } else if (!isExport) {
                    label.onclick = (e) => {
                        e.stopPropagation();
                        let nl = prompt("Длина (см):", w/10);
                        if (nl && !isNaN(nl)) {
                            saveState();
                            el.width = nl * 10;
                            draw();
                        }
                    };
                }
            } else {
                g.appendChild(drawSymbol(el, def));
            }
            
            if (!isExport) {
                if (window.isMobile) {
                    g.addEventListener('touchstart', (e) => handleElementTouchStart(el, idx, e), { passive: false });
                    g.addEventListener('touchend', (e) => handleElementTouchEnd(el, idx, e), { passive: false });
                    g.addEventListener('touchmove', handleElementTouchMove, { passive: false });
                    g.addEventListener('touchcancel', cancelLongPress, { passive: false });
                } else {
                    g.onmousedown = (e) => {
                        e.stopPropagation();
                        if (e.altKey) {
                            saveState();
                            let copy = JSON.parse(JSON.stringify(el));
                            r.elements.push(copy);
                            dragElem = copy;
                        } else {
                            saveState();
                            dragElem = el;
                        }
                    };
                    g.oncontextmenu = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        saveState();
                        r.elements.splice(idx, 1);
                        draw();
                    };
                }
            }
            svg.appendChild(g);
        });
    }
    
    if (!isExport) {
        r.points.forEach((p, i) => {
            let c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            c.setAttribute("cx", mmToPx(p.x, 'x'));
            c.setAttribute("cy", mmToPx(p.y, 'y'));
            c.setAttribute("r", selectedPointId === p.id ? 8 : 5);
            c.setAttribute("fill", selectedPointId === p.id ? "var(--primary)" : "white");
            c.setAttribute("stroke", "#e74c3c");
            c.setAttribute("stroke-width", 2);
            
            if (window.isMobile) {
                c.addEventListener('touchstart', (e) => handlePointTouchStart(p.id, e), { passive: false });
                c.addEventListener('touchend', (e) => handlePointTouchEnd(p.id, e), { passive: false });
                c.addEventListener('touchmove', handlePointTouchMove, { passive: false });
                c.addEventListener('touchcancel', cancelLongPress, { passive: false });
            } else {
                c.onmousedown = (e) => {
                    e.stopPropagation();
                    if (currentTool === 'draw') {
                        saveState();
                        dragId = p.id;
                    }
                };
                c.oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    saveState();
                    r.points.splice(i, 1);
                    if (r.points.length < 3) r.closed = false;
                    draw();
                };
            }
            svg.appendChild(c);
        });
    }
    
    updateStats();
}

function drawSymbol(el, def) {
    let cx = mmToPx(el.x, 'x'), cy = mmToPx(el.y, 'y');
    let s = document.createElementNS("http://www.w3.org/2000/svg", "g");
    
    if (el.subtype === 'GX53') {
        s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="8" fill="white" stroke="black" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="4" fill="black"/>`;
        return s;
    }
    if (el.subtype === 'CHANDELIER') {
        s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="10" fill="white" stroke="black" stroke-width="1.5"/><path d="M${cx-7} ${cy} L${cx+7} ${cy} M${cx} ${cy-7} L${cx} ${cy+7} M${cx-5} ${cy-5} L${cx+5} ${cy+5} M${cx+5} ${cy-5} L${cx-5} ${cy+5}" stroke="black" stroke-width="1"/>`;
        return s;
    }
    if (el.subtype === 'FIRE_ALARM') {
        s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="8" fill="white" stroke="#ff5252" stroke-width="2"/><path d="M${cx-4} ${cy-4} L${cx+4} ${cy+4} M${cx+4} ${cy-4} L${cx-4} ${cy+4}" stroke="#ff5252" stroke-width="1.5"/>`;
        return s;
    }
    if (el.type === 'pipe') {
        s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="6" fill="#9e9e9e" stroke="black" stroke-width="1"/><path d="M${cx-3} ${cy-3} L${cx+3} ${cy+3}" stroke="white" stroke-width="1"/>`;
        return s;
    }
    
    let shape = def.shape || 'circle';
    let fill = def.type === 'service' ? '#e0f7fa' : 'white';
    let stroke = '#2c3e50';
    
    if (def.type === 'service') {
        s.innerHTML = `<path d="M${cx} ${cy-10} L${cx+2} ${cy-3} L${cx+9} ${cy-3} L${cx+3} ${cy+2} L${cx+5} ${cy+9} L${cx} ${cy+5} L${cx-5} ${cy+9} L${cx-3} ${cy+2} L${cx-9} ${cy-3} L${cx-2} ${cy-3} Z" fill="#ffd700" stroke="#f57f17" stroke-width="1"/>`;
        return s;
    }
    
    if (shape === 'square') {
        s.innerHTML = `<rect x="${cx-9}" y="${cy-9}" width="18" height="18" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    } else if (shape === 'triangle') {
        s.innerHTML = `<polygon points="${cx},${cy-10} ${cx+9},${cy+8} ${cx-9},${cy+8}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    } else if (shape === 'diamond') {
        s.innerHTML = `<polygon points="${cx},${cy-10} ${cx+10},${cy} ${cx},${cy+10} ${cx-10},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    } else {
        s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="2" fill="${stroke}"/>`;
    }
    return s;
}

function drawElementMeasures(el, room) {
    let def = getElementDef(el.subtype);
    const isLinear = def.type === 'linear' || el.type === 'rail';
    let anchorPoints = [];
    
    if (isLinear) {
        let w = (el.width || 2000) / 2;
        let rad = (el.rotation || 0) * Math.PI / 180;
        anchorPoints.push({ x: el.x - w * Math.cos(rad), y: el.y - w * Math.sin(rad) });
        anchorPoints.push({ x: el.x + w * Math.cos(rad), y: el.y + w * Math.sin(rad) });
    } else {
        anchorPoints.push({ x: el.x, y: el.y });
    }
    
    anchorPoints.forEach(pt => {
        let dists = [];
        for (let i = 0; i < room.points.length; i++) {
            let p1 = room.points[i];
            let p2 = room.points[(i + 1) % room.points.length];
            if (Math.abs(p1.x - p2.x) < 1 && pt.y >= Math.min(p1.y, p2.y) && pt.y <= Math.max(p1.y, p2.y)) {
                dists.push({ axis: 'x', val: p1.x, d: Math.abs(pt.x - p1.x), pt: pt });
            } else if (Math.abs(p1.y - p2.y) < 1 && pt.x >= Math.min(p1.x, p2.x) && pt.x <= Math.max(p1.x, p2.x)) {
                dists.push({ axis: 'y', val: p1.y, d: Math.abs(pt.y - p1.y), pt: pt });
            }
        }
        
        let bX = dists.filter(d => d.axis === 'x').sort((a, b) => a.d - b.d)[0];
        let bY = dists.filter(d => d.axis === 'y').sort((a, b) => a.d - b.d)[0];
        
        if (bX) {
            svg.appendChild(createLine(mmToPx(bX.pt.x, 'x'), mmToPx(bX.pt.y, 'y'), mmToPx(bX.val, 'x'), mmToPx(bX.pt.y, 'y'), "var(--danger)", 0.8, "2,2"));
            renderText(mmToPx(bX.pt.x + (bX.val > bX.pt.x ? 100 : -100), 'x'), mmToPx(bX.pt.y, 'y') - 5, Math.round(bX.d / 10) + " см", "measure-label");
        }
        if (bY) {
            svg.appendChild(createLine(mmToPx(bY.pt.x, 'x'), mmToPx(bY.pt.y, 'y'), mmToPx(bY.pt.x, 'x'), mmToPx(bY.val, 'y'), "var(--danger)", 0.8, "2,2"));
            renderText(mmToPx(bY.pt.x, 'x') + 15, mmToPx(bY.pt.y + (bY.val > bY.pt.y ? 100 : -100), 'y'), Math.round(bY.d / 10) + " см", "measure-label");
        }
    });
}

// ========== ОБРАБОТЧИКИ МЫШИ ==========

svg.onmousemove = (e) => {
    if (window.isMobile) return;
    const rect = svg.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
    mousePos.shift = e.shiftKey;
    
    if (isPanning) {
        offsetX = e.clientX - startPanX;
        offsetY = e.clientY - startPanY;
        draw();
        return;
    }
    if (dragId) {
        let p = rooms[activeRoom].points.find(pt => pt.id === dragId);
        if (p) {
            p.x = snap(pxToMm(mousePos.x, 'x'));
            p.y = snap(pxToMm(mousePos.y, 'y'));
            draw();
            drawSmartGuides(p.x, p.y, dragId);
        }
        return;
    }
    if (dragElem) {
        let s = getSnappedPos(pxToMm(mousePos.x, 'x'), pxToMm(mousePos.y, 'y'), dragElem);
        dragElem.x = s.x;
        dragElem.y = s.y;
        draw();
        drawSmartGuides(dragElem.x, dragElem.y, null);
        return;
    }
    draw();
};

svg.onmousedown = (e) => {
    if (window.isMobile) return;
    if (e.target === svg && currentTool === 'draw') {
        isPanning = true;
        startPanX = e.clientX - offsetX;
        startPanY = e.clientY - offsetY;
    }
};

window.onmouseup = () => {
    if (window.isMobile) return;
    isPanning = false;
    dragId = null;
    dragElem = null;
};

svg.onclick = (e) => {
    if (window.isMobile) return;
    if (isPanning) return;
    
    let r = rooms[activeRoom];
    if (!r) return;
    
    let rect = svg.getBoundingClientRect();
    let mmX = pxToMm(e.clientX - rect.left, 'x');
    let mmY = pxToMm(e.clientY - rect.top, 'y');
    
    if (currentTool !== 'draw') {
        saveState();
        if (!r.elements) r.elements = [];
        
        let sub;
        if (currentTool === 'light') sub = document.getElementById("lightTypeSelector").value;
        else if (currentTool === 'rail') sub = document.getElementById("railTypeSelector").value;
        else if (currentTool === 'extra') sub = document.getElementById("extraTypeSelector").value;
        else if (currentTool === 'pipe') sub = 'pipe';
        
        let s = getSnappedPos(mmX, mmY);
        let def = getElementDef(sub);
        
        let newEl = {
            type: currentTool === 'pipe' ? 'pipe' : currentTool,
            subtype: sub,
            x: s.x,
            y: s.y,
            rotation: 0
        };
        
        const isLinear = def.type === 'linear' || currentTool === 'rail' || currentTool === 'pipe';
        if (isLinear) {
            let dl = prompt("Длина (см):", "200");
            newEl.width = (parseFloat(dl) * 10) || 2000;
        }
        
        r.elements.push(newEl);
        draw();
        return;
    }
    
    if (r.closed || dragId) return;
    
    let first = r.points[0];
    if (r.points.length >= 3 && first) {
        let firstXpx = mmToPx(first.x, 'x');
        let firstYpx = mmToPx(first.y, 'y');
        if (Math.sqrt((e.clientX - rect.left - firstXpx)**2 + (e.clientY - rect.top - firstYpx)**2) < 25) {
            saveState();
            r.closed = true;
            draw();
            return;
        }
    }
    
    saveState();
    let sX = snap(mmX, first ? first.x : null);
    let sY = snap(mmY, first ? first.y : null);
    
    let last = r.points[r.points.length - 1];
    if (last && !e.shiftKey) {
        if (Math.abs(sX - last.x) > Math.abs(sY - last.y)) {
            sY = last.y;
        } else {
            sX = last.x;
        }
    }
    
    r.points.push({ id: Date.now() + Math.random(), x: sX, y: sY });
    draw();
};

svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    
    if (e.shiftKey) {
        let r = rooms[activeRoom];
        let mmX = pxToMm(mousePos.x, 'x');
        let mmY = pxToMm(mousePos.y, 'y');
        let target = r.elements?.find(el => Math.sqrt((el.x-mmX)**2 + (el.y-mmY)**2) < 200);
        if (target) {
            target.rotation = (target.rotation || 0) + (e.deltaY > 0 ? 1 : -1);
            draw();
            return;
        }
    }
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    offsetX = x - (x - offsetX) * delta;
    offsetY = y - (y - offsetY) * delta;
    scale *= delta;
    draw();
}, { passive: false });

// ========== ФУНКЦИИ РАБОТЫ С КОМНАТАМИ ==========

function addRoom() {
    if(window.currentUser && window.currentUser.plan === 'free' && rooms.length >= 1) {
        alert("В бесплатном плане доступно только 1 помещение. Перейдите на PRO для безлимита.");
        return;
    }
    saveState();
    
    rooms.push({
        name: "Полотно " + (rooms.length + 1),
        points: [],
        id: Date.now(),
        closed: false,
        elements: []
    });
    
    activeRoom = rooms.length - 1;
    renderTabs();
    draw();
}

function removeRoom(idx, e) {
    e.stopPropagation();
    if (confirm("Удалить это помещение?")) {
        saveState();
        rooms.splice(idx, 1);
        activeRoom = Math.max(0, activeRoom - 1);
        if (rooms.length === 0) addRoom();
        renderTabs();
        draw();
    }
}

function renderTabs() {
    const tabs = document.getElementById("tabs");
    tabs.innerHTML = "";
    rooms.forEach((r, i) => {
        let t = document.createElement("div");
        t.className = "tab" + (i === activeRoom ? " active" : "");
        t.innerHTML = `${r.name} <span class="close-tab" onclick="removeRoom(${i}, event)">×</span>`;
        t.onclick = () => {
            activeRoom = i;
            renderTabs();
            draw();
        };
        tabs.appendChild(t);
    });
    
    updateZoomLevel();
}

// ========== ФУНКЦИИ ЗУМА ==========

function updateZoomLevel() {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
        zoomLevel.textContent = Math.round(scale * 100) + '%';
    }
}

function zoomIn() {
    const rect = svg.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    let newScale = Math.min(scale * 1.2, 3.0);
    
    if (newScale !== scale) {
        offsetX = centerX - (centerX - offsetX) * (newScale / scale);
        offsetY = centerY - (centerY - offsetY) * (newScale / scale);
        scale = newScale;
        updateZoomLevel();
        draw();
    }
}

function zoomOut() {
    const rect = svg.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    let newScale = scale * 0.8;
    
    offsetX = centerX - (centerX - offsetX) * (newScale / scale);
    offsetY = centerY - (centerY - offsetY) * (newScale / scale);
    scale = newScale;
    updateZoomLevel();
    draw();
}

function resetView() {
    scale = 0.18;
    offsetX = 100;
    offsetY = 100;
    updateZoomLevel();
    draw();
}

function setScaleFor5x5() {
    const roomWidth = 5000;
    const roomHeight = 5000;
    
    const container = document.getElementById('canvas-container');
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    if (containerWidth === 0 || containerHeight === 0) {
        console.log("⚠️ Контейнер еще не загружен, пробуем позже");
        setTimeout(() => setScaleFor5x5(), 50);
        return;
    }
    
    const roomWidthPx = roomWidth * MM_TO_PX;
    const roomHeightPx = roomHeight * MM_TO_PX;
    
    const scaleX = (containerWidth * 0.8) / roomWidthPx;
    const scaleY = (containerHeight * 0.8) / roomHeightPx;
    
    let newScale = Math.min(scaleX, scaleY);
    scale = Math.max(0.1, Math.min(1.0, newScale));
    
    offsetX = containerWidth / 2;
    offsetY = containerHeight / 2;
    
    updateZoomLevel();
    console.log("📐 Масштаб установлен для 5x5 метров:", scale.toFixed(3));
}

function centerView() {
    const r = rooms[activeRoom];
    if (!r || r.points.length === 0) return;
    
    let minX = Math.min(...r.points.map(p => p.x));
    let maxX = Math.max(...r.points.map(p => p.x));
    let minY = Math.min(...r.points.map(p => p.y));
    let maxY = Math.max(...r.points.map(p => p.y));
    
    const padding = 500;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    const container = document.getElementById('canvas-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const scaleX = (containerWidth * 0.9) / (width * MM_TO_PX);
    const scaleY = (containerHeight * 0.9) / (height * MM_TO_PX);
    scale = Math.min(scaleX, scaleY);
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    offsetX = containerWidth / 2 - centerX * MM_TO_PX * scale;
    offsetY = containerHeight / 2 - centerY * MM_TO_PX * scale;
    
    updateZoomLevel();
    draw();
}

// ========== ФУНКЦИИ СТАТИСТИКИ ==========

function updateStats() {
    let listHTML = "";
    let totalArea = 0;
    let totalPerim = 0;
    let totalElemCounts = {};
    
    rooms.forEach((r, idx) => {
        let p = 0, a = 0;
        for(let i=0; i<r.points.length; i++) {
            let j = (i+1)%r.points.length;
            p += Math.sqrt((r.points[j].x-r.points[i].x)**2 + (r.points[j].y-r.points[i].y)**2);
            if(r.closed) a += r.points[i].x * r.points[j].y - r.points[j].x * r.points[i].y;
        }
        let ra = r.closed ? Math.abs(a/2)/1000000 : 0;
        totalArea += ra;
        totalPerim += (p/1000);
        
        if (idx === activeRoom) {
            document.getElementById("roomTitle").innerText = r.name;
            document.getElementById("currentArea").innerText = ra.toFixed(2) + " м²";
            document.getElementById("currentPerim").innerText = (p/1000).toFixed(2) + " м";
            
            if (r.elements?.length > 0) {
                let counts = {};
                r.elements.forEach(el => {
                    let name = el.type === 'pipe' ? 'Обвод трубы' : (window.LIGHT_DATA[el.subtype]?.label || window.EXTRA_DATA[el.subtype]?.label || window.RAIL_DATA[el.subtype]?.label || el.subtype);
                    let key = el.width ? `${name} (${el.width/10} см)` : name;
                    counts[key] = (counts[key] || 0) + 1;
                });
                for (let k in counts) {
                    listHTML += `<div class="estimate-item"><span>${k}</span> <span class="estimate-qty">${counts[k]} шт.</span></div>`;
                }
            } else {
                listHTML = "Нет элементов";
            }
        }
        
        r.elements?.forEach(el => {
            let name = el.type === 'pipe' ? 'Обвод трубы' : (window.LIGHT_DATA[el.subtype]?.label || window.EXTRA_DATA[el.subtype]?.label || window.RAIL_DATA[el.subtype]?.label || el.subtype);
            let key = el.width ? `${name} (${el.width/10} см)` : name;
            totalElemCounts[key] = (totalElemCounts[key] || 0) + 1;
        });
    });
    
    document.getElementById("elementsList").innerHTML = listHTML;
    document.getElementById("totalArea").innerText = totalArea.toFixed(2) + " м²";
    document.getElementById("totalPerim").innerText = totalPerim.toFixed(2) + " м";
    
    let teH = "";
    for (let n in totalElemCounts) {
        teH += `${n}: ${totalElemCounts[n]} шт. | `;
    }
    document.getElementById("totalElements").innerText = teH || "Нет элементов";
    
    return totalElemCounts;
}

// ========== ФУНКЦИЯ ГЕНЕРАЦИИ СМЕТЫ ==========

// ========== ЗАМЕНА ФУНКЦИИ generateFullEstimate ==========
window.generateFullEstimate = function() {
    let totalArea = 0, totalPerim = 0, globalElements = {};
    let canvasDetails = [];
    let profileDetails = [];
    
    rooms.forEach((r, roomIdx) => {
        let p = 0, a = 0;
        for(let i=0; i<r.points.length; i++) {
            let j = (i+1)%r.points.length;
            p += Math.sqrt((r.points[j].x-r.points[i].x)**2 + (r.points[j].y-r.points[i].y)**2);
            if(r.closed) a += r.points[i].x * r.points[j].y - r.points[j].x * r.points[i].y;
        }
        const roomArea = r.closed ? Math.abs(a/2)/1000000 : 0;
        
        const canvasType = r.materials?.canvasType || 'pvc_matte';
        const canvasPrice = window.CANVAS_TYPES?.[canvasType]?.basePrice || 400;
        canvasDetails.push({
            roomName: r.name,
            canvasType: window.CANVAS_TYPES?.[canvasType]?.label || 'ПВХ Матовый',
            area: roomArea,
            price: canvasPrice,
            cost: roomArea * canvasPrice
        });
        
        if (r.materials?.wallProfiles) {
            for (let i = 0; i < r.points.length; i++) {
                const p1 = r.points[i];
                const p2 = r.points[(i + 1) % r.points.length];
                const wallLength = Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2) / 1000;
                const profileType = r.materials.wallProfiles[i] || 'wall_standard';
                const profilePrice = window.PROFILE_TYPES?.[profileType]?.basePrice || 180;
                
                profileDetails.push({
                    roomName: r.name,
                    wallIndex: i+1,
                    profileType: window.PROFILE_TYPES?.[profileType]?.label || 'Стеновой',
                    length: wallLength,
                    price: profilePrice,
                    cost: wallLength * profilePrice
                });
            }
        }
        
        if (r.elements) {
            r.elements.forEach(el => {
                let key = el.subtype || (el.type === 'pipe' ? 'pipe' : el.type);
                if (!globalElements[key]) globalElements[key] = { count: 0, length: 0 };
                globalElements[key].count++;
                if (el.width) globalElements[key].length += (el.width / 1000);
            });
        }
    });
    
    let totalSum = 0, rowsHTML = "";
    
    let canvasByType = {};
    canvasDetails.forEach(d => {
        const key = d.canvasType;
        if (!canvasByType[key]) canvasByType[key] = { area: 0, cost: 0, price: d.price };
        canvasByType[key].area += d.area;
        canvasByType[key].cost += d.cost;
    });
    
    Object.keys(canvasByType).forEach(key => {
        const data = canvasByType[key];
        totalSum += data.cost;
        rowsHTML += `<tr><td>Полотно: ${key}</td><td>${data.area.toFixed(2)} м²</td><td>${data.price}</td><td>${data.cost.toFixed(0)}</td></tr>`;
    });
    
    let profileByType = {};
    profileDetails.forEach(d => {
        const key = d.profileType;
        if (!profileByType[key]) profileByType[key] = { length: 0, cost: 0, price: d.price };
        profileByType[key].length += d.length;
        profileByType[key].cost += d.cost;
    });
    
    Object.keys(profileByType).forEach(key => {
        const data = profileByType[key];
        totalSum += data.cost;
        rowsHTML += `<tr><td>Профиль: ${key}</td><td>${data.length.toFixed(2)} м.п.</td><td>${data.price}</td><td>${data.cost.toFixed(0)}</td></tr>`;
    });
    
    for (let key in globalElements) {
        let data = globalElements[key];
        let def = getElementDef(key);
        let price = window.prices?.[key] || (def?.price || 0);
        let sum = 0;
        let qtyString = "";
        
        if (key === 'pipe') {
            sum = data.count * price;
            qtyString = `${data.count} шт.`;
        } else if (def && def.type === 'linear') {
            sum = data.length * price;
            qtyString = `${data.length.toFixed(2)} м.п.`;
        } else {
            sum = data.count * price;
            qtyString = `${data.count} шт.`;
        }
        
        totalSum += sum;
        let displayName = def?.label || (key === 'pipe' ? 'Обвод трубы' : key);
        rowsHTML += `<tr><td>${displayName}</td><td>${qtyString}</td><td>${price.toFixed(0)}</td><td>${sum.toFixed(0)}</td></tr>`;
    }
    
    // Данные клиента
    let clientName = document.getElementById('clientNameInput')?.value || 'Не указано';
    let clientPhone = document.getElementById('clientPhoneInput')?.value || 'Не указано';
    let clientAddress = document.getElementById('clientAddressInput')?.value || 'Не указано';
    let clientNotes = document.getElementById('clientNotesInput')?.value || '';
    let projectName = document.getElementById('projectNameInput')?.value || 'Новый проект';
    
    // Данные компании
    let companyName = 'Компания';
    let companyPhone = 'Телефон не указан';
    let companyLogo = null;
    let companyFooterText = 'Данная смета действительна в течение 30 дней. Цены указаны с учетом материалов и монтажа.';
    
    if (typeof COMPANY_DATA !== 'undefined' && COMPANY_DATA) {
        companyName = COMPANY_DATA.name || 'Компания';
        companyPhone = COMPANY_DATA.phone || 'Телефон не указан';
        companyLogo = COMPANY_DATA.logo;
        if (COMPANY_DATA.footerText) companyFooterText = COMPANY_DATA.footerText;
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>Смета - ${escapeHtml(projectName)}</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Segoe UI',sans-serif;padding:40px;background:#f0f2f5}
        .container{max-width:1100px;margin:0 auto;background:white;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.1);overflow:hidden}
        .header{background:linear-gradient(135deg,#2c3e50,#1a2634);color:white;padding:25px 35px;display:flex;justify-content:space-between;align-items:center}
        .logo-area{display:flex;align-items:center;gap:20px}
        .logo{max-width:60px;max-height:60px;background:white;border-radius:10px;padding:5px}
        .company-info h2{font-size:18px;margin-bottom:5px}
        .company-info p{font-size:12px;opacity:0.8}
        .document-info{text-align:right}
        .document-info h1{font-size:26px;color:#00bcd4;margin-bottom:5px}
        .client-section{background:#f8f9fa;padding:20px 30px;border-bottom:1px solid #e9ecef}
        .client-section h3{font-size:15px;margin-bottom:12px;color:#2c3e50}
        .client-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;font-size:13px}
        .client-label{font-weight:bold;color:#666;width:70px;display:inline-block}
        .estimate-table{padding:25px 30px}
        .estimate-table h3{font-size:16px;margin-bottom:15px;color:#2c3e50}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #dee2e6;padding:10px 12px;text-align:left}
        th{background:#00bcd4;color:white}
        .total-row{background:#2c3e50;color:white;font-weight:bold}
        .footer{background:#f8f9fa;padding:15px 30px;text-align:center;font-size:10px;color:#999;border-top:1px solid #e9ecef}
        .export-btn{padding:20px 30px;text-align:center}
        .export-pdf-btn{background:linear-gradient(135deg,#e74c3c,#c0392b);color:white;border:none;padding:12px 28px;font-size:14px;font-weight:bold;border-radius:30px;cursor:pointer}
        @media print{.export-btn{display:none}}
    </style>
    </head>
    <body>
    <div class="container" id="estimateContainer">
        <div class="header">
            <div class="logo-area">
                ${companyLogo ? `<img src="${companyLogo}" class="logo">` : '<div style="width:60px;height:60px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:28px;">🏢</div>'}
                <div class="company-info">
                    <h2>${escapeHtml(companyName)}</h2>
                    <p>📞 ${escapeHtml(companyPhone)}</p>
                </div>
            </div>
            <div class="document-info">
                <h1>СМЕТА</h1>
                <p>№ ${Math.random().toString(36).substr(2, 8).toUpperCase()}</p>
                <p>от ${new Date().toLocaleString('ru-RU')}</p>
            </div>
        </div>
        
        <div class="client-section">
            <h3>📋 Информация о клиенте</h3>
            <div class="client-grid">
                <div><span class="client-label">ФИО:</span> ${escapeHtml(clientName)}</div>
                <div><span class="client-label">Телефон:</span> ${escapeHtml(clientPhone)}</div>
                <div><span class="client-label">Адрес:</span> ${escapeHtml(clientAddress)}</div>
                <div><span class="client-label">Объект:</span> ${escapeHtml(projectName)}</div>
            </div>
            ${clientNotes ? `<div style="margin-top:12px;padding-top:12px;border-top:1px dashed #ddd;"><strong>Примечания:</strong> ${escapeHtml(clientNotes)}</div>` : ''}
        </div>
        
        <div class="estimate-table">
            <h3>💰 Смета материалов и работ</h3>
            <table>
                <thead><tr><th>Наименование</th><th>Кол-во</th><th>Цена (руб)</th><th>Сумма (руб)</th></tr></thead>
                <tbody>${rowsHTML}</tbody>
                <tfoot><tr class="total-row"><td colspan="3" style="text-align:right">ИТОГО:</td><td>${totalSum.toFixed(0)} руб.</td></tr></tfoot>
            </table>
        </div>
        
        <div class="footer">
            <p>${escapeHtml(companyFooterText)}</p>
            <p style="margin-top:5px;">Создано в Ceiling Plan PRO • ${new Date().toLocaleString('ru-RU')}</p>
        </div>
        
        <div class="export-btn">
            <button class="export-pdf-btn" onclick="exportPDF()">📄 Экспортировать в PDF</button>
        </div>
    </div>
    
    <script>
        function exportPDF() {
            const element = document.getElementById('estimateContainer');
            html2pdf().set({
                margin: 0.5,
                filename: 'Смета_${new Date().toLocaleDateString('ru-RU')}.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            }).from(element).save();
        }
    </script>
    </body>
    </html>`);
    win.document.close();
}

console.log("✅ Функция generateFullEstimate обновлена!");

// ========== ОСТАЛЬНЫЕ ФУНКЦИИ ==========

function mirrorRoom() {
    saveState();
    let r = rooms[activeRoom];
    if (!r || r.points.length === 0) return;
    let minX = Math.min(...r.points.map(p => p.x));
    let maxX = Math.max(...r.points.map(p => p.x));
    let mid = (minX + maxX) / 2;
    r.points.forEach(p => { p.x = mid - (p.x - mid); });
    if (r.elements) {
        r.elements.forEach(el => {
            el.x = mid - (el.x - mid);
            if (el.rotation) el.rotation = -el.rotation;
        });
    }
    draw();
}

function exportImage() {
    draw(true);
    let svgData = new XMLSerializer().serializeToString(svg);
    let canvas = document.createElement("canvas");
    canvas.width = svg.clientWidth * 2;
    canvas.height = svg.clientHeight * 2;
    let ctx = canvas.getContext("2d");
    let img = new Image();
    
    img.onload = () => {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        let a = document.createElement("a");
        a.download = "plan.png";
        a.href = canvas.toDataURL();
        a.click();
        draw();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
}

function resizeWall(i) {
    let r = rooms[activeRoom];
    let p1 = r.points[i];
    let p2 = r.points[(i + 1) % r.points.length];
    let curLen = Math.round(Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2)/10);
    let n = prompt("Новая длина стены (см):", curLen);
    
    if (n && !isNaN(n)) {
        saveState();
        let nl = n * 10;
        let ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        let dx = Math.cos(ang) * nl - (p2.x - p1.x);
        let dy = Math.sin(ang) * nl - (p2.y - p1.y);
        
        for (let k = (i + 1) % r.points.length; k < r.points.length; k++) {
            if (k === 0 && r.closed) continue;
            r.points[k].x += dx;
            r.points[k].y += dy;
            if (k === 0) break;
        }
        draw();
    }
}

function drawSmartGuides(currentX, currentY, excludeId) {
    let r = rooms[activeRoom];
    if (!r) return;
    
    r.points.forEach(p => {
        if (p.id === excludeId) return;
        
        if (Math.abs(p.x - currentX) < 20) {
            svg.appendChild(createLine(
                mmToPx(p.x, 'x'), 0,
                mmToPx(p.x, 'x'), svg.clientHeight,
                "rgba(0, 188, 212, 0.4)", 1, "5,5"
            ));
        }
        
        if (Math.abs(p.y - currentY) < 20) {
            svg.appendChild(createLine(
                0, mmToPx(p.y, 'y'),
                svg.clientWidth, mmToPx(p.y, 'y'),
                "rgba(0, 188, 212, 0.4)", 1, "5,5"
            ));
        }
    });
}

function updatePlanDisplay() {
    const headerPlan = document.getElementById('header-plan');
    if (!headerPlan || !window.currentUser) return;
    
    if (window.currentUser.plan === 'pro') {
        headerPlan.innerText = "План: PRO";
        headerPlan.style.background = 'var(--gold)';
        headerPlan.style.color = 'var(--dark)';
    } else {
        headerPlan.innerText = "План: FREE";
        headerPlan.style.background = '';
        headerPlan.style.color = '';
    }
}

// ========== ФУНКЦИЯ COMPLETEAUTH ==========

function completeAuth() {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('header-user').innerText = window.currentUser.name;
    document.getElementById('header-plan').innerText = "План: " + window.currentUser.plan.toUpperCase();
    
    if(window.currentUser.plan === 'pro') {
        document.getElementById('header-plan').style.background = 'var(--gold)';
        document.getElementById('header-plan').style.color = 'var(--dark)';
    }

    // Загружаем данные компании
    if (typeof loadCompanyData === 'function') {
        loadCompanyData();
    }

    loadAllSettings();
    
    if (window.currentUser && window.currentUser.uid && window.db) {
        loadCustomElementsFromFirestore(window.currentUser.uid).then(() => initSelectors());
    } else {
        initSelectors();
    }
    
    if(window.currentUser.plan === 'free' && rooms.length > 1) {
        rooms = rooms.slice(0, 1);
        renderTabs();
    } else if (rooms.length === 0) {
        setTimeout(() => {
            showRoomTypeModal();
        }, 500);
    }

    updatePlanDisplay();
    
    if (typeof updateAdminPanelVisibility === 'function') {
        updateAdminPanelVisibility();
    }

    setScaleFor5x5();
    draw();

    if (typeof initMobileHandlers === 'function') {
        initMobileHandlers();
    }
    
    if (typeof initCompanySystem === 'function') {
        initCompanySystem();
    }
}

// ========== ФУНКЦИИ ДЛЯ СОЗДАНИЯ НОВЫХ ПОМЕЩЕНИЙ ==========

// Флаг, чтобы не показывать окно при загрузке проектов
let skipRoomTypeModal = false;

function showRoomTypeModal() {
    if (skipRoomTypeModal) {
        skipRoomTypeModal = false;
        createEmptyRoom();
        return;
    }
    
    if(window.currentUser && window.currentUser.plan === 'free' && rooms.length >= 1) {
        alert("В бесплатном плане доступно только 1 помещение. Перейдите на PRO для безлимита.");
        return;
    }
    
    loadMaterialPrices();
    
    document.getElementById('roomTypeModal').style.display = 'block';
}

function closeRoomTypeModal() {
    document.getElementById('roomTypeModal').style.display = 'none';
}

function selectRoomType(type) {
    closeRoomTypeModal();
    
    if (type === 'rectangle') {
        document.getElementById('rectangleSizeModal').style.display = 'block';
    } else {
        createEmptyRoom();
    }
}

function closeRectangleModal() {
    document.getElementById('rectangleSizeModal').style.display = 'none';
}

function buildRectangleRoom() {
    const lengthCm = parseInt(document.getElementById('rect-length').value);
    const widthCm = parseInt(document.getElementById('rect-width').value);
    
    if (isNaN(lengthCm) || isNaN(widthCm) || lengthCm < 50 || widthCm < 50) {
        alert("Введите корректные размеры (минимум 50 см)");
        return;
    }
    
    closeRectangleModal();
    
    const lengthMm = lengthCm * 10;
    const widthMm = widthCm * 10;
    
    saveState();
    
    const centerX = 0;
    const centerY = 0;
    const halfLength = lengthMm / 2;
    const halfWidth = widthMm / 2;
    
    loadMaterialPrices();
    
    const newRoom = {
        name: "Полотно " + (rooms.length + 1),
        points: [
            { id: Date.now() + 1, x: centerX - halfLength, y: centerY - halfWidth },
            { id: Date.now() + 2, x: centerX + halfLength, y: centerY - halfWidth },
            { id: Date.now() + 3, x: centerX + halfLength, y: centerY + halfWidth },
            { id: Date.now() + 4, x: centerX - halfLength, y: centerY + halfWidth }
        ],
        id: Date.now(),
        closed: true,
        elements: [],
        materials: {
            canvasType: 'pvc_matte',
            wallProfiles: {
                0: 'wall_standard',
                1: 'wall_standard',
                2: 'wall_standard',
                3: 'wall_standard'
            }
        }
    };
    
    rooms.push(newRoom);
    activeRoom = rooms.length - 1;
    renderTabs();
    
    setTimeout(() => {
        showMaterialSelectionModal(activeRoom);
    }, 200);
    
    draw();
}

function setRectSize(lengthCm, widthCm) {
    document.getElementById('rect-length').value = lengthCm;
    document.getElementById('rect-width').value = widthCm;
}

function createEmptyRoom() {
    saveState();
    
    if (typeof loadMaterialPrices === 'function') {
        loadMaterialPrices();
    }
    
    rooms.push({
        name: "Полотно " + (rooms.length + 1),
        points: [],
        id: Date.now(),
        closed: false,
        elements: [],
        materials: {
            canvasType: 'pvc_matte',
            wallProfiles: {}
        }
    });
    
    activeRoom = rooms.length - 1;
    renderTabs();
    draw();
    
    console.log("✅ Создано пустое помещение для ручного рисования");
}

function addRoom() {
    showRoomTypeModal();
}

function loadProjectWithSkip(projectId) {
    skipRoomTypeModal = true;
    loadProject(projectId);
}

// ========== УНИВЕРСАЛЬНЫЕ ФУНКЦИИ ДЛЯ МОДАЛЬНЫХ ОКОН ==========

function showModal(modalId, htmlContent, onClose = null) {
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalContainer = document.createElement('div');
    modalContainer.id = modalId;
    modalContainer.className = 'modal';
    modalContainer.style.display = 'block';
    modalContainer.style.zIndex = '6000';
    modalContainer.innerHTML = htmlContent;
    
    document.body.appendChild(modalContainer);
    
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) {
            closeModal(modalId, onClose);
        }
    });
    
    return modalContainer;
}

function closeModal(modalId, onClose = null) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
        if (onClose && typeof onClose === 'function') {
            onClose();
        }
    }
}

// ========== ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ==========

window.scale = scale;
window.offsetX = offsetX;
window.offsetY = offsetY;
window.rooms = rooms;
window.activeRoom = activeRoom;
window.currentTool = currentTool;
window.showDiagonals = showDiagonals;
window.showMeasures = showMeasures;
window.history = history;

window.saveState = saveState;
window.undo = undo;
window.setTool = setTool;
window.toggleDiagonals = toggleDiagonals;
window.toggleMeasures = toggleMeasures;
window.renameRoom = renameRoom;
window.mmToPx = mmToPx;
window.pxToMm = pxToMm;
window.snap = snap;
window.getSnappedPos = getSnappedPos;
window.draw = draw;
window.addRoom = addRoom;
window.removeRoom = removeRoom;
window.renderTabs = renderTabs;
window.updateZoomLevel = updateZoomLevel;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetView = resetView;
window.updateStats = updateStats;
window.mirrorRoom = mirrorRoom;
window.exportImage = exportImage;
window.setScaleFor5x5 = setScaleFor5x5;
window.centerView = centerView;
window.generateFullEstimate = generateFullEstimate;
window.completeAuth = completeAuth;
window.resizeWall = resizeWall;
window.showRoomTypeModal = showRoomTypeModal;
window.selectRoomType = selectRoomType;
window.buildRectangleRoom = buildRectangleRoom;
window.closeRoomTypeModal = closeRoomTypeModal;
window.closeRectangleModal = closeRectangleModal;
window.skipRoomTypeModal = skipRoomTypeModal;
window.setRectSize = setRectSize;
window.showModal = showModal;
window.closeModal = closeModal;