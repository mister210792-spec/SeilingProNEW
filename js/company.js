// js/company.js - Управление данными компании и брендированием

// Глобальные переменные
let COMPANY_DATA = {
    name: '',
    phone: '',
    logo: null,
    email: '',
    website: '',
    inn: '',
    address: '',
    footerText: 'Данная смета действительна в течение 30 дней. Цены указаны с учетом материалов и монтажа.'
};

// ========== ЗАГРУЗКА ДАННЫХ КОМПАНИИ ==========

async function loadCompanyData() {
    if (!window.currentUser || !window.currentUser.uid) return;
    
    try {
        const userDoc = await window.db.collection('users').doc(window.currentUser.uid).get();
        if (userDoc.exists && userDoc.data().company) {
            COMPANY_DATA = { ...COMPANY_DATA, ...userDoc.data().company };
            console.log("✅ Данные компании загружены:", COMPANY_DATA.name);
        }
    } catch (error) {
        console.error("❌ Ошибка загрузки данных компании:", error);
    }
    
    const localData = localStorage.getItem('cp_company_data');
    if (localData && !COMPANY_DATA.name) {
        try {
            COMPANY_DATA = { ...COMPANY_DATA, ...JSON.parse(localData) };
        } catch(e) {}
    }
}

// ========== СОХРАНЕНИЕ ДАННЫХ КОМПАНИИ ==========

async function saveCompanyData() {
    if (!window.currentUser || !window.currentUser.uid) {
        alert('Сначала войдите в систему');
        return false;
    }
    
    localStorage.setItem('cp_company_data', JSON.stringify(COMPANY_DATA));
    
    try {
        await window.db.collection('users').doc(window.currentUser.uid).update({
            company: {
                name: COMPANY_DATA.name,
                phone: COMPANY_DATA.phone,
                logo: COMPANY_DATA.logo,
                email: COMPANY_DATA.email,
                website: COMPANY_DATA.website,
                inn: COMPANY_DATA.inn,
                address: COMPANY_DATA.address,
                footerText: COMPANY_DATA.footerText,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }
        });
        console.log("✅ Данные компании сохранены в облако");
        return true;
    } catch (error) {
        console.error("❌ Ошибка сохранения:", error);
        alert('Ошибка сохранения: ' + error.message);
        return false;
    }
}

// ========== ЗАГРУЗКА ЛОГОТИПА ==========

function uploadCompanyLogo(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject('Файл не выбран');
            return;
        }
        
        if (!file.type.match('image.*')) {
            reject('Можно загружать только изображения');
            return;
        }
        
        if (file.size > 2 * 1024 * 1024) {
            reject('Размер файла не должен превышать 2MB');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxSize = 200;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                COMPANY_DATA.logo = canvas.toDataURL('image/png');
                resolve(COMPANY_DATA.logo);
            };
            img.src = base64;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ========== МОДАЛЬНОЕ ОКНО НАСТРОЕК ==========

function openCompanySettingsModal() {
    const existingModal = document.getElementById('companySettingsModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'companySettingsModal';
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.style.zIndex = '6000';
    
    modal.innerHTML = `
        <div class="modal-content" style="width: 550px; max-width: 95%; max-height: 90vh; overflow-y: auto;">
            <h3 style="margin-top: 0; color: var(--primary);">🏢 Настройки компании</h3>
            <p style="font-size: 12px; color: #666; margin-bottom: 20px;">Эти данные будут отображаться в PDF-сметах</p>
            
            <div style="margin-bottom: 20px;">
                <label style="font-weight: bold; display: block; margin-bottom: 8px;">Логотип компании</label>
                <div style="display: flex; gap: 15px; align-items: center;">
                    <div id="company-logo-preview" style="width: 80px; height: 80px; background: #f5f5f5; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 2px solid #e0e0e0; overflow: hidden;">
                        ${COMPANY_DATA.logo ? `<img src="${COMPANY_DATA.logo}" style="max-width: 100%; max-height: 100%; object-fit: contain;">` : '<span style="font-size: 32px;">🏢</span>'}
                    </div>
                    <div style="flex: 1;">
                        <input type="file" id="company-logo-upload" accept="image/*" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                        <button onclick="clearCompanyLogo()" style="margin-top: 8px; background: #f0f0f0; border: none; padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">🗑️ Удалить</button>
                        <p style="font-size: 10px; color: #999; margin-top: 5px;">Рекомендуемый размер: 200x200px, PNG</p>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">Название компании *</label>
                <input type="text" id="company-name" class="auth-input" value="${escapeHtml(COMPANY_DATA.name)}" placeholder="Например: ООО «Потолки PRO»">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">Телефон *</label>
                <input type="tel" id="company-phone" class="auth-input" value="${escapeHtml(COMPANY_DATA.phone)}" placeholder="+7 (999) 123-45-67">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">Email (опционально)</label>
                <input type="email" id="company-email" class="auth-input" value="${escapeHtml(COMPANY_DATA.email)}" placeholder="info@company.ru">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">Сайт (опционально)</label>
                <input type="text" id="company-website" class="auth-input" value="${escapeHtml(COMPANY_DATA.website)}" placeholder="company.ru">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">ИНН (опционально)</label>
                <input type="text" id="company-inn" class="auth-input" value="${escapeHtml(COMPANY_DATA.inn)}" placeholder="1234567890">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">Юридический адрес (опционально)</label>
                <textarea id="company-address" class="auth-input" rows="2" placeholder="г. Москва, ул. Строителей, д. 15">${escapeHtml(COMPANY_DATA.address)}</textarea>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">Текст подвала сметы</label>
                <textarea id="company-footer" class="auth-input" rows="2">${escapeHtml(COMPANY_DATA.footerText)}</textarea>
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
                <button onclick="saveCompanySettings()" class="auth-btn" style="background: var(--success); flex: 2;">💾 Сохранить настройки</button>
                <button onclick="closeCompanySettingsModal()" class="auth-btn" style="background: #eee; flex: 1;">Отмена</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeCompanySettingsModal();
        }
    });
    
    const logoUpload = document.getElementById('company-logo-upload');
    if (logoUpload) {
        logoUpload.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await uploadCompanyLogo(file);
                    const preview = document.getElementById('company-logo-preview');
                    if (preview) {
                        preview.innerHTML = `<img src="${COMPANY_DATA.logo}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                    }
                    showNotification('✅ Логотип загружен');
                } catch (error) {
                    alert('Ошибка загрузки: ' + error);
                }
            }
        };
    }
}

function closeCompanySettingsModal() {
    const modal = document.getElementById('companySettingsModal');
    if (modal) modal.remove();
}

function clearCompanyLogo() {
    COMPANY_DATA.logo = null;
    const preview = document.getElementById('company-logo-preview');
    if (preview) {
        preview.innerHTML = '<span style="font-size: 32px;">🏢</span>';
    }
    showNotification('🗑️ Логотип удален');
}

async function saveCompanySettings() {
    COMPANY_DATA.name = document.getElementById('company-name')?.value.trim() || '';
    COMPANY_DATA.phone = document.getElementById('company-phone')?.value.trim() || '';
    COMPANY_DATA.email = document.getElementById('company-email')?.value.trim() || '';
    COMPANY_DATA.website = document.getElementById('company-website')?.value.trim() || '';
    COMPANY_DATA.inn = document.getElementById('company-inn')?.value.trim() || '';
    COMPANY_DATA.address = document.getElementById('company-address')?.value.trim() || '';
    COMPANY_DATA.footerText = document.getElementById('company-footer')?.value.trim() || '';
    
    if (!COMPANY_DATA.name) {
        alert('Введите название компании');
        return;
    }
    if (!COMPANY_DATA.phone) {
        alert('Введите телефон компании');
        return;
    }
    
    const success = await saveCompanyData();
    if (success) {
        closeCompanySettingsModal();
        showNotification('✅ Настройки компании сохранены');
    }
}

function getCompanyDataForPDF() {
    return {
        name: COMPANY_DATA.name || 'Компания',
        phone: COMPANY_DATA.phone || 'Телефон не указан',
        logo: COMPANY_DATA.logo,
        email: COMPANY_DATA.email,
        website: COMPANY_DATA.website,
        inn: COMPANY_DATA.inn,
        address: COMPANY_DATA.address,
        footerText: COMPANY_DATA.footerText
    };
}

function initCompanySystem() {
    loadCompanyData();
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: #4caf50; color: white;
        padding: 12px 24px; border-radius: 30px; z-index: 10001; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: slideIn 0.3s, fadeOut 0.3s 2.7s;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// ========== ДОБАВЛЯЕМ АНИМАЦИИ ==========
if (!document.getElementById('company-styles')) {
    const style = document.createElement('style');
    style.id = 'company-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// ========== ЭКСПОРТ ==========
window.COMPANY_DATA = COMPANY_DATA;
window.loadCompanyData = loadCompanyData;
window.saveCompanyData = saveCompanyData;
window.uploadCompanyLogo = uploadCompanyLogo;
window.openCompanySettingsModal = openCompanySettingsModal;
window.closeCompanySettingsModal = closeCompanySettingsModal;
window.clearCompanyLogo = clearCompanyLogo;
window.saveCompanySettings = saveCompanySettings;
window.getCompanyDataForPDF = getCompanyDataForPDF;
window.initCompanySystem = initCompanySystem;

console.log("✅ Модуль компании загружен");