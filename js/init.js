// js/init.js

// Глобальные переменные
let currentUser = null;
let selectedRegPlan = 'free';
let db = null;
let auth = null;

// Функция инициализации Firebase
function initializeFirebase() {
    if (typeof firebase !== 'undefined') {
        try {
            window.auth = firebase.auth();
            window.db = firebase.firestore();
            
            auth = window.auth;
            db = window.db;
            
            console.log("✅ Firebase сервисы готовы");
            console.log("🔑 auth доступен:", auth !== null);
            
            return true;
        } catch (error) {
            console.error("❌ Ошибка инициализации Firebase:", error);
            return false;
        }
    } else {
        console.error("❌ Firebase не загружен");
        return false;
    }
}

function updateCurrentUser(userData) {
    window.currentUser = userData;
    currentUser = userData;
    console.log("👤 currentUser обновлен:", currentUser.email, "план:", currentUser.plan);
}

function migrateOldPrices() {
    delete prices['Полотно (м2)'];
    delete prices['Профиль (м.п.)'];
    
    const savedPrices = localStorage.getItem('cp_prices_15');
    if (savedPrices) {
        const oldPrices = JSON.parse(savedPrices);
        delete oldPrices['Полотно (м2)'];
        delete oldPrices['Профиль (м.п.)'];
        localStorage.setItem('cp_prices_15', JSON.stringify(oldPrices));
    }
    
    console.log("✅ Миграция цен выполнена");
}

window.migrateOldPrices = migrateOldPrices;
window.updateCurrentUser = updateCurrentUser;
window.currentUser = currentUser;
window.selectedRegPlan = selectedRegPlan;
window.initializeFirebase = initializeFirebase;

setTimeout(() => {
    if (typeof checkForUpdates === 'function') {
        checkForUpdates();
    }
}, 2000);