// js/auth.js

function handleLogin() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('pass').value;

    if(!email || !pass) { 
        alert("Введите email и пароль"); 
        return; 
    }
    
    if (!window.auth) { 
        alert("Сервис входа временно недоступен. Пожалуйста, обновите страницу."); 
        console.error("❌ auth не инициализирован");
        return; 
    }

    console.log("🔄 Попытка входа...");

    window.auth.signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            console.log("✅ Вход выполнен:", userCredential.user.email);
        })
        .catch((error) => {
            console.error("❌ Ошибка входа:", error);
            let errorMessage = "Ошибка входа: ";
            if (error.code === 'auth/user-not-found') {
                errorMessage += "Пользователь не найден.";
            } else if (error.code === 'auth/wrong-password') {
                errorMessage += "Неверный пароль.";
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage += "Проблема с интернет-соединением.";
            } else {
                errorMessage += error.message;
            }
            alert(errorMessage);
        });
}

function toggleAuthForms() {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('reg-form');
    
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
        // При открытии формы регистрации сбрасываем выбор на FREE
        selectPlan('free');
        // Очищаем временные данные
        window.tempLogoBase64 = null;
        const preview = document.getElementById('reg-logo-preview');
        if (preview) {
            preview.innerHTML = '<span style="font-size: 24px;">🏢</span>';
        }
    }
}

// Обновленная функция выбора тарифа
function selectPlan(plan) {
    window.selectedRegPlan = plan;
    document.getElementById('p-free').classList.toggle('active', plan === 'free');
    document.getElementById('p-pro').classList.toggle('active', plan === 'pro');
    
    // Показываем/скрываем блок данных компании в зависимости от выбранного тарифа
    const companyBlock = document.getElementById('company-data-block');
    if (companyBlock) {
        companyBlock.style.display = plan === 'pro' ? 'block' : 'none';
        console.log("🏢 Блок данных компании:", plan === 'pro' ? "ПОКАЗАН" : "СКРЫТ");
    }
}

// Обновленная функция регистрации
function handleRegister() {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const plan = window.selectedRegPlan || 'free';
    
    // Проверка обязательных полей
    if(!name || !email || !pass) { 
        alert("Заполните все поля"); 
        return; 
    }

    if (!window.auth || !window.db) { 
        alert("Сервис регистрации временно недоступен. Пожалуйста, обновите страницу."); 
        return; 
    }

    // Данные компании собираем ТОЛЬКО если выбран PRO
    let companyData = {};
    let companyLogo = null;
    
    if (plan === 'pro') {
        const companyName = document.getElementById('reg-company-name')?.value || '';
        const companyPhone = document.getElementById('reg-company-phone')?.value || '';
        const companyEmail = document.getElementById('reg-company-email')?.value || '';
        const companyWebsite = document.getElementById('reg-company-website')?.value || '';
        const companyInn = document.getElementById('reg-company-inn')?.value || '';
        const companyAddress = document.getElementById('reg-company-address')?.value || '';
        const companyFooter = document.getElementById('reg-company-footer')?.value || '';
        companyLogo = window.tempLogoBase64 || null;
        
        companyData = {
            name: companyName,
            phone: companyPhone,
            email: companyEmail,
            website: companyWebsite,
            inn: companyInn,
            address: companyAddress,
            footerText: companyFooter || 'Данная смета действительна в течение 30 дней. Цены указаны с учетом материалов и монтажа.',
            logo: companyLogo,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Валидация для PRO: хотя бы название компании
        if (plan === 'pro' && !companyName) {
            if (!confirm("Вы не заполнили название компании. Это можно будет сделать позже в настройках. Продолжить?")) {
                return;
            }
        }
    }

    console.log("🔄 Регистрация... План:", plan);

    window.auth.createUserWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            const user = userCredential.user;
            
            return user.updateProfile({
                displayName: name
            }).then(() => {
                const userData = {
                    name: name,
                    email: email,
                    plan: plan === 'pro' ? 'pending' : 'free',
                    registeredAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Добавляем данные компании только для PRO
                if (plan === 'pro' && Object.keys(companyData).length > 0) {
                    userData.company = companyData;
                }

                if (plan === 'pro') {
                    userData.subscription = {
                        status: 'pending',
                        startDate: null,
                        endDate: null,
                        autoRenew: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                }

                return window.db.collection('users').doc(user.uid).set(userData);
            }).then(() => {
                console.log("✅ Аккаунт создан");
                if (plan === 'pro') {
                    alert("Регистрация успешна! После оплаты вам откроется доступ к PRO возможностям. Теперь войдите в систему.");
                } else {
                    alert("Регистрация успешна! Теперь войдите в систему.");
                }
                window.location.reload();
            });
        })
        .catch((error) => {
            console.error("❌ Ошибка регистрации:", error);
            let errorMessage = "Ошибка регистрации: ";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage += "Этот email уже используется.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage += "Пароль слишком слабый (минимум 6 символов).";
            } else {
                errorMessage += error.message;
            }
            alert(errorMessage);
        });
}

// Функция для предпросмотра логотипа при регистрации
function setupLogoPreview() {
    const logoUpload = document.getElementById('reg-logo-upload');
    if (logoUpload) {
        logoUpload.onchange = async (e) => {
            const file = e.target.files[0];
            if (file && file.type.match('image.*')) {
                if (file.size > 2 * 1024 * 1024) {
                    alert('Размер файла не должен превышать 2MB');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    const preview = document.getElementById('reg-logo-preview');
                    if (preview) {
                        preview.innerHTML = `<img src="${event.target.result}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                    }
                    window.tempLogoBase64 = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
    }
}

// Инициализация формы регистрации
function initRegistrationForm() {
    setupLogoPreview();
    
    // По умолчанию блок компании скрыт (FREE)
    const companyBlock = document.getElementById('company-data-block');
    if (companyBlock) {
        companyBlock.style.display = 'none';
    }
    
    // Устанавливаем тариф FREE по умолчанию
    window.selectedRegPlan = 'free';
}

// Вызываем инициализацию при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRegistrationForm);
} else {
    initRegistrationForm();
}

function handleLogout() {
    if(confirm("Выйти из системы?")) {
        if (window.auth) {
            window.auth.signOut().then(() => {
                location.reload();
            }).catch(console.error);
        } else {
            localStorage.removeItem('saas_last_user');
            location.reload();
        }
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: #4caf50; color: white; padding: 12px 24px;
            border-radius: 30px; font-weight: bold; z-index: 10001;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        `;
        notification.textContent = '✅ Команда скопирована!';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    }).catch(() => {
        alert('Скопируйте команду вручную:\n\n' + text);
    });
}

function linkTelegram() {
    if (!window.currentUser || !window.currentUser.uid) {
        alert("Сначала войдите в систему");
        return;
    }
    
    const uid = window.currentUser.uid;
    const email = window.currentUser.email || '';
    const command = `/start link_${uid}_${email}`;
    
    navigator.clipboard.writeText(command).then(() => {
        window.open('https://t.me/CeilingPlanPRO_Bot', '_blank');
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: #4caf50; color: white; padding: 12px 24px;
            border-radius: 30px; font-weight: bold; z-index: 10000;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        `;
        notification.textContent = '✅ Команда скопирована! Вставьте в Telegram';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }).catch(() => {
        alert(`Отправьте эту команду в Telegram:\n\n${command}`);
        window.open('https://t.me/CeilingPlanPRO_Bot', '_blank');
    });
}

// ========== ЭКСПОРТ ==========
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.toggleAuthForms = toggleAuthForms;
window.selectPlan = selectPlan;
window.handleLogout = handleLogout;
window.copyToClipboard = copyToClipboard;
window.linkTelegram = linkTelegram;

console.log("✅ Модуль auth.js загружен");