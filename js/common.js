// StarPayUz - Common JavaScript Functions

const STARS_MIN = 50;
const STARS_MAX = 1000000;

const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();
tg.setHeaderColor('#030712');
tg.setBackgroundColor('#030712');

let userBalance = 0;

// API base — can be overridden per-page via window.API_BASE
// e.g. in stars.html:    <script>window.API_BASE = 'https://web-production-49c65.up.railway.app';</script>
function getApiBase() {
    if (typeof window.API_BASE !== 'undefined' && window.API_BASE && window.API_BASE.trim() !== '') {
        return window.API_BASE.replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.location && window.location.protocol && window.location.protocol.startsWith('http')) {
        return window.location.origin;
    }
    return '';
}










document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    fillUsernameFromTelegram();
    setupUserProfileHeader();
    loadUserBalance();
    applyTranslations();
    hideLoader();

    // Real-time live balance auto-sync every 3 seconds
    setInterval(loadUserBalance, 3000);
});

function initTheme() {
    const savedTheme = localStorage.getItem('starpay_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('starpay_theme', isLight ? 'light' : 'dark');
}

function setupUserProfileHeader() {
    const user = tg.initDataUnsafe?.user;
    const nameEl = document.getElementById('profileName');
    const idEl = document.getElementById('profileUserId');
    const placeholderEl = document.getElementById('avatarPlaceholder');
    const avatarImg = document.getElementById('avatarImg');

    const uid = getUserId();

    if (user) {
        if (nameEl) nameEl.textContent = (user.first_name || '') + (user.last_name ? ' ' + user.last_name : '');
        if (idEl) idEl.textContent = 'ID: ' + (user.id || uid || '—');
        if (placeholderEl && user.first_name) placeholderEl.textContent = user.first_name.charAt(0).toUpperCase();
        if (avatarImg && user.photo_url) {
            avatarImg.src = user.photo_url;
            avatarImg.style.display = 'block';
            if (placeholderEl) placeholderEl.style.display = 'none';
        }
    } else if (uid) {
        if (nameEl && !nameEl.textContent.trim()) nameEl.textContent = 'Foydalanuvchi';
        if (idEl) idEl.textContent = 'ID: ' + uid;
    } else {
        if (nameEl && !nameEl.textContent.trim()) nameEl.textContent = 'Foydalanuvchi';
        if (idEl) idEl.textContent = 'ID: —';
    }
}

function updateStarsEquivalent(bal) {
    const starsEl = document.getElementById('starsEquivalent');
    if (starsEl) {
        const starsEquiv = Math.floor((bal || 0) / 200);
        starsEl.textContent = starsEquiv.toLocaleString('uz-UZ');
    }
}

function fillUsernameFromTelegram() {
    const input = document.getElementById('username');
    const user = tg.initDataUnsafe?.user;
    if (input && user?.username && !input.value.trim()) {
        input.value = '@' + user.username;
    }
}

function getUserId() {
    // 1. Check URL parameters from Telegram WebApp button
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const uidParam = urlParams.get('uid') || urlParams.get('user_id');
        if (uidParam && !isNaN(parseInt(uidParam, 10))) {
            const uid = parseInt(uidParam, 10);
            try { localStorage.setItem('starpay_user_id', String(uid)); } catch(e) {}
            return uid;
        }
    } catch(e) {}

    // 2. Official source: Telegram WebApp initDataUnsafe
    if (tg.initDataUnsafe?.user?.id) {
        const uid = tg.initDataUnsafe.user.id;
        try { localStorage.setItem('starpay_user_id', String(uid)); } catch(e) {}
        return uid;
    }

    // 3. Parse from Telegram initData signed string
    if (tg.initData) {
        try {
            const parsedParams = new URLSearchParams(tg.initData);
            const userStr = parsedParams.get('user');
            if (userStr) {
                const userObj = JSON.parse(userStr);
                if (userObj && userObj.id) {
                    const uid = userObj.id;
                    try { localStorage.setItem('starpay_user_id', String(uid)); } catch(e) {}
                    return uid;
                }
            }
        } catch(e) {}
    }

    try {
        const cached = localStorage.getItem('starpay_user_id');
        if (cached) return parseInt(cached, 10);
    } catch(e) {}

    return null;
}

let _initialBalRendered = false;

function setBalUI(val) {
    userBalance = Number(val) || 0;
    const formatted = userBalance.toLocaleString('uz-UZ');

    const balanceElement = document.getElementById('balance');
    if (balanceElement) {
        balanceElement.textContent = formatted;
    }

    const userBalanceStat = document.getElementById('userBalanceStat');
    if (userBalanceStat) {
        userBalanceStat.textContent = formatted;
    }

    document.querySelectorAll('.live-user-balance').forEach(el => {
        el.textContent = formatted;
    });

    updateStarsEquivalent(userBalance);
}

function loadUserBalance() {
    const userId = getUserId();
    if (!userId) {
        setBalUI(0);
        return;
    }

    // Initial instant optimistic render (ONLY ONCE ON FIRST LOAD)
    if (!_initialBalRendered) {
        _initialBalRendered = true;
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlBal = urlParams.get('bal') || urlParams.get('balance');
            if (urlBal !== null && !isNaN(parseInt(urlBal, 10))) {
                setBalUI(parseInt(urlBal, 10));
            } else {
                const cachedBal = localStorage.getItem('starpay_balance_' + userId);
                if (cachedBal !== null) {
                    setBalUI(parseInt(cachedBal, 10) || 0);
                }
            }
        } catch(e) {}
    }

    const apiBase = getApiBase();
    const fetchBalance = (url) => {
        return fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': tg.initData || '',
            },
            body: JSON.stringify({ telegram_id: userId, initData: tg.initData || '' }),
        }).then(r => r.json());
    };

    fetchBalance((apiBase ? apiBase : '') + '/api/user/balance?t=' + Date.now())
    .then(data => {
        if (data && data.ok && data.balance !== undefined) {
            const newBal = Number(data.balance);
            setBalUI(newBal);
            try { localStorage.setItem('starpay_balance_' + userId, String(newBal)); } catch(e) {}
        } else if (apiBase !== '') {
            return fetchBalance('/api/user/balance?t=' + Date.now()).then(data2 => {
                if (data2 && data2.ok && data2.balance !== undefined) {
                    const newBal = Number(data2.balance);
                    setBalUI(newBal);
                    try { localStorage.setItem('starpay_balance_' + userId, String(newBal)); } catch(e) {}
                }
            });
        }
    })
    .catch(() => {
        fetchBalance('/api/user/balance?t=' + Date.now())
        .then(data2 => {
            if (data2 && data2.ok && data2.balance !== undefined) {
                const newBal = Number(data2.balance);
                setBalUI(newBal);
                try { localStorage.setItem('starpay_balance_' + userId, String(newBal)); } catch(e) {}
            }
        })
        .catch(() => {});
    });
}


function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function getUsername(inputId) {
    const val = (document.getElementById(inputId || 'username')?.value || '').trim();
    if (!val || val === '@') return null;
    return val.startsWith('@') ? val : '@' + val;
}

function setBuyButtonLoading(btnId, loading) {
    const btn = document.getElementById(btnId || 'buyBtn');
    if (!btn) return;
    if (loading) {
        btn.dataset.originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = t('common.sending');
    } else {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || t('common.buy');
    }
}

/**
 * Submit order via HTTP POST to the API server.
 * Works with both inline and reply keyboard WebApp buttons.
 *
 * payload fields:
 *   action: 'buy_stars' | 'buy_premium' | 'buy_gift' | 'buy_phone'
 *   + action-specific fields (amount, username, duration, etc.)
 */
async function submitOrder(payload, btnId) {
    setBuyButtonLoading(btnId, true);

    // Map action → API endpoint
    const endpoints = {
        buy_stars:   '/api/order/stars',
        buy_premium: '/api/order/premium',
        buy_gift:    '/api/order/gift',
        buy_phone:   '/api/order/phone',
    };

    const endpoint = endpoints[payload.action];
    if (!endpoint) {
        setBuyButtonLoading(btnId, false);
        tg.showAlert(t('common.unknown_order'));
        return;
    }

    // Build request body — rename fields to what the API expects
    const body = { ...payload };
    if (payload.action === 'buy_stars') {
        body.quantity = payload.amount;
    }
    if (payload.action === 'buy_premium') {
        body.months = payload.duration;
    }

    // Pass Telegram initData for auth
    body.initData = tg.initData || '';
    body.telegram_id = tg.initDataUnsafe?.user?.id || null;

    try {
        const response = await fetch(getApiBase() + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': tg.initData || '',
                'Bypass-Tunnel-Reminder': 'true',
            },
            body: JSON.stringify(body),
        });

        const result = await response.json();

        if (result.ok) {
            const successMessages = {
                buy_stars:   t('success.stars'),
                buy_premium: t('success.premium'),
                buy_gift:    t('success.gift'),
                buy_phone:   t('success.phone'),
            };
            tg.showPopup({
                title: t('success.title'),
                message: successMessages[payload.action] || t('success.order_done'),
                buttons: [{ type: 'ok' }]
            }, () => tg.close());
        } else {
            setBuyButtonLoading(btnId, false);
            tg.showPopup({
                title: t('error.title'),
                message: result.error || t('error.retry'),
                buttons: [{ type: 'close' }]
            });
        }
    } catch (e) {
        setBuyButtonLoading(btnId, false);
        tg.showPopup({
            title: t('error.network_title'),
            message: e.message || t('error.network'),
            buttons: [{ type: 'close' }]
        });
    }
}

function setupPurchaseButton(onClick, text) {
    const label = text || t('common.buy');
    const btn = document.getElementById('buyBtn');
    if (!btn) return;

    btn.disabled = false;
    btn.textContent = label;
    btn.onclick = onClick;

    if (tg.MainButton) {
        tg.MainButton.hide();
    }
}

// ===== LOADER =====
function showLoader(text) {
  const overlay = document.getElementById('loaderOverlay');
  if (!overlay) return;
  const sub = overlay.querySelector('.loader-sub');
  if (sub && text) sub.textContent = text;
  overlay.classList.remove('hidden');
}

function hideLoader() {
  const overlay = document.getElementById('loaderOverlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
}

function validateStarsAmount(amount) {
    const n = parseInt(amount, 10);
    if (isNaN(n) || n < STARS_MIN) {
        return { ok: false, message: `${t('validate.min_stars')}`.replace('{min}', STARS_MIN) };
    }
    if (n > STARS_MAX) {
        return { ok: false, message: `${t('validate.max_stars')}`.replace('{max}', STARS_MAX.toLocaleString('uz-UZ')) };
    }
    return { ok: true, value: n };
}

// ===== i18n =====
const LANGUAGES = {
    uz: { name: "O'zbek", nativeName: "O'zbekcha" },
    ru: { name: "Русский", nativeName: "Русский" },
};

const TRANSLATIONS = {
    uz: {
        'rating.title': 'Savdo Statistikasi',
        'rating.subtitle': 'Eng yaxshi sotuvchilar reytingi',
        'rating.tab.today': 'Bugun',
        'rating.tab.week': 'Shu Hafta',
        'rating.tab.month': 'Shu Oy',
        'rating.tab.all': 'Barcha Vaqt',
        'rating.loading': 'Yuklanmoqda...',
        'rating.empty': "Hozircha ma'lumot yo'q",
        'rating.error': 'Yuklashda xatolik yuz berdi',
        'nav.menu': 'Menu',
        'nav.gifts': 'Gift',
        'nav.rating': 'Reyting',
        'nav.profile': 'Profil',
        'common.loading': 'Yuklanmoqda...',
        'common.sending': 'Yuborilmoqda...',
        'common.buy': 'Sotib olish',
        'common.unknown_order': "Noma'lum buyurtma turi.",
        'success.title': '✅ Muvaffaqiyatli',
        'success.stars': '⭐ Stars muvaffaqiyatli sotib olindi!',
        'success.premium': '💎 Premium obuna muvaffaqiyatli faollashtirildi!',
        'success.gift': "🎁 Sovg'a muvaffaqiyatli yuborildi!",
        'success.phone': '📱 Virtual raqam muvaffaqiyatli olindi!',
        'success.order_done': 'Buyurtma bajarildi!',
        'error.title': '❌ Xatolik',
        'error.retry': "Qayta urinib ko'ring",
        'error.network_title': '❌ Tarmoq xatoligi',
        'error.network': "Serverga ulanib bo'lmadi. Qayta urinib ko'ring.",
        'validate.min_stars': 'Minimal miqdor: {min} stars',
        'validate.max_stars': "Maksimal miqdor: {max} stars",
        'loader.text': 'Yuklanmoqda...',
        'loader.sub': 'Yuklanmoqda...',

        'common.recipient': 'Qabul qiluvchi',
        'common.enter_username': 'Username kiriting',

        'profile.section.main': 'ASOSIY',
        'profile.gifts': "Giftlarim",
        'profile.referrals': 'Takliflarim',
        'profile.section.transactions': 'TRANZAKSIYALAR',
        'profile.section.settings': 'SOZLAMALAR',
        'profile.support': "Qo'llab-quvvatlash",
        'profile.news_channel': 'Yangiliklar kanali',
        'profile.news': "Yangiliklar va E'lonlar",
        'profile.news_sub': 'Rasmiy telegram kanalimiz: @CoinStatUz',
        'profile.konkurs': "Konkurs bo'limi",
        'profile.konkurs_badge': 'FAOL',
        'profile.konkurs_sub': 'Aksiya va yutuqli konkurslarda qatnashish',
        'stats.title': 'Statistika prodaj',
        'stats.view': "Ko'rish",
        'stats.today': 'Bugun',
        'stats.week': 'Shu Hafta',
        'stats.month': 'Shu Oy',
        'stats.all': 'Barcha Vaqt',
        'stats.successful_orders': 'Muvaffaqiyatli buyurtmalar',
        'stats.total_spent': 'Jami sarflangan',
        'profile.referral_title': 'REFERRAL',
        'profile.referral_desc': "Do'stlaringizni taklif qiling va ularning xaridlaridan bonus oling!",
        'profile.referral_stars': 'Telegram Stars',
        'profile.invite_friends': "Do'stlarni taklif qilish",
        'profile.language': 'Til',
        'profile.lang_uz': "O'zbekcha",
        'profile.lang_ru': 'Русский',

        'stars.tab': 'Stars olish',
        'stars.title': 'Telegram Stars sotib olish',
        'stars.available_prefix': 'Mavjud:',
        'stars.amount': 'Stars miqdori',
        'stars.hint': 'Minimal: {min} · Maksimal: {max} stars',

        'premium.tab': 'Premium olish',
        'premium.title': 'Premium sotib olish',
        'premium.duration': 'Davomiylik',
        'premium.select_duration': 'Davomiylikni tanlang',

        'gift.title': 'Gift olish',
        'gift.subtitle': "O'zingizga yoki do'stingizga gift yuboring",
        'gift.tab.regular': 'Giftlar',
        'gift.tab.nft': 'NFT Giftlar',
        'gift.coming_soon': 'Tez orada',
        'gift.not_selected': 'Gift tanlanmagan',
        'gift.regular_title': 'Oddiy giftlar',
        'gift.nft_title': 'NFT kolleksiya',
        'gift.for_myself': "O'zim uchun",
        'gift.anonymous': "Anonim jo'natish",
        'gift.add_comment': "Izoh qo'shish",
        'gift.comment_placeholder': 'Izoh...',
        'gift.price': 'Gift narxi',
        'gift.total': 'Jami:',
        'gift.buy': "Sovg'a olish",

        'topup.title': "Hisobni to'ldirish",
        'topup.enter_amount': 'Summani kiriting',
        'topup.pay': "To'lovni amalga oshirish",
        'topup.limit_hint': "Minimal: 1 000 so'm · Maksimal: 100 000 000 so'm",
        'topup.secure_payment': "To'lov xavfsiz amalga oshiriladi",

        'balance.current': 'Joriy balans:',
        'balance.quick_topup': "Tez to'ldirish:",
        'balance.custom_amount': "Yoki o'zingiz kiriting:",
        'balance.limit_hint': "Minimal: 1 000 so'm | Maksimal: 100 000 000 so'm",
        'balance.payment_method': "To'lov usuli:",
        'balance.pay': "To'lash",
        'balance.info': "Ma'lumot:",
        'balance.info_auto': "To'lov avtomatik ravishda qayd qilinadi",
        'balance.info_instant': 'Balans darhol yangilanadi',
        'balance.info_secure': 'Xavfsiz to\'lov tizimlari orqali',
        'balance.info_support': 'Muammo bo\'lsa: @cofeature',

        'phone.title': 'Virtual nomer olish',
        'phone.info': 'Telegram uchun virtual raqam. Mamlakatni tanlang va username kiriting.',
        'phone.country': 'Mamlakat',
    },
    ru: {
        'rating.title': 'Статистика продаж',
        'rating.subtitle': 'Рейтинг лучших продавцов',
        'rating.tab.today': 'Сегодня',
        'rating.tab.week': 'На этой неделе',
        'rating.tab.month': 'В этом месяце',
        'rating.tab.all': 'За всё время',
        'rating.loading': 'Загрузка...',
        'rating.empty': 'Нет данных',
        'rating.error': 'Ошибка загрузки',
        'nav.menu': 'Меню',
        'nav.gifts': 'Gift',
        'nav.rating': 'Рейтинг',
        'nav.profile': 'Профиль',
        'common.loading': 'Загрузка...',
        'common.sending': 'Отправка...',
        'common.buy': 'Купить',
        'common.unknown_order': 'Неизвестный тип заказа.',
        'success.title': '✅ Успешно',
        'success.stars': '⭐ Stars успешно куплены!',
        'success.premium': '💎 Premium подписка успешно активирована!',
        'success.gift': '🎁 Подарок успешно отправлен!',
        'success.phone': '📱 Виртуальный номер успешно получен!',
        'success.order_done': 'Заказ выполнен!',
        'error.title': '❌ Ошибка',
        'error.retry': 'Попробуйте снова',
        'error.network_title': '❌ Сетевая ошибка',
        'error.network': 'Не удалось подключиться к серверу. Попробуйте снова.',
        'validate.min_stars': 'Минимальное количество: {min} stars',
        'validate.max_stars': 'Максимальное количество: {max} stars',
        'loader.text': 'Загрузка...',
        'loader.sub': 'Загрузка...',

        'common.recipient': 'Получатель',
        'common.enter_username': 'Введите username',

        'profile.section.main': 'ОСНОВНОЕ',
        'profile.gifts': 'Мои подарки',
        'profile.referrals': 'Мои приглашения',
        'profile.section.transactions': 'ТРАНЗАКЦИИ',
        'profile.section.settings': 'НАСТРОЙКИ',
        'profile.support': 'Поддержка',
        'profile.news_channel': 'Новостной канал',
        'profile.news': 'Новости и Объявления',
        'profile.news_sub': 'Официальный telegram-канал: @CoinStatUz',
        'profile.konkurs': 'Раздел конкурсов',
        'profile.konkurs_badge': 'АКТИВЕН',
        'profile.konkurs_sub': 'Участие в акциях и конкурсах',
        'stats.title': 'Статистика продаж',
        'stats.view': 'Посмотреть',
        'stats.today': 'Сегодня',
        'stats.week': 'На этой неделе',
        'stats.month': 'В этом месяце',
        'stats.all': 'За всё время',
        'stats.successful_orders': 'Успешные заказы',
        'stats.total_spent': 'Всего потрачено',
        'profile.referral_title': 'РЕФЕРРАЛЬНАЯ СИСТЕМА',
        'profile.referral_desc': 'Приглашайте друзей и получайте бонусы с их покупок!',
        'profile.referral_stars': 'Telegram Stars',
        'profile.invite_friends': 'Пригласить друзей',
        'profile.language': 'Язык',
        'profile.lang_uz': "O'zbekcha",
        'profile.lang_ru': 'Русский',

        'stars.tab': 'Купить Stars',
        'stars.title': 'Купить Telegram Stars',
        'stars.available_prefix': 'В наличии:',
        'stars.amount': 'Количество Stars',
        'stars.hint': 'Минимум: {min} · Максимум: {max} stars',

        'premium.tab': 'Купить Premium',
        'premium.title': 'Купить Premium',
        'premium.duration': 'Длительность',
        'premium.select_duration': 'Выберите длительность',

        'gift.title': 'Получить подарок',
        'gift.subtitle': 'Отправьте подарок себе или другу',
        'gift.tab.regular': 'Подарки',
        'gift.tab.nft': 'NFT Подарки',
        'gift.coming_soon': 'Скоро',
        'gift.not_selected': 'Подарок не выбран',
        'gift.regular_title': 'Обычные подарки',
        'gift.nft_title': 'NFT коллекция',
        'gift.for_myself': 'Себе',
        'gift.anonymous': 'Анонимно',
        'gift.add_comment': 'Добавить комментарий',
        'gift.comment_placeholder': 'Комментарий...',
        'gift.price': 'Цена подарка',
        'gift.total': 'Итого:',
        'gift.buy': 'Купить подарок',

        'topup.title': 'Пополнить счёт',
        'topup.enter_amount': 'Введите сумму',
        'topup.pay': 'Оплатить',
        'topup.limit_hint': 'Минимум: 1 000 сум · Максимум: 100 000 000 сум',
        'topup.secure_payment': 'Платёж выполняется безопасно',

        'balance.current': 'Текущий баланс:',
        'balance.quick_topup': 'Быстрое пополнение:',
        'balance.custom_amount': 'Или введите свою сумму:',
        'balance.limit_hint': 'Минимум: 1 000 сум | Максимум: 100 000 000 сум',
        'balance.payment_method': 'Способ оплаты:',
        'balance.pay': 'Оплатить',
        'balance.info': 'Информация:',
        'balance.info_auto': 'Платёж автоматически регистрируется',
        'balance.info_instant': 'Баланс обновляется мгновенно',
        'balance.info_secure': 'Через безопасные платёжные системы',
        'balance.info_support': 'Проблемы: @cofeature',

        'phone.title': 'Получить виртуальный номер',
        'phone.info': 'Виртуальный номер для Telegram. Выберите страну и введите username.',
        'phone.country': 'Страна',
    },
};

let currentLang = 'uz';

function detectLanguage() {
    const saved = localStorage.getItem('starpay_lang');
    if (saved && TRANSLATIONS[saved]) return saved;
    const tgLang = tg.initDataUnsafe?.user?.language_code || '';
    if (tgLang.startsWith('ru')) return 'ru';
    return 'uz';
}

function t(key) {
    return TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS['uz']?.[key] || key;
}

function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) return;
    currentLang = lang;
    localStorage.setItem('starpay_lang', lang);
    document.documentElement.lang = lang;
    applyTranslations();
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        let text = t(key);
        const args = el.getAttribute('data-i18n-args');
        if (args) {
            try {
                const parsed = JSON.parse(args);
                for (const [k, v] of Object.entries(parsed)) {
                    text = text.replace('{' + k + '}', String(v));
                }
            } catch (e) {}
        }
        el.textContent = text;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });
    document.querySelectorAll('[data-i18n-lang]').forEach(el => {
        const key = el.getAttribute('data-i18n-lang');
        el.textContent = t(key + currentLang);
    });
}

function toggleLanguage() {
    const langs = Object.keys(TRANSLATIONS);
    const idx = langs.indexOf(currentLang);
    const next = langs[(idx + 1) % langs.length];
    setLanguage(next);
}

currentLang = detectLanguage();
document.documentElement.lang = currentLang;

function openTransactionsModal() {
    const modal = document.getElementById('transactionsModalOverlay');
    if (modal) {
        modal.classList.add('open');
        if (typeof fetchModalTransactions === 'function') {
            fetchModalTransactions();
        }
    }
}

function openOrders() {
    openTransactionsModal();
}

