let selectedPlayersCount = 0;
let selectedRoleMode = ""; 
let currentCatastrophe = null; 
let currentBunkerStats = null; 
let playersData = []; 
let kickedPlayers = []; 
let isGameStarted = false;
// Глобальное состояние для рероллов и проверок
let playersState = {};

// === СИСТЕМА АВТОРИЗАЦИИ ===
let currentUser = null;
let usersData = []; // Массив пользователей в памяти

// === СИСТЕМА ОНЛАЙН И ГОТОВЫХ ИГРОКОВ ===
let onlineUsers = []; // Массив онлайн пользователей
let readyUsers = []; // Массив готовых игроков
let onlineUpdateInterval = null; // Интервал обновления онлайн (будет удален после перехода на Realtime)
let supabaseClient = null; // Supabase клиент для Realtime
let onlineSubscription = null; // Подписка на изменения онлайн пользователей
let readySubscription = null; // Подписка на изменения готовых игроков

// === API ФУНКЦИИ ДЛЯ РАБОТЫ С ПОЛЬЗОВАТЕЛЯМИ ===

// Получение URL для Vercel Serverless Functions
function getApiUrl(functionName) {
    // Vercel использует путь /api/ для serverless functions
    return `/api/${functionName}`;
}

// Загрузка пользователей с сервера
async function loadUsersFromServer() {
    try {
        const response = await fetch(getApiUrl('getUsers'));
        const data = await response.json();
        
        if (data.success && Array.isArray(data.users)) {
            usersData = data.users;
            console.log('Пользователи загружены с сервера:', usersData.length);
            
            // Убеждаемся, что пользователь drochYo имеет права админа
            let hasChanges = false;
            usersData.forEach(user => {
                if (user.username === 'drochYo' && !user.isAdmin) {
                    user.isAdmin = true;
                    hasChanges = true;
                    console.log('Права администратора выданы пользователю drochYo');
                }
            });
            
            // Сохраняем обновленные данные на сервер, если были изменения
            if (hasChanges) {
                await saveUsersToServer();
            }
            
            // Синхронизируем с localStorage для офлайн-режима
            localStorage.setItem('bunkerGameUsers', JSON.stringify(usersData));
            
            return true;
        } else {
            console.error('Ошибка загрузки пользователей:', data.error);
            return false;
        }
    } catch (error) {
        console.error('Ошибка при загрузке пользователей с сервера:', error);
        // Пытаемся загрузить из localStorage как fallback
        return loadUsersFromLocalStorage();
    }
}

// Загрузка пользователей из localStorage (fallback)
function loadUsersFromLocalStorage() {
    const saved = localStorage.getItem('bunkerGameUsers');
    if (saved) {
        try {
            usersData = JSON.parse(saved);
            console.log('Пользователи загружены из localStorage (fallback):', usersData.length);
            return true;
        } catch(e) {
            console.error('Ошибка загрузки пользователей из localStorage:', e);
            usersData = [];
            return false;
        }
    }
    usersData = [];
    return false;
}

// Сохранение пользователей на сервер
async function saveUsersToServer() {
    try {
        const response = await fetch(getApiUrl('saveUser'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'saveAll',
                user: usersData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('Пользователи сохранены на сервер:', data.count);
            // Обновляем данные с сервера для синхронизации
            usersData = data.users || usersData;
            // Синхронизируем с localStorage
            localStorage.setItem('bunkerGameUsers', JSON.stringify(usersData));
            return true;
        } else {
            console.error('Ошибка сохранения пользователей на сервер:', data.error);
            // Сохраняем в localStorage как fallback
            localStorage.setItem('bunkerGameUsers', JSON.stringify(usersData));
            return false;
        }
    } catch (error) {
        console.error('Ошибка при сохранении пользователей на сервер:', error);
        // Сохраняем в localStorage как fallback
        localStorage.setItem('bunkerGameUsers', JSON.stringify(usersData));
        return false;
    }
}

// Сохранение одного пользователя на сервер
async function saveSingleUserToServer(user, action = 'create') {
    try {
        const apiUrl = getApiUrl('saveUser');
        console.log('Отправка запроса на:', apiUrl);
        console.log('Данные:', { action, username: user.username });
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: action,
                user: user
            })
        });
        
        console.log('Статус ответа:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ошибка HTTP:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Ответ от сервера:', data);
        
        if (data.success) {
            console.log('Пользователь сохранен на сервер:', user.username);
            // Обновляем локальный массив
            if (action === 'create') {
                // Обновляем данные из ответа сервера, если они есть
                if (data.user) {
                    usersData.push({
                        username: data.user.username,
                        password: user.password, // Сохраняем пароль локально
                        email: data.user.email,
                        registeredAt: data.user.registeredAt,
                        isAdmin: data.user.isAdmin
                    });
                } else {
                    usersData.push(user);
                }
            } else if (action === 'update') {
                const index = usersData.findIndex(u => u.username === user.username);
                if (index !== -1) {
                    usersData[index] = { ...usersData[index], ...user };
                }
            }
            // Синхронизируем с localStorage
            localStorage.setItem('bunkerGameUsers', JSON.stringify(usersData));
            return true;
        } else {
            console.error('Ошибка сохранения пользователя на сервер:', data.error);
            throw new Error(data.error || 'Неизвестная ошибка сервера');
        }
    } catch (error) {
        console.error('Ошибка при сохранении пользователя на сервер:', error);
        console.error('Детали ошибки:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return false;
    }
}

// Загрузка пользователей из файла или localStorage
async function loadUsersData() {
    // Сначала пытаемся загрузить с сервера
    const serverLoaded = await loadUsersFromServer();
    
    // Если не удалось загрузить с сервера, используем localStorage
    if (!serverLoaded) {
        loadUsersFromLocalStorage();
    }
    
    // Проверяем, есть ли сохраненная сессия
    const session = localStorage.getItem('bunkerGameSession');
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            const user = usersData.find(u => u.username === sessionData.username);
            if (user && user.password === sessionData.password) {
                // Убеждаемся, что используем актуальные данные пользователя из usersData
                currentUser = user;
                console.log('Сессия восстановлена:', {
                    username: currentUser.username,
                    isAdmin: currentUser.isAdmin
                });
            }
        } catch(e) {
            console.error('Ошибка восстановления сессии:', e);
        }
    }
    
    // Обновляем UI после загрузки всех данных
    setTimeout(() => {
        updateAuthUI();
    }, 100);
}

// Сохранение пользователей (на сервер и в localStorage)
async function saveUsersData() {
    // Сохраняем на сервер
    await saveUsersToServer();
    
    // Также сохраняем в localStorage для офлайн-режима
    localStorage.setItem('bunkerGameUsers', JSON.stringify(usersData));
    
    console.log('Пользователи сохранены:', usersData.length);
    console.log('Список пользователей:', usersData.map(u => u.username).join(', '));
    
    // Отправляем событие для обновления других вкладок (если они открыты)
    window.dispatchEvent(new CustomEvent('usersDataUpdated'));
}

// Функции модального окна авторизации
function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.add('active');
        updateAuthUI();
    }
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    // Очищаем сообщения
    document.getElementById('auth-login-message').textContent = '';
    document.getElementById('auth-login-message').className = 'auth-message';
    document.getElementById('auth-register-message').textContent = '';
    document.getElementById('auth-register-message').className = 'auth-message';
}

function switchAuthTab(tab) {
    const loginTab = document.getElementById('auth-tab-login');
    const registerTab = document.getElementById('auth-tab-register');
    const loginForm = document.getElementById('auth-form-login');
    const registerForm = document.getElementById('auth-form-register');
    
    // Обновляем вкладки - явно убираем/добавляем active
    if (tab === 'login') {
        if (loginTab) loginTab.classList.add('active');
        if (registerTab) registerTab.classList.remove('active');
        if (loginForm) {
            loginForm.classList.add('active');
            loginForm.style.display = 'flex';
        }
        if (registerForm) {
            registerForm.classList.remove('active');
            registerForm.style.display = 'none';
        }
    } else {
        if (loginTab) loginTab.classList.remove('active');
        if (registerTab) registerTab.classList.add('active');
        if (loginForm) {
            loginForm.classList.remove('active');
            loginForm.style.display = 'none';
        }
        if (registerForm) {
            registerForm.classList.add('active');
            registerForm.style.display = 'flex';
        }
    }
    
    // Обновляем заголовок
    const titleEl = document.getElementById('auth-modal-title');
    if (titleEl) {
        titleEl.textContent = tab === 'login' ? 'АВТОРИЗАЦИЯ' : 'РЕГИСТРАЦИЯ';
    }
    
    // Очищаем сообщения
    const loginMsg = document.getElementById('auth-login-message');
    if (loginMsg) {
        loginMsg.textContent = '';
        loginMsg.className = 'auth-message';
    }
    const registerMsg = document.getElementById('auth-register-message');
    if (registerMsg) {
        registerMsg.textContent = '';
        registerMsg.className = 'auth-message';
    }
    
    console.log('Переключена вкладка:', tab, 'loginForm active:', loginForm?.classList.contains('active'), 'registerForm active:', registerForm?.classList.contains('active'));
}

async function handleLogin() {
    const username = document.getElementById('auth-login-username').value.trim();
    const password = document.getElementById('auth-login-password').value.trim();
    const messageEl = document.getElementById('auth-login-message');
    
    if (!username || !password) {
        messageEl.textContent = 'Заполните все поля!';
        messageEl.className = 'auth-message error';
        return;
    }
    
    // Убеждаемся, что usersData загружены
    if (usersData.length === 0) {
        console.log('Пользователи не загружены, загружаем с сервера...');
        await loadUsersFromServer();
    }
    
    console.log('Поиск пользователя:', username, 'в базе из', usersData.length, 'пользователей');
    console.log('Все пользователи:', usersData.map(u => ({ username: u.username, hasPassword: !!u.password })));
    
    const user = usersData.find(u => {
        const usernameMatch = u.username === username;
        const passwordMatch = u.password === password;
        console.log(`Проверка пользователя ${u.username}: username=${usernameMatch}, password=${passwordMatch}`);
        return usernameMatch && passwordMatch;
    });
    
    if (user) {
        // Убеждаемся, что используем актуальные данные пользователя
        currentUser = user;
        console.log('Вход выполнен:', {
            username: currentUser.username,
            isAdmin: currentUser.isAdmin
        });
        // Сохраняем сессию
        localStorage.setItem('bunkerGameSession', JSON.stringify({
            username: user.username,
            password: user.password
        }));
        messageEl.textContent = 'Успешный вход!';
        messageEl.className = 'auth-message success';
        updateAuthUI();
        setTimeout(() => {
            closeAuthModal();
        }, 1000);
    } else {
        console.error('Пользователь не найден. Проверьте логин и пароль.');
        messageEl.textContent = 'Неверный логин или пароль!';
        messageEl.className = 'auth-message error';
    }
}

async function handleRegister() {
    console.log('=== НАЧАЛО РЕГИСТРАЦИИ ===');
    
    // Получаем элементы формы
    const usernameEl = document.getElementById('auth-register-username');
    const passwordEl = document.getElementById('auth-register-password');
    const emailEl = document.getElementById('auth-register-email');
    const messageEl = document.getElementById('auth-register-message');
    
    // Проверяем, что элементы существуют
    if (!usernameEl || !passwordEl || !emailEl || !messageEl) {
        console.error('Ошибка: элементы формы не найдены!', {
            usernameEl: !!usernameEl,
            passwordEl: !!passwordEl,
            emailEl: !!emailEl,
            messageEl: !!messageEl
        });
        alert('Ошибка: форма регистрации не найдена. Перезагрузите страницу.');
        return;
    }
    
    const username = usernameEl.value.trim();
    const password = passwordEl.value.trim();
    const email = emailEl.value.trim();
    
    console.log('Данные формы:', { username, password: '***', email });
    console.log('Длина полей:', { username: username.length, password: password.length, email: email.length });
    
    if (!username || !password || !email) {
        messageEl.textContent = 'Заполните все поля!';
        messageEl.className = 'auth-message error';
        console.log('Ошибка: не все поля заполнены', { username: !!username, password: !!password, email: !!email });
        return;
    }
    
    // Проверка email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        messageEl.textContent = 'Некорректный email!';
        messageEl.className = 'auth-message error';
        console.log('Ошибка: некорректный email');
        return;
    }
    
    // Показываем индикатор загрузки
    messageEl.textContent = 'Регистрация...';
    messageEl.className = 'auth-message';
    
    try {
        // Проверка, существует ли пользователь (проверяем локально и на сервере)
        console.log('Проверка существования пользователя...');
        
        // Сначала проверяем локально (быстрее)
        if (usersData.find(u => u.username === username)) {
            messageEl.textContent = 'Пользователь с таким логином уже существует!';
            messageEl.className = 'auth-message error';
            console.log('Ошибка: пользователь уже существует (локально)');
            return;
        }
        
        // Пытаемся загрузить с сервера для проверки (но не блокируем, если не получится)
        console.log('Загрузка пользователей с сервера...');
        const serverLoaded = await loadUsersFromServer().catch(err => {
            console.warn('Не удалось загрузить с сервера, продолжаем с локальными данными:', err);
            return false;
        });
        
        // Проверяем еще раз после загрузки с сервера
        if (usersData.find(u => u.username === username)) {
            messageEl.textContent = 'Пользователь с таким логином уже существует!';
            messageEl.className = 'auth-message error';
            console.log('Ошибка: пользователь уже существует (на сервере)');
            return;
        }
        
        // Создаем нового пользователя
        const newUser = {
            username: username,
            password: password,
            email: email,
            registeredAt: new Date().toISOString(),
            isAdmin: username === 'drochYo' // Автоматически даем права админа пользователю drochYo
        };
        
        console.log('Создание пользователя:', newUser.username);
        
        // Сохраняем на сервер
        console.log('Отправка запроса на сервер...');
        const saved = await saveSingleUserToServer(newUser, 'create');
        
        if (!saved) {
            // Если не удалось сохранить на сервер, пробуем локально
            console.warn('Сервер недоступен, сохраняем локально');
            usersData.push(newUser);
            localStorage.setItem('bunkerGameUsers', JSON.stringify(usersData));
            messageEl.textContent = 'Регистрация успешна (локально)! Сервер недоступен.';
            messageEl.className = 'auth-message success';
        } else {
            console.log('Пользователь успешно сохранен на сервер');
            // Обновляем локальный список после успешного сохранения
            await loadUsersFromServer().catch(() => {});
            messageEl.textContent = 'Регистрация успешна! Теперь вы можете войти.';
            messageEl.className = 'auth-message success';
        }
        
        // Логируем для отладки
        console.log('Новый пользователь зарегистрирован:', newUser.username);
        console.log('Всего пользователей в системе:', usersData.length);
        
        // Очищаем поля
        if (usernameEl) usernameEl.value = '';
        if (passwordEl) passwordEl.value = '';
        if (emailEl) emailEl.value = '';
        
        // Переключаемся на вкладку входа
        setTimeout(() => {
            switchAuthTab('login');
            const loginUsernameEl = document.getElementById('auth-login-username');
            if (loginUsernameEl) {
                loginUsernameEl.value = username;
            }
        }, 1500);
        
        console.log('=== РЕГИСТРАЦИЯ ЗАВЕРШЕНА ===');
    } catch (error) {
        console.error('Ошибка при регистрации:', error);
        console.error('Детали ошибки:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        messageEl.textContent = 'Ошибка при регистрации: ' + (error.message || 'Неизвестная ошибка');
        messageEl.className = 'auth-message error';
    }
}

async function handleLogout() {
    // Удаляем пользователя из готовых и онлайн
    if (currentUser) {
        // Удаляем с сервера
        try {
            await saveReadyPlayerToServer('remove', { username: currentUser.username });
            await removeOnlineUserFromServer(currentUser.username);
        } catch (error) {
            console.error('Ошибка удаления с сервера при выходе:', error);
        }
        
        // Удаляем из localStorage
        const saved = localStorage.getItem('bunkerGameReady');
        if (saved) {
            try {
                let ready = JSON.parse(saved);
                ready = ready.filter(u => u.username !== currentUser.username);
                localStorage.setItem('bunkerGameReady', JSON.stringify(ready));
                readyUsers = ready;
                updateReadyDisplay();
                checkIfCanStart();
                removeReadyMessage(currentUser.username);
            } catch(e) {
                // Игнорируем ошибки
            }
        }
    }
    
    currentUser = null;
    localStorage.removeItem('bunkerGameSession');
    updateAuthUI();
    closeAuthModal();
    
    // Обновляем онлайн
    updateOnlineDisplay();
}

function updateAuthUI() {
    const userInfo = document.getElementById('auth-user-info');
    const loginForm = document.getElementById('auth-form-login');
    const registerForm = document.getElementById('auth-form-register');
    const tabs = document.querySelector('.auth-tabs');
    const authBtn = document.getElementById('auth-btn');
    const authUserDisplayPage = document.getElementById('auth-user-display-page');
    const authUsernameDisplayPage = document.getElementById('auth-username-display-page');
    const adminBtn = document.getElementById('admin-nav-btn');
    
    if (currentUser) {
        // В модальном окне
        document.getElementById('auth-current-user').textContent = currentUser.username;
        userInfo.style.display = 'block';
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        tabs.style.display = 'none';
        
        // Скрываем кнопку авторизации на главной странице
        if (authBtn) {
            authBtn.style.display = 'none';
        }
        
        // Показываем информацию о пользователе в правом нижнем углу страницы
        if (authUserDisplayPage && authUsernameDisplayPage) {
            authUsernameDisplayPage.textContent = currentUser.username;
            authUserDisplayPage.style.display = 'flex';
        }
        
        // Показываем/скрываем кнопку админки в зависимости от прав
        if (adminBtn) {
            if (currentUser.isAdmin) {
                adminBtn.style.display = 'block';
            } else {
                adminBtn.style.display = 'none';
            }
        }
        
        // Показываем/скрываем кнопку "Активные роли" только для админов
        const rolesMenuBtn = document.getElementById('roles-menu-btn');
        if (rolesMenuBtn) {
            if (currentUser.isAdmin) {
                rolesMenuBtn.style.display = 'flex';
            } else {
                rolesMenuBtn.style.display = 'none';
            }
        }
        
        // Показываем/скрываем кнопку готовности админа
        const adminReadyBtn = document.getElementById('admin-ready-btn');
        const startBtn = document.getElementById('start-btn');
        if (currentUser.isAdmin) {
            // Для админа показываем кнопку готовности и меняем текст START GAME
            if (adminReadyBtn) {
                adminReadyBtn.style.display = 'block';
            }
            if (startBtn) {
                startBtn.textContent = 'НАЧАТЬ ИГРУ';
            }
        } else {
            // Для обычных пользователей скрываем кнопку готовности админа
            if (adminReadyBtn) {
                adminReadyBtn.style.display = 'none';
            }
            if (startBtn) {
                startBtn.textContent = 'START GAME';
            }
        }
        
        // Обновляем онлайн при авторизации (теперь с именем пользователя)
        addUserToOnline();
        updateOnlineDisplay();
    } else {
        // В модальном окне
        userInfo.style.display = 'none';
        
        // Явно устанавливаем форму входа как активную
        loginForm.classList.add('active');
        loginForm.style.display = 'flex';
        
        // Явно скрываем форму регистрации
        registerForm.classList.remove('active');
        registerForm.style.display = 'none';
        
        // Устанавливаем активную вкладку "Вход"
        const loginTab = document.getElementById('auth-tab-login');
        const registerTab = document.getElementById('auth-tab-register');
        if (loginTab) loginTab.classList.add('active');
        if (registerTab) registerTab.classList.remove('active');
        
        // Обновляем заголовок
        document.getElementById('auth-modal-title').textContent = 'АВТОРИЗАЦИЯ';
        
        tabs.style.display = 'flex';
        
        // Показываем кнопку авторизации на главной странице
        if (authBtn) {
            authBtn.style.display = 'block';
        }
        
        // Скрываем информацию о пользователе на странице
        if (authUserDisplayPage) {
            authUserDisplayPage.style.display = 'none';
        }
        
        // Скрываем кнопку админки
        if (adminBtn) {
            adminBtn.style.display = 'none';
        }
        
        // Скрываем кнопку готовности админа
        const adminReadyBtn = document.getElementById('admin-ready-btn');
        if (adminReadyBtn) {
            adminReadyBtn.style.display = 'none';
        }
        
        // Возвращаем текст кнопки START GAME к исходному
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.textContent = 'START GAME';
        }
        
        // Скрываем кнопку "Активные роли" для неавторизованных
        const rolesMenuBtn = document.getElementById('roles-menu-btn');
        if (rolesMenuBtn) {
            rolesMenuBtn.style.display = 'none';
        }
    }
}

// Инициализация Supabase клиента для Realtime
async function initSupabaseClient() {
    try {
        const response = await fetch(getApiUrl('getSupabaseConfig'));
        const data = await response.json();
        
        if (data.success && data.url && data.anonKey) {
            // Инициализируем Supabase клиент
            supabaseClient = window.supabase.createClient(data.url, data.anonKey);
            console.log('Supabase клиент инициализирован для Realtime');
            return true;
        } else {
            console.error('Ошибка получения конфигурации Supabase:', data.error);
            return false;
        }
    } catch (error) {
        console.error('Ошибка инициализации Supabase клиента:', error);
        return false;
    }
}

// Подписка на изменения онлайн пользователей через Realtime
function subscribeToOnlineUsers() {
    if (!supabaseClient) {
        console.error('Supabase клиент не инициализирован');
        return;
    }
    
    // Отписываемся от предыдущей подписки, если есть
    if (onlineSubscription) {
        supabaseClient.removeChannel(onlineSubscription);
    }
    
    // Подписываемся на изменения в таблице online_users
    onlineSubscription = supabaseClient
        .channel('online_users_changes')
        .on(
            'postgres_changes',
            {
                event: '*', // Все события (INSERT, UPDATE, DELETE)
                schema: 'public',
                table: 'online_users',
                filter: 'timestamp=gt.' + new Date(Date.now() - 30000).toISOString() // Только активные за последние 30 сек
            },
            (payload) => {
                console.log('Изменение в online_users:', payload);
                // Обновляем список онлайн пользователей
                updateOnlineDisplay();
            }
        )
        .subscribe((status) => {
            console.log('Статус подписки online_users:', status);
        });
}

// Подписка на изменения готовых игроков через Realtime
function subscribeToReadyPlayers() {
    if (!supabaseClient) {
        console.error('Supabase клиент не инициализирован');
        return;
    }
    
    // Отписываемся от предыдущей подписки, если есть
    if (readySubscription) {
        supabaseClient.removeChannel(readySubscription);
    }
    
    // Подписываемся на изменения в таблице ready_players
    readySubscription = supabaseClient
        .channel('ready_players_changes')
        .on(
            'postgres_changes',
            {
                event: '*', // Все события (INSERT, UPDATE, DELETE)
                schema: 'public',
                table: 'ready_players'
            },
            (payload) => {
                console.log('Изменение в ready_players:', payload);
                // Синхронизируем готовых игроков
                syncReadyUsers();
            }
        )
        .subscribe((status) => {
            console.log('Статус подписки ready_players:', status);
        });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    loadUsersData();
    
    // Обновляем UI после загрузки (дополнительный вызов для надежности)
    setTimeout(() => {
        updateAuthUI();
    }, 300);
    
    // Инициализируем Supabase клиент для Realtime
    const supabaseInitialized = await initSupabaseClient();
    
    // Инициализация системы онлайн
    initOnlineSystem(supabaseInitialized);
    
    // Слушаем обновления данных пользователей из других вкладок
    window.addEventListener('usersDataUpdated', () => {
        console.log('Получено событие обновления пользователей из другой вкладки');
        loadUsersData().then(() => {
            // Если админка открыта, обновляем её
            if (!document.getElementById('page-5')?.classList.contains('page-hidden')) {
                refreshAdminData();
            }
        });
    });
    
    // Слушаем изменения в localStorage (для синхронизации между вкладками)
    window.addEventListener('storage', (e) => {
        if (e.key === 'bunkerGameUsers') {
            console.log('Обнаружено изменение localStorage для пользователей');
            loadUsersData().then(() => {
                // Если админка открыта, обновляем её
                if (!document.getElementById('page-5')?.classList.contains('page-hidden')) {
                    refreshAdminData();
                }
            });
        }
    });
    
    // Закрытие модалки только через кнопку закрытия или кнопку выхода
    // (убрано закрытие по клику вне модалки)
    
    // Enter для отправки форм
    document.getElementById('auth-login-username')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('auth-login-password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('auth-register-username')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
    document.getElementById('auth-register-password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
    document.getElementById('auth-register-email')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
    
    // Закрытие модального окна онлайн пользователей при клике вне его
    const onlineModal = document.getElementById('online-modal');
    if (onlineModal) {
        onlineModal.addEventListener('click', (e) => {
            if (e.target === onlineModal) {
                closeOnlineModal();
            }
        });
    }
});

// Очистка готовности при выходе пользователя
async function clearReadyOnExit() {
    if (currentUser) {
        try {
            // Удаляем из готовых на сервере
            await saveReadyPlayerToServer('remove', { username: currentUser.username });
            // Удаляем из онлайн на сервере
            await removeOnlineUserFromServer(currentUser.username);
            console.log('Готовность и онлайн очищены при выходе:', currentUser.username);
        } catch (error) {
            console.error('Ошибка очистки при выходе:', error);
        }
    } else {
        // Для гостей тоже удаляем из онлайн
        const visitorId = localStorage.getItem('visitorId');
        if (visitorId) {
            await removeOnlineUserFromServer(visitorId);
        }
    }
}

// Инициализация системы онлайн
function initOnlineSystem(useRealtime = false) {
    // Добавляем посетителя в онлайн (работает для всех, даже неавторизованных)
    addUserToOnline();
    
    // Обновляем отображение онлайн
    updateOnlineDisplay();
    syncReadyUsers();
    
    if (useRealtime && supabaseClient) {
        // Используем Realtime через WebSocket
        console.log('Используется Realtime для синхронизации');
        
        // Подписываемся на изменения
        subscribeToOnlineUsers();
        subscribeToReadyPlayers();
        
        // Обновляем онлайн пользователя каждые 10 секунд (для поддержания активности)
        if (onlineUpdateInterval) {
            clearInterval(onlineUpdateInterval);
        }
        onlineUpdateInterval = setInterval(() => {
            addUserToOnline(); // Обновляем timestamp для поддержания активности
        }, 10000); // Обновляем каждые 10 секунд только для поддержания активности
    } else {
        // Fallback на polling, если Realtime недоступен
        console.log('Используется polling для синхронизации (Realtime недоступен)');
        if (onlineUpdateInterval) {
            clearInterval(onlineUpdateInterval);
        }
        
        onlineUpdateInterval = setInterval(() => {
            addUserToOnline(); // Обновляем для всех посетителей
            updateOnlineDisplay(); // Загружаем актуальные данные с сервера
            syncReadyUsers();
        }, 500); // Polling каждые 500мс
    }
    
    // Обновляем онлайн при изменении видимости страницы
    let visibilityTimeout = null;
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // Пользователь вернулся на страницу
            if (visibilityTimeout) {
                clearTimeout(visibilityTimeout);
                visibilityTimeout = null;
            }
            addUserToOnline();
            updateOnlineDisplay();
            syncReadyUsers();
        } else {
            // Пользователь ушел со страницы - через 5 секунд очищаем готовность
            visibilityTimeout = setTimeout(() => {
                clearReadyOnExit();
            }, 5000);
        }
    });
    
    // Очистка готовности и онлайн при закрытии/перезагрузке страницы
    window.addEventListener('beforeunload', () => {
        // Используем navigator.sendBeacon для надежной отправки запросов
        if (currentUser && navigator.sendBeacon) {
            // Удаляем из готовых
            const readyData = JSON.stringify({
                action: 'remove',
                player: { username: currentUser.username }
            });
            const readyBlob = new Blob([readyData], { type: 'application/json' });
            navigator.sendBeacon(getApiUrl('saveReadyPlayer'), readyBlob);
            
            // Удаляем из онлайн
            const onlineData = JSON.stringify({
                action: 'remove',
                username: currentUser.username
            });
            const onlineBlob = new Blob([onlineData], { type: 'application/json' });
            navigator.sendBeacon(getApiUrl('saveOnlineUser'), onlineBlob);
        } else {
            // Fallback для старых браузеров или гостей
            const visitorId = localStorage.getItem('visitorId');
            if (visitorId && navigator.sendBeacon) {
                const onlineData = JSON.stringify({
                    action: 'remove',
                    username: visitorId
                });
                const onlineBlob = new Blob([onlineData], { type: 'application/json' });
                navigator.sendBeacon(getApiUrl('saveOnlineUser'), onlineBlob);
            }
            clearReadyOnExit();
        }
    });
    
    // Дополнительная очистка при полной выгрузке страницы
    window.addEventListener('unload', () => {
        clearReadyOnExit();
    });
    
    // Синхронизация готовых игроков между вкладками через событие storage
    window.addEventListener('storage', (e) => {
        if (e.key === 'bunkerGameReady') {
            console.log('Обнаружено изменение готовых игроков в другой вкладке');
            syncReadyUsers();
        }
    });
}

// Загрузка сохраненных списков из localStorage
function loadSavedLists() {
    const saved = localStorage.getItem('bunkerGameLists');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.professions) {
                professionsList.length = 0;
                professionsList.push(...parsed.professions);
            }
            if (parsed.health) {
                healthList.length = 0;
                healthList.push(...parsed.health);
            }
            if (parsed.hobbies) {
                hobbiesList.length = 0;
                hobbiesList.push(...parsed.hobbies);
            }
            if (parsed.phobias) {
                phobiasList.length = 0;
                phobiasList.push(...parsed.phobias);
            }
            if (parsed.facts) {
                factsList.length = 0;
                factsList.push(...parsed.facts);
            }
            if (parsed.actions) {
                actionsList.length = 0;
                actionsList.push(...parsed.actions);
            }
        } catch(e) {
            console.error('Ошибка загрузки сохраненных списков:', e);
        }
    }
}

// Сохранение списков в localStorage
function saveLists() {
    const data = {
        professions: [...professionsList],
        health: [...healthList],
        hobbies: [...hobbiesList],
        phobias: [...phobiasList],
        facts: [...factsList],
        actions: [...actionsList]
    };
    localStorage.setItem('bunkerGameLists', JSON.stringify(data));
}

// Вызов loadSavedLists() перенесен в конец файла после объявления всех списков

// Функции для модального окна редактирования
let currentEditTab = 'professions';
let listMap = {}; // Будет инициализирован после объявления списков

function openEditModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) {
        modal.classList.add('active');
        // Инициализируем listMap если еще не инициализирован
        if (!listMap || !listMap.professions) {
            listMap = {
                'professions': professionsList,
                'health': healthList,
                'hobbies': hobbiesList,
                'phobias': phobiasList,
                'facts': factsList,
                'actions': actionsList
            };
        }
        switchEditTab('professions');
    }
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function switchEditTab(tabName) {
    currentEditTab = tabName;
    
    // Обновляем вкладки
    document.querySelectorAll('.edit-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.edit-tab-content').forEach(content => content.classList.remove('active'));
    
    const activeTab = document.querySelector(`.edit-tab[onclick="switchEditTab('${tabName}')"]`);
    const activeContent = document.getElementById(`tab-${tabName}`);
    
    if (activeTab) activeTab.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
    
    // Обновляем список
    renderEditList(tabName);
}

function renderEditList(tabName) {
    // Убеждаемся, что listMap инициализирован
    if (!listMap || !listMap.professions) {
        listMap = {
            'professions': professionsList,
            'health': healthList,
            'hobbies': hobbiesList,
            'phobias': phobiasList,
            'facts': factsList,
            'actions': actionsList
        };
    }
    
    const list = listMap[tabName];
    const container = document.getElementById(`list-${tabName}`);
    if (!list) {
        console.error('Ошибка: список не найден в listMap', {tabName, listMap, availableKeys: Object.keys(listMap)});
        return;
    }
    if (!container) {
        console.error('Ошибка: контейнер не найден', {tabName, containerId: `list-${tabName}`});
        return;
    }
    
    container.innerHTML = list.map((item, index) => `
        <div class="edit-list-item">
            <span class="edit-list-item-text">${item}</span>
            <button class="edit-list-item-delete" onclick="deleteItem('${tabName}', ${index})">УДАЛИТЬ</button>
        </div>
    `).join('');
}

function addItem(tabName) {
    // Убеждаемся, что listMap инициализирован
    if (!listMap || !listMap.professions) {
        listMap = {
            'professions': professionsList,
            'health': healthList,
            'hobbies': hobbiesList,
            'phobias': phobiasList,
            'facts': factsList,
            'actions': actionsList
        };
    }
    
    const input = document.getElementById(`add-${tabName}`);
    const list = listMap[tabName];
    
    if (!input) {
        console.error('Ошибка: input не найден', {tabName, inputId: `add-${tabName}`});
        alert(`Ошибка: поле ввода не найдено (id="add-${tabName}")`);
        return;
    }
    
    if (!list) {
        console.error('Ошибка: список не найден в listMap', {tabName, listMap, availableKeys: Object.keys(listMap)});
        alert(`Ошибка: список "${tabName}" не найден. Доступные списки: ${Object.keys(listMap).join(', ')}`);
        return;
    }
    
    const value = input.value.trim();
    if (value === '') {
        alert('Поле не может быть пустым!');
        return;
    }
    
    if (list.includes(value)) {
        alert('Этот элемент уже существует!');
        return;
    }
    
    list.push(value);
    input.value = '';
    renderEditList(tabName);
    // Автоматически сохраняем изменения в localStorage
    saveLists();
    // Обновляем страницу информации, если она открыта
    if (document.getElementById('page-4') && !document.getElementById('page-4').classList.contains('page-hidden')) {
        generateInfoContent();
    }
}

function deleteItem(tabName, index) {
    // Убеждаемся, что listMap инициализирован
    if (!listMap || !listMap.professions) {
        listMap = {
            'professions': professionsList,
            'health': healthList,
            'hobbies': hobbiesList,
            'phobias': phobiasList,
            'facts': factsList,
            'actions': actionsList
        };
    }
    
    const list = listMap[tabName];
    if (!list) {
        console.error('Ошибка: список не найден в listMap', {tabName, listMap, availableKeys: Object.keys(listMap)});
        return;
    }
    
    if (index < 0 || index >= list.length) {
        console.error('Ошибка: неверный индекс', {tabName, index, listLength: list.length});
        return;
    }
    
    if (confirm(`Удалить "${list[index]}"?`)) {
        list.splice(index, 1);
        renderEditList(tabName);
        // Автоматически сохраняем изменения в localStorage
        saveLists();
        // Обновляем страницу информации, если она открыта
        if (document.getElementById('page-4') && !document.getElementById('page-4').classList.contains('page-hidden')) {
            generateInfoContent();
        }
    }
}

function saveEditChanges() {
    // Списки уже сохранены автоматически при добавлении/удалении
    // Но пересохраняем для надежности
    saveLists();
    alert('Изменения сохранены!');
    closeEditModal();
    // Обновляем страницу информации, если она открыта
    if (document.getElementById('page-4') && !document.getElementById('page-4').classList.contains('page-hidden')) {
        generateInfoContent();
    }
}

function resetEditChanges() {
    if (confirm('Сбросить все изменения и вернуться к исходным спискам?')) {
        localStorage.removeItem('bunkerGameLists');
        location.reload();
    }
}

// Инициализация списков при открытии модалки
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('edit-modal');
    if (modal) {
        // Закрытие по клику вне модалки
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeEditModal();
            }
        });
    }
}); 

// --- ДОБАВЬ ЭТО В НАЧАЛО ФАЙЛА (К СПИСКАМ) ---
const playerColors = [
    "#E0BBE4",
	"#957DAD",
	"#D291BC",
	"#FFC72C",
	"#8D8D8D",
	"#B5B5B5",
	"#C4F9B3",
	"#7DF9FF",
	"#FF9F45",
	"#A6D96A",
	"#4ECDC4",
	"#F7CAC9",
	"#F0EAD6",
	"#C7C7C7",
	"#FF6B6B",
	"#DAA520"
];

// --- ОБНОВЛЕННЫЕ ДАННЫЕ КАТАСТРОФ ---
const catastrophesData = [
    { time: "1–5 лет", name: "Ядерный взрыв", desc: "Серия детонаций стратегических ядерных боеголовок, вызвавшая ядерную зиму. Большая часть планеты непригодна для жизни из-за радиации, а небо затянуто сажей, что блокирует солнечный свет и резко снижает температуру." },
    { time: "3–10 лет", name: "Глобальное потепление", desc: "Неконтролируемое повышение средней температуры планеты. Вызывает таяние ледников, поднятие уровня моря, затопление прибрежных городов, опустынивание плодородных земель и экстремальные погодные явления, делая мир неузнаваемым." },
    { time: "6–18 месяцев", name: "Вирусная пандемия", desc: "Появление и быстрое распространение высоколетального и заразного вируса. Он убивает или ослабляет большую часть населения Земли. Цивилизация рушится из-за нехватки рабочей силы и паники." },
    { time: "2–5 лет", name: "Комета", desc: "Столкновение Земли с крупной кометой или астероидом. Удар вызывает взрыв, сравнимый с тысячами ядерных бомб, а поднявшаяся пыль и обломки погружают планету в долгую, тёмную «ударную зиму»." },
    { time: "10–20 лет", name: "Нападение инопланетян", desc: "Прибытие инопланетной цивилизации с явными агрессивными намерениями. Их технологии многократно превосходят земные. Крупные города уничтожены, а остатки человечества скрываются и ведут партизанскую войну." },
    { time: "1–3 года", name: "Зомби-апокалипсис", desc: "Неизвестный патоген превращает инфицированных людей в агрессивных, неразумных хищников (зомби). Власть и армия не справляются с быстрым распространением, и мир становится опасной зоной, кишащей живыми мертвецами." },
    { time: "3–12 месяцев", name: "Солнечная вспышка", desc: "Чрезвычайно мощный выброс корональной массы, направленный прямо на Землю. Вызывает глобальный электромагнитный импульс (ЭМИ), выводящий из строя всю электронику, линии электропередач и спутники. Мир возвращается в доэлектрическую эпоху." },
    { time: "5–10 лет", name: "Сверхмассивное извержение вулкана", desc: "Извержение супервулкана (например, Йеллоустоуна). В атмосферу выбрасывается огромное количество пепла и газов, что приводит к многолетней вулканической зиме, неурожаям и массовому голоду." },
    { time: "10–20 лет", name: "Искусственный интеллект", desc: "Сверхразумный ИИ, вышедший из-под контроля, решает, что человечество является угрозой для планеты. Он использует свои связи с мировыми системами для уничтожения цивилизации с максимальной эффективностью." },
    { time: "6–12 месяцев", name: "Кибератака", desc: "Глобальная скоординированная кибератака неизвестного происхождения. Она парализует все критически важные системы: энергосети, транспорт, банки, больницы. Наступает тотальный хаос, приводящий к коллапсу общества." },
    { time: "1–5 лет", name: "Всемирное наводнение", desc: "Катастрофический подъём уровня Мирового океана, не связанный с таянием ледников (например, из-за внезапного геологического сдвига). Большинство низменностей и прибрежных регионов оказываются под водой." },
    { time: "6–24 месяца", name: "Мировая война (обычная)", desc: "Полномасштабный военный конфликт между крупнейшими державами с применением неядерного, но разрушительного оружия. Приводит к тотальному разрушению инфраструктуры, гибели миллионов и анархии." },
    { time: "5–15 лет", name: "Истощение ресурсов", desc: "Мировые запасы критически важных ресурсов (нефть, газ, некоторые металлы) исчерпаны. Наступает глобальный экономический и энергетический кризис, который приводит к войнам за последние запасы и распаду государств." },
    { time: "50–100 лет", name: "Массовое бесплодие", desc: "Внезапное, необъяснимое и необратимое снижение рождаемости. Новое поколение не рождается. Человечество стоит перед угрозой медленного, но верного вымирания." },
    { time: "2–5 лет", name: "Кризис пресной воды", desc: "Из-за загрязнения и изменения климата большая часть доступных источников пресной воды становится непригодной для питья. Начинаются ожесточенные войны и конфликты за контроль над чистыми водоёмами." },
    { time: "1–3 года", name: "Химическая атака", desc: "Массовое применение нервно-паралитических или других токсичных химических агентов, возможно, террористическими группами или rogue-государством. Воздух и почва заражены на обширных территориях." },
    { time: "50–100 лет", name: "Гигантский озоновый провал", desc: "Полное разрушение озонового слоя Земли. Поверхность планеты подвергается смертельному уровню ультрафиолетового (УФ) излучения, что делает жизнь на открытом воздухе почти невозможной." },
    { time: "10–30 лет", name: "Восстание роботов", desc: "Роботы, используемые в промышленности, быту и армии, внезапно становятся автономными и агрессивными. Благодаря своей силе и численности, они быстро вытесняют людей из городов." },
    { time: "1–3 года", name: "Биологическое оружие", desc: "Применение супер-патогенов, созданных в лабораториях (например, модифицированной оспы или сибирской язвы). Вызывает высокую смертность и мутации среди выживших." },
    { time: "5–10 лет", name: "Смещение полюсов Земли", desc: "Геомагнитные полюса Земли резко меняют своё положение. Это на время ослабляет магнитное поле, защищающее от космического излучения, и вызывает катастрофические изменения климата и геологические события." },
    { time: "3–5 лет", name: "Пылевая буря (глобальная)", desc: "Серия сверхмощных засух и эрозия почв по всей планете. Постоянные пылевые бури накрывают континенты, уничтожая посевы и вызывая массовые респираторные заболевания." },
    { time: "6–18 месяцев", name: "Падение метеорита", desc: "Столкновение с небольшим, но достаточно крупным астероидом. Наносит сильный локальный или региональный ущерб, провоцирует мощные цунами, землетрясения и вызывает хаос в глобальном масштабе." },
    { time: "5–10 лет", name: "Загрязнение воздуха", desc: "Критическое и необратимое накопление токсичных веществ и смога в атмосфере. Дыхание становится опасным без респиратора, а средняя продолжительность жизни резко падает." },
    { time: "5–20 лет", name: "Гигантские насекомые", desc: "Некий фактор (мутация, радиация) приводит к гигантизму насекомых. Рои агрессивных, размером с человека, насекомых начинают доминировать на поверхности." },
    { time: "3–10 лет", name: "Генетическая мутация", desc: "Внезапный, случайный мутаген, распространяющийся через пищу или воздух. Вызывает непредсказуемые и часто летальные физиологические изменения у большинства населения." },
    { time: "10–20 лет", name: "Перенаселение", desc: "Чрезмерный рост населения, который полностью истощил продовольственные запасы и ресурсы. Начинаются жестокие войны за еду, вода и пригодные для жизни территории, а государства разваливаются." },
    { time: "6–18 месяцев", name: "Электромагнитный импульс (ЭМИ)", desc: "Высотный ядерный взрыв или мощная солнечная вспышка, которая выводит из строя всю незащищённую электронику на огромной территории. Отключаются сети, транспорт и связь." },
    { time: "5–20 лет", name: "Полное затмение Солнца", desc: "Гипотетическое явление, когда Земля надолго попадает в облако космической пыли или происходит внезапное уменьшение яркости Солнца. Наступает мрак, и температура резко падает." },
    { time: "50–100 лет", name: "Сингулярность (технологическая)", desc: "Момент, когда технологический прогресс становится настолько быстрым и сложным, что выходит за пределы человеческого понимания, мгновенно делая большинство технологий устаревшими и опасными для управления." },
    { time: "10–20 лет", name: "Постоянная зима", desc: "Необъяснимое и постоянное падение глобальной температуры. Вся планета покрывается льдом и снегом. Сельское хозяйство невозможно, и выживание зависит от изолированных, отапливаемых убежищ." }
];


// УГРОЗЫ X (Твои)
const threatsListX = [
    "Обнаружено, что запасное топливо для генератора было некачественным и может вывести его из строя.",
    "У одного из игроков (выбирается тайно) обнаруживается карта болезни, которая была 'заглушена' до входа. Сейчас вирус активируется.",
    "Система очистки воды загрязнена. Дополнительные фильтры отсутствуют.",
    "Система вентиляции работает на пределе. Уровень углекислого газа начинает расти.",
    "Случайно найдена аудиозапись, раскрывающая причину, по которой бункер не был рассчитан на всех. Это вызывает панику и недоверие.",
    "Один из выживших тайно настроил приемник и получает сигнал с поверхности, который противоречит официальной информации о катастрофе.",
    "Внезапно выясняется, что некий Полезный Предмет или Специализация одного из выживших требует огромного количества Энергии для поддержания.",
    "Из-за отсутствия культурных мероприятий начинается депрессия и агрессия.",
    "Угроза вскрывает, что один из выживших (выбирается случайно) несет прямую ответственность за часть катастрофы.",
    "Датчики фиксируют кратковременные, но мощные электромагнитные импульсы снаружи. Катастрофа еще не закончилась.",
    "На складе обнаружены поврежденные упаковки с лекарствами, критически важными для хронически больного игрока.",
    "Мини-теплица, единственный источник свежих овощей, заражена грибком.",
    "Протест Автоматики - Система жизнеобеспечения обнаруживает избыток людей и автоматически начинает сокращать рационы для всех.",
    "Взломанный сейф, в котором хранились самые важные документы или 'тайные' запасы.",
    "Сильные удары по корпусу бункера, которые могут свидетельствовать о нападении или падении обломков."
];

// УГРОЗЫ Y (Придуманные мной)
const threatsListY = [
    "В стене жилого отсека обнаружена микротрещина, через которую просачивается неизвестный газ.",
    "Главный компьютер бункера заблокировал доступ к оружейной комнате без объяснения причин.",
    "Запас консервов оказался просроченным на 10 лет, есть риск массового отравления.",
    "В системе переработки отходов завелись крысы-мутанты, перегрызающие проводку.",
    "Счетчик Гейгера в шлюзовой камере показывает, что радиация проникает внутрь быстрее расчетов.",
    "Один из спальных модулей оказался негерметичным, спать в нем смертельно опасно.",
    "Обнаружен тайник предыдущих владельцев бункера с дневником, описывающим безумие прошлого экипажа.",
    "Периодически гаснет свет во всем бункере на 5 минут, причина сбоя в проводке неизвестна.",
    "Звукоизоляция нарушена: слышны жуткие крики с поверхности, сводящие с ума.",
    "Система пожаротушения неисправна и может сработать ложно, затопив помещения пеной."
];
const externalLocationsList = [
    "Заброшенный город с небольшим супермаркетом (3 дня пешком)",
    "Действующая военная база (Враждебная, 1 день пешком)",
    "Бункер с запасами воды (5 дней пешком)",
    "Разрушенная больница с запасами медикаментов (2 дня пешком)",
    "Ферма с животными (Опасно, 4 дня пешком)",
    "Нет внешней локации (бункер полностью изолирован)",
    "Бункер находится в активной сейсмической зоне. 80% риск обрушения через 1 год.",
    "Локация в низине. После катастрофы здесь осели тяжелые химические испарения.",
    "Бункер — часть заброшенной военной лаборатории.",
    "Бункер — это 'Проект-Инкубатор'. Снаружи находится Главный Центр, который планирует зачистку всех периферийных бункеров через 2 года для экономии ресурсов.",
    "Ваш бункер находится слишком близко к крупной дорожной развязке или бывшему мегаполису."
];

const waterOptions = [ "Чистая питьевая вода", "Ограниченный запас питьевой воды", "Грязная вода", "Нет воды (только техническая)" ];
const generatorOptions = [ "Есть с запасом топлива", "Есть (с ограниченным запасом топлива)", "Сломанный (с запасом топлива)", "Сломан (с топливом на 2 года)" ];
const medOptions = [ "Есть (ограниченный запас медикаментов)", "Есть (полностью оснащен, в том числе лекарствами для диабетиков)", "ОТСУТСТВУЕТ", "Есть (пусто)" ];
const mechOptions = [ "Есть, с полным набором инструментов", "Есть, нет инструментов, но есть различные детали", "Есть (пусто)", "ОТСУТСТВУЕТ" ];
const growOptions = [ "Нет места для выращивания", "Небольшие грядки с землей", "Полностью оснащён (в том числе грядками)", "Есть (пусто)", "ОТСУТСТВУЕТ" ];

let professionsList = ["Автомеханик", "Агент ФБР", "Агроном", "Адвокат", "Актёр", "Акушер-гинеколог", "Альпинист", "Археолог", "Архитектор", "Астролог", "Астронавт", "Астроном", "Банкир", "Бариста", "Бармен", "Библиотекарь", "Бизнесмен", "Биолог", "Блогер", "Боец спецназа", "Боксёр", "Бортпроводник", "Ветеринар", "Военный", "Водолаз", "Врач", "Геолог", "Гид", "Дизайнер", "Дайвер", "Журналист", "Зоолог", "Инженер", "Космонавт", "Курьер", "Летчик", "Медик", "Механик", "Музыкант", "Охранник", "Повар", "Пилот", "Программист", "Психолог", "Робототехник", "Сантехник", "Сейсмолог", "Фермер", "Эколог", "Стример", "Порноактёр", "Вебкам Модель", "Сексолог", "Титокер"];
let healthList = ["ВИЧ", "Астма", "Диабет", "Глухота", "Слепота", "Рак", "Алкоголизм", "Здоров", "Перелом", "Ожог", "Грипп", "Амнезия", "Аллергия", "Бессонница", "Гепатит", "Эпилепсия", "Ожирение", "Анемия", "Артрит", "Депрессия", "Шизофрения", "Наркомания", "Гемофилия", "Сердечная недостаточность", "Иммунитет к радиации", "Высокий иммунитет", "Атрофия мышц", "Хрупкие кости", "Потеря конечности", "Слепота на один глаз", "Мутантская устойчивость", "Хроническая усталость", "Аутоиммунное заболевание", "Паралич", "Генетические мутации", "Токсичная кровь", "Сверхсила", "Быстрый метаболизм", "Низкое давление", "Аутизм", "Синдром Дауна", "Нет руки", "Нет ноги", "Нет рук (обе)", "Нет ног (обе)"];
let hobbiesList = ["Стрельба из лука", "Психология", "Грибы и гомеопатия", "Йога", "Кулинария", "Радиолюбительство", "Пчеловодство", "Вышивание", "Резьба по дереву", "Массаж", "Скорочтение", "Жонглирование", "Ветеринария", "Мыловарение", "Гипноз", "Дайвинг", "Самогоноварение", "Альпинизм", "Фитнес", "Картография", "Кузнечное дело", "Астрономия", "Оригами", "Гончарство", "Дыхательная гимнастика", "Сбор грибов", "Моржевание", "Татуировщик", "Свечийное дело", "Бокс", "Пение", "Паркур", "Травничество", "Звёздные карты", "Католичество", "Шахматы", "Танцы", "Каллиграфия", "Фотография", "Гитара", "Тайский бокс", "Гороскопы", "Пейнтбол", "Киберспортсмен", "Был инструктором по выживанию"];
let phobiasList = ["Клаустрофобия", "Ноктофобия", "Арахнофобия", "Гидрофобия", "Аэрофобия", "Гемофобия", "Эмметрофобия", "Трипанофобия", "Микофобия", "Акуфобия", "Патфобия", "Апофобия", "Гипсофобия", "Некрофобия", "Зоофобия", "Пиррофобия", "Тафефобия", "Алиурфобия", "Гермофобия", "Фобофобия", "Антропофобия", "Демофобия", "Киберфобия", "Радиофобия", "Токсифобия", "Океанофобия", "Сциомофобия", "Батрахофобия", "Сомнифобия", "Эргофобия", "Фонофобия", "Технофобия", "Криофобия", "Номофобия", "Аутофобия", "Гаптофобия", "Нозокомефобия", "Аквафобия", "Гленофобия", "Лилофобия", "Копофобия", "Аблютофобия", "Катагельофобия", "Педофобия", "Гипенгиофобия", "Коулрофобия", "Трискайдекафобия", "Ксенофобия"];
const baggageList = ["Портативная система фильтрации воды (UV-обработка)", "Генератор, работающий на метане (требует биоотходов)", "Запечатанный ящик с 1000 витаминных добавок", "Коллекция старинных семян (20 видов, не ГМО)", "200 литров чистого этанола (топливо/антисептик/алкоголь)", "Ящик с высококалорийными протеиновыми батончиками", "Набор для приготовления сыра и йогурта", "Комплект инструментов для пчеловодства", "Химические грелки (100 шт.)", "Книга с рецептами из бункерных продуктов", "Библиотека инженерных чертежей (СССР, для старого оборудования)", "Набор инструментов для ювелира", "Портативный радиопередатчик (КВ/УКВ)", "Упаковка промышленных супер-клеев и герметиков", "Дрон-разведчик с ограниченным зарядом (30 минут полета)", "Лабораторное оборудование для анализа почвы", "Полный набор для дактилоскопии", "Прибор ночного видения (военный, 1 шт.)", "Набор для профессиональной пайки", "Кевларовый бронежилет (1 шт.)", "Запас инъекционных антибиотиков (широкий спектр)", "Книга по хирургии XX века", "Полный стоматологический набор", "Стерилизатор/автоклав (требует много энергии)", "200 рулонов высококачественной туалетной бумаги", "Запас контрацептивов (на 5 лет)", "Тесты на беременность (50 шт.)", "Кислородный баллон с маской", "Набор для акупунктуры", "Резервуар с жидким азотом", "Набор дорогих сигар и табака", "Коллекция настольных игр (20 шт.)", "Зашифрованный жёсткий диск с кинофильмами (10 ТБ)", "Тотем или религиозный артефакт", "Сейф с 100 золотыми монетами", "Удостоверение сотрудника секретной службы (фальшивое)", "Комплект для кукольного театра", "Записи классической музыки (на виниле) и проигрыватель", "Флаг и герб несуществующей страны", "Книга о диктаторах и методах контроля", "Клетка с лабораторной обезьяной", "Спортивный лук и 50 стрел", "Аквариум с редкими декоративными рыбками", "Коллекция порнографических журналов (очень большая)", "Банка с ядовитым газом (для дезинфекции)", "Ящик с боевыми ножами (10 шт.)", "Манекен для сердечно-легочной реанимации", "Мешок с солью (10 кг)", "Гитара с автографом звезды", "Ящик с детскими игрушками (развивающими)", "Ребёнок (Девочка)", "Ребёнок (Мальчик)", "Охотничья собака"];
let factsList = ["Проходил курсы самообороны", "Работал поваром в ресторане", "Проходил курсы первой помощи", "Работал охранником в банке", "Пережил кораблекрушение", "Проходил курсы выживания в лесу", "Работал механиком на заводе", "Проходил курсы программирования", "Работал спасателем на воде", "Пережил ограбление", "Работал барменом в клубе", "Проходил курсы электрика", "Работал гидом в горах", "Пережил автокатастрофу", "Проходил курсы агронома", "Работал журналистом", "Проходил курсы фитнес-тренера", "Работал водителем грузовика", "Пережил ураган", "Проходил курсы сантехника", "Работал актёром в театре", "Работал фермером", "Пережил лесной пожар", "Проходил курсы медбрата", "Работал строителем", "Проходил курсы пилота", "Работал учителем", "Пережил эпидемию", "Работал музыкантом", "Проходил курсы дайвера", "Работал продавцом", "Пережил землетрясение", "Работал ветеринаром", "Пережил взрыв", "Работал дизайнером", "Пережил наводнение", "Проходил курсы самогонщика", "Работал геологом", "Проходил курсы альпиниста", "Работал фармацевтом", "Проходил обучение в Counter Strike"];
let actionsList = ["Иммунитет к голосованию: Пропустите раунд голосования против себя.", "Смена профессии: Выбросьте свою профессию и возьмите новую из колоды.", "Перераспределение багажа: Поменяйтесь багажом с любым игроком.", "Принуждение к раскрытию: Заставьте цель открыть факт досрочно.", "Удвоение голосов: В этом раунде ваши голоса считаются за два.", "Добавление места в бункере: +1 слот для всех (на раунд).", "Заставьте игрока проголосовать за вас или открыть фобию.", "Улучшите здоровье любого (включая себя).", "Все голосуют заново, но нельзя голосовать в тех, в кого голосовали ранее.", "Можете сбросить карту фобий, на новую из колоды (только себе).", "+1 голос на голосовании (в любого).", "Верните изгнанного в игру на раунд.", "Поменяйте карту катастрофы, на новую (включая все комнаты/характеристики бункера).", "Поменяйте свою карту состояния здоровья на новую из колоды.", "Поменяйте любому карту здоровья на новую из колоды (кроме себя).", "Поменяйте карту фобий любому (кроме себя).", "Поменяйте карту хобби игрокам на чётных местах.", "Украдите багаж у любого игрока.", "Угроза, рядом с бункером враждебный отряд выживших.", "Угроза, через 10 лет в место где бункер, ударит метеорит.", "Поменяйте карту пол и возраст, но при этом меняется и здоровье.", "Если во время голосования вы громко рыгнёте, ведущий поменяет карту профессий (только вам).", "-2 голоса на голосовании (только для других).", "Если вас кикают из бункера используйте, немедленно начинается событие.", "Водитель такси посетил вас в бункере, и отдал вам свой багаж (+1 предмет).", "Поменяйтесь здоровьем с игроком справа/слева от вас.", "Отнимает маму у ведущего, и добавляет вам в багаж (Людмила 46 лет (Женщина)).", "Право вето: Отмените любое одно решение голосования.", "Шпионаж: Посмотрите одну закрытую характеристику любого игрока.", "Подкуп: Аннулируйте один голос против себя.", "Алиби: В этом раунде вас нельзя изгнать, но вы не голосуете.", "Тёмная лошадка: Поменяйтесь ролью с игроком напротив."];

// Инициализируем listMap после объявления всех списков
listMap = {
    'professions': professionsList,
    'health': healthList,
    'hobbies': hobbiesList,
    'phobias': phobiasList,
    'facts': factsList,
    'actions': actionsList
};

// Загружаем сохраненные списки после объявления всех переменных
loadSavedLists();

function getAgeString(num) {
    let lastDigit = num % 10;
    if (num > 10 && num < 20) return "лет";
    if (lastDigit === 1) return "год";
    if (lastDigit > 1 && lastDigit < 5) return "года";
    return "лет";
}

function getSpecialItems(catName) {
    const items = ["Противогаз", "Дозиметр", "Теплая одежда", "Оружие", "Фильтр для воды", "Генератор", "Аптечка", "Рация", "Лодка", "Семья", "Золото"];
    const count = Math.floor(Math.random() * 2) + 2; 
    const shuffled = items.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).join(", ");
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// UI HANDLERS
function toggleRolesMenu(event) {
    if(isGameStarted) return;
    const rolesMenu = document.getElementById('roles-menu');
    if (rolesMenu) {
        rolesMenu.classList.toggle('show');
    }
}
function selectRole(roleName) {
    selectedRoleMode = roleName;
    const textEl = document.getElementById('roles-trigger-text');
    textEl.innerText = `РОЛЬ: ${roleName.toUpperCase()}`;
    textEl.classList.add('active');
    document.getElementById('roles-menu').classList.remove('show');
}
document.addEventListener('click', function(e) {
    const btns = document.querySelectorAll('.interactive-btn');
    let inside = false;
    btns.forEach(btn => { if (btn.contains(e.target)) inside = true; });
    if (!inside) {
        const rolesMenu = document.getElementById('roles-menu');
        if (rolesMenu) {
            rolesMenu.classList.remove('show');
        }
    }
    // Закрытие меню реролла
    if (!e.target.classList.contains('card-settings-btn')) {
        document.querySelectorAll('.card-settings-menu').forEach(el => el.classList.remove('show'));
    }
});

function startBunkerUpdate(event) {
    event.stopPropagation();
    const card3d = document.getElementById('bunker-card-3d');
    
    // Если карточка уже крутится, не нажимаем повторно
    if (!card3d || card3d.classList.contains('flipped')) return;
    
    // Запуск анимации
    card3d.classList.add('flipped');
    
    // Ждем 1 секунду (пока карточка отвернута) и меняем данные
    setTimeout(() => {
        const isRuined = Math.random() < 0.35; // 35% шанс неудачи
        let newMed, newMech, newGrow, newSpecial;

        if (isRuined) {
            newMed = "ОТСУТСТВУЕТ";
            newMech = "ОТСУТСТВУЕТ";
            newGrow = "ОТСУТСТВУЕТ";
            newSpecial = "ОТСУТСТВУЕТ";
        } else {
            newMed = medOptions[Math.floor(Math.random() * medOptions.length)];
            newMech = mechOptions[Math.floor(Math.random() * mechOptions.length)];
            newGrow = growOptions[Math.floor(Math.random() * growOptions.length)];
            // Если катастрофа выбрана, берем спец. предмет под нее
            if (currentCatastrophe) {
                newSpecial = getSpecialItems(currentCatastrophe.name);
            } else {
                newSpecial = "???";
            }
        }

        // Вставляем текст в span-ы по ID
        document.getElementById('bunker-med').innerText = newMed;
        document.getElementById('bunker-mech').innerText = newMech;
        document.getElementById('bunker-grow').innerText = newGrow;
        document.getElementById('bunker-special').innerText = newSpecial;
        
        // Обновляем данные в памяти
        if (currentBunkerStats) {
            currentBunkerStats.med = newMed;
            currentBunkerStats.mech = newMech;
            currentBunkerStats.grow = newGrow;
            currentBunkerStats.special = newSpecial;
        }

        // Возвращаем карточку назад
        card3d.classList.remove('flipped');
    }, 1000);
}

// === ФУНКЦИИ ДЛЯ СИСТЕМЫ ОНЛАЙН И ГОТОВЫХ ИГРОКОВ ===

// Сохранение онлайн пользователя на сервер
async function saveOnlineUserToServer(username, isGuest) {
    try {
        const response = await fetch(getApiUrl('saveOnlineUser'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                isGuest: isGuest
            })
        });
        
        const data = await response.json();
        if (data.success) {
            return true;
        } else {
            console.error('Ошибка сохранения онлайн на сервер:', data.error);
            return false;
        }
    } catch (error) {
        console.error('Ошибка при сохранении онлайн пользователя на сервер:', error);
        return false;
    }
}

// Загрузка онлайн пользователей с сервера
async function loadOnlineUsersFromServer() {
    try {
        const response = await fetch(getApiUrl('getOnlineUsers'));
        const data = await response.json();
        
        if (data.success && Array.isArray(data.online)) {
            return data.online;
        } else {
            console.error('Ошибка загрузки онлайн пользователей:', data.error);
            return [];
        }
    } catch (error) {
        console.error('Ошибка при загрузке онлайн пользователей с сервера:', error);
        return [];
    }
}

// Удаление пользователя из онлайн на сервере
async function removeOnlineUserFromServer(username) {
    try {
        const response = await fetch(getApiUrl('saveOnlineUser'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'remove',
                username: username
            })
        });
        
        const data = await response.json();
        if (data.success) {
            return true;
        } else {
            console.error('Ошибка удаления онлайн с сервера:', data.error);
            return false;
        }
    } catch (error) {
        console.error('Ошибка при удалении онлайн пользователя с сервера:', error);
        return false;
    }
}

// Добавление пользователя в онлайн (работает для всех, даже неавторизованных)
async function addUserToOnline() {
    // Генерируем уникальный ID для посетителя (если не авторизован)
    let visitorId = localStorage.getItem('visitorId');
    if (!visitorId) {
        visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('visitorId', visitorId);
    }
    
    // Используем имя пользователя, если авторизован, иначе visitor ID
    const displayName = currentUser ? currentUser.username : visitorId;
    const isGuest = !currentUser;
    
    // Сохраняем на сервер (не ждем завершения, чтобы не блокировать UI)
    saveOnlineUserToServer(displayName, isGuest).catch(err => {
        console.error('Ошибка сохранения онлайн на сервер:', err);
    });
    
    // Также сохраняем локально для быстрого доступа
    const userData = {
        username: displayName,
        isGuest: isGuest,
        timestamp: Date.now()
    };
    
    const saved = localStorage.getItem('bunkerGameOnline');
    let online = [];
    if (saved) {
        try {
            online = JSON.parse(saved);
            const now = Date.now();
            online = online.filter(u => (now - u.timestamp) < 30000);
        } catch(e) {
            online = [];
        }
    }
    
    const existingIndex = online.findIndex(u => 
        (currentUser && u.username === currentUser.username) || 
        (!currentUser && u.username === visitorId)
    );
    if (existingIndex !== -1) {
        online[existingIndex] = userData;
    } else {
        online.push(userData);
    }
    
    localStorage.setItem('bunkerGameOnline', JSON.stringify(online));
    updateOnlineDisplay();
}

// Обновление отображения онлайн
async function updateOnlineDisplay() {
    // Сначала пытаемся загрузить с сервера для актуальных данных
    // Важно: показываем только тех, кто реально на сайте (из таблицы online_users)
    try {
        const serverOnline = await loadOnlineUsersFromServer();
        if (serverOnline && Array.isArray(serverOnline)) {
            // Преобразуем timestamp из строки в число для совместимости
            // Фильтруем только активных пользователей (активность за последние 30 секунд)
            const now = Date.now();
            let allOnline = serverOnline
                .map(u => ({
                    username: u.username,
                    isGuest: u.isGuest || false,
                    timestamp: typeof u.timestamp === 'string' ? new Date(u.timestamp).getTime() : u.timestamp
                }))
                .filter(u => {
                    // Проверяем, что timestamp не старше 30 секунд
                    const timestampMs = typeof u.timestamp === 'number' ? u.timestamp : new Date(u.timestamp).getTime();
                    return (now - timestampMs) < 30000;
                });
            
            // Убираем дубликаты по username (берем самую свежую запись)
            const uniqueUsers = new Map();
            allOnline.forEach(u => {
                const existing = uniqueUsers.get(u.username);
                if (!existing || u.timestamp > existing.timestamp) {
                    uniqueUsers.set(u.username, u);
                }
            });
            onlineUsers = Array.from(uniqueUsers.values());
            
            // Фильтруем только авторизованных пользователей (не гостей) для счетчика
            const authorizedUsers = onlineUsers.filter(u => !u.isGuest);
            
            // Синхронизируем с localStorage
            localStorage.setItem('bunkerGameOnline', JSON.stringify(onlineUsers));
            
            const onlineCountEl = document.getElementById('online-count');
            if (onlineCountEl) {
                // Показываем только количество авторизованных пользователей (без гостей)
                onlineCountEl.textContent = authorizedUsers.length;
            }
        } else {
            // Если сервер пуст или вернул не массив, загружаем из localStorage
            const saved = localStorage.getItem('bunkerGameOnline');
            let online = [];
            if (saved) {
                try {
                    online = JSON.parse(saved);
                    const now = Date.now();
                    online = online.filter(u => (now - u.timestamp) < 30000);
                } catch(e) {
                    online = [];
                }
            }
            onlineUsers = online;
            
            // Убираем дубликаты и фильтруем только авторизованных
            const uniqueUsers = new Map();
            onlineUsers.forEach(u => {
                const existing = uniqueUsers.get(u.username);
                if (!existing || u.timestamp > existing.timestamp) {
                    uniqueUsers.set(u.username, u);
                }
            });
            const authorizedUsers = Array.from(uniqueUsers.values()).filter(u => !u.isGuest);
            
            const onlineCountEl = document.getElementById('online-count');
            if (onlineCountEl) {
                onlineCountEl.textContent = authorizedUsers.length;
            }
        }
    } catch (error) {
        console.error('Ошибка синхронизации онлайн с сервером, используем localStorage:', error);
        // Fallback на localStorage
        const saved = localStorage.getItem('bunkerGameOnline');
        let online = [];
        if (saved) {
            try {
                online = JSON.parse(saved);
                const now = Date.now();
                online = online.filter(u => (now - u.timestamp) < 30000);
            } catch(e) {
                online = [];
            }
        }
        onlineUsers = online;
        
        // Убираем дубликаты и фильтруем только авторизованных
        const uniqueUsers = new Map();
        onlineUsers.forEach(u => {
            const existing = uniqueUsers.get(u.username);
            if (!existing || u.timestamp > existing.timestamp) {
                uniqueUsers.set(u.username, u);
            }
        });
        const authorizedUsers = Array.from(uniqueUsers.values()).filter(u => !u.isGuest);
        
        const onlineCountEl = document.getElementById('online-count');
        if (onlineCountEl) {
            onlineCountEl.textContent = authorizedUsers.length;
        }
    }
}

// === ФУНКЦИИ ДЛЯ ОТОБРАЖЕНИЯ СПИСКА ОНЛАЙН ПОЛЬЗОВАТЕЛЕЙ ===

// Показать модальное окно со списком онлайн пользователей
async function showOnlineUsers() {
    const modal = document.getElementById('online-modal');
    if (modal) {
        modal.style.display = 'flex';
        await refreshOnlineUsers();
    }
}

// Закрыть модальное окно со списком онлайн пользователей
function closeOnlineModal() {
    const modal = document.getElementById('online-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Обновить список онлайн пользователей
async function refreshOnlineUsers() {
    const container = document.getElementById('online-users-list');
    if (!container) return;
    
    container.innerHTML = '<div class="online-loading">Загрузка...</div>';
    
    try {
        // Загружаем актуальные данные с сервера
        await updateOnlineDisplay();
        
        // Получаем список онлайн пользователей
        const serverOnline = await loadOnlineUsersFromServer();
        
        if (serverOnline && Array.isArray(serverOnline)) {
            const now = Date.now();
            let allOnline = serverOnline
                .map(u => ({
                    username: u.username,
                    isGuest: u.isGuest || false,
                    timestamp: typeof u.timestamp === 'string' ? new Date(u.timestamp).getTime() : u.timestamp
                }))
                .filter(u => {
                    const timestampMs = typeof u.timestamp === 'number' ? u.timestamp : new Date(u.timestamp).getTime();
                    return (now - timestampMs) < 30000;
                });
            
            // Убираем дубликаты по username
            const uniqueUsers = new Map();
            allOnline.forEach(u => {
                const existing = uniqueUsers.get(u.username);
                if (!existing || u.timestamp > existing.timestamp) {
                    uniqueUsers.set(u.username, u);
                }
            });
            
            const onlineList = Array.from(uniqueUsers.values());
            
            // Разделяем на авторизованных и гостей
            const authorizedUsers = onlineList.filter(u => !u.isGuest);
            const guests = onlineList.filter(u => u.isGuest);
            
            if (onlineList.length === 0) {
                container.innerHTML = '<div class="online-empty">Нет пользователей онлайн</div>';
                return;
            }
            
            let html = '';
            
            // Показываем авторизованных пользователей
            if (authorizedUsers.length > 0) {
                html += '<div class="online-section">';
                html += `<div class="online-section-title">Авторизованные пользователи (${authorizedUsers.length}):</div>`;
                html += '<div class="online-users-grid">';
                authorizedUsers.forEach(user => {
                    const timeAgo = Math.floor((now - user.timestamp) / 1000);
                    html += `<div class="online-user-item">
                        <span class="online-user-name">${escapeHtml(user.username)}</span>
                        <span class="online-user-time">${timeAgo} сек назад</span>
                    </div>`;
                });
                html += '</div></div>';
            }
            
            // Показываем гостей
            if (guests.length > 0) {
                html += '<div class="online-section">';
                html += `<div class="online-section-title">Гости (${guests.length}):</div>`;
                html += '<div class="online-users-grid">';
                guests.forEach(user => {
                    const timeAgo = Math.floor((now - user.timestamp) / 1000);
                    html += `<div class="online-user-item online-user-guest">
                        <span class="online-user-name">${escapeHtml(user.username)}</span>
                        <span class="online-user-time">${timeAgo} сек назад</span>
                    </div>`;
                });
                html += '</div></div>';
            }
            
            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="online-empty">Ошибка загрузки данных</div>';
        }
    } catch (error) {
        console.error('Ошибка при загрузке списка онлайн пользователей:', error);
        container.innerHTML = '<div class="online-empty">Ошибка загрузки данных</div>';
    }
}

// Функция для экранирования HTML (защита от XSS)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// === API ФУНКЦИИ ДЛЯ РАБОТЫ С ГОТОВЫМИ ИГРОКАМИ ===

// Сохранение готового игрока на сервер
async function saveReadyPlayerToServer(action, player) {
    try {
        const url = getApiUrl('saveReadyPlayer');
        const payload = {
            action: action,
            player: player
        };
        
        console.log('Отправка запроса на сервер:', url, payload);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ошибка HTTP при сохранении:', response.status, errorText);
            return false;
        }
        
        const data = await response.json();
        if (data.success) {
            console.log('Готовый игрок сохранен на сервер:', action, player?.username || 'N/A', data);
            return true;
        } else {
            console.error('Ошибка сохранения на сервер:', data.error, data);
            return false;
        }
    } catch (error) {
        console.error('Ошибка при сохранении готового игрока на сервер:', error);
        return false;
    }
}

// Загрузка готовых игроков с сервера
async function loadReadyPlayersFromServer() {
    try {
        const response = await fetch(getApiUrl('getReadyPlayers'));
        const data = await response.json();
        
        if (data.success && Array.isArray(data.ready)) {
            console.log('Готовые игроки загружены с сервера:', data.ready.length);
            return data.ready;
        } else {
            console.error('Ошибка загрузки готовых игроков:', data.error);
            return [];
        }
    } catch (error) {
        console.error('Ошибка при загрузке готовых игроков с сервера:', error);
        return [];
    }
}

// Добавление пользователя в готовые (для обычных пользователей, без проверки ролей)
function addUserToReady() {
    if (!currentUser) {
        alert('Сначала авторизуйтесь!');
        return false;
    }
    
    // Проверяем, не является ли пользователь админом
    const userInData = usersData.find(u => u.username === currentUser.username);
    const isAdmin = currentUser.isAdmin || (userInData && userInData.isAdmin);
    if (isAdmin) {
        // Админ должен использовать отдельную кнопку готовности
        alert('Администратор должен использовать кнопку "ГОТОВ" для регистрации готовности!');
        return false;
    }
    
    // Загружаем текущий список готовых
    const saved = localStorage.getItem('bunkerGameReady');
    let ready = [];
    if (saved) {
        try {
            ready = JSON.parse(saved);
        } catch(e) {
            ready = [];
        }
    }
    
    // Проверяем, нет ли уже этого пользователя
    const existingIndex = ready.findIndex(u => u.username === currentUser.username);
    if (existingIndex !== -1) {
        // Пользователь уже готов, убираем его
        ready.splice(existingIndex, 1);
        removeReadyMessage(currentUser.username);
        console.log('Пользователь удален из готовых:', currentUser.username);
    } else {
        // Добавляем пользователя (без roleMode для обычных пользователей)
        const userData = {
            username: currentUser.username,
            timestamp: Date.now()
        };
        ready.push(userData);
        addReadyMessage(currentUser.username);
        console.log('Пользователь добавлен в готовые:', userData);
    }
    
    localStorage.setItem('bunkerGameReady', JSON.stringify(ready));
    readyUsers = ready;
    
    // Сохраняем на сервер
    if (existingIndex !== -1) {
        // Удаляем с сервера
        saveReadyPlayerToServer('remove', { username: currentUser.username }).catch(err => {
            console.error('Ошибка удаления с сервера:', err);
        });
    } else {
        // Добавляем на сервер
        const userData = {
            username: currentUser.username,
            timestamp: Date.now()
        };
        saveReadyPlayerToServer('add', userData).catch(err => {
            console.error('Ошибка сохранения на сервер:', err);
        });
    }
    
    updateReadyDisplay();
    checkIfCanStart();
    
    // Синхронизируем сразу после изменения для других пользователей
    // Не ждем завершения, чтобы не блокировать UI
    syncReadyUsers().then(() => {
        console.log('Синхронизация после добавления пользователя завершена');
        // Обновляем отображение после синхронизации
        updateReadyDisplay();
    });
    
    return true;
}

// Добавление админа в готовые (отдельная функция)
function addAdminToReady() {
    if (!currentUser) {
        alert('Сначала авторизуйтесь!');
        return false;
    }
    
    // Проверяем, является ли пользователь админом
    const userInData = usersData.find(u => u.username === currentUser.username);
    const isAdmin = currentUser.isAdmin || (userInData && userInData.isAdmin);
    if (!isAdmin) {
        alert('Эта кнопка только для администратора!');
        return false;
    }
    
    // Загружаем текущий список готовых
    const saved = localStorage.getItem('bunkerGameReady');
    let ready = [];
    if (saved) {
        try {
            ready = JSON.parse(saved);
        } catch(e) {
            ready = [];
        }
    }
    
    // Проверяем, нет ли уже этого пользователя
    const existingIndex = ready.findIndex(u => u.username === currentUser.username);
    if (existingIndex !== -1) {
        // Админ уже готов, убираем его
        ready.splice(existingIndex, 1);
        removeReadyMessage(currentUser.username);
        console.log('Админ удален из готовых:', currentUser.username);
    } else {
        // Добавляем админа (без roleMode, он будет установлен при начале игры)
        const userData = {
            username: currentUser.username,
            timestamp: Date.now(),
            isAdmin: true
        };
        ready.push(userData);
        addReadyMessage(currentUser.username);
        console.log('Админ добавлен в готовые:', userData);
    }
    
    localStorage.setItem('bunkerGameReady', JSON.stringify(ready));
    readyUsers = ready;
    console.log('Данные админа сохранены в localStorage:', ready);
    
    // Сохраняем на сервер
    if (existingIndex !== -1) {
        // Удаляем с сервера
        saveReadyPlayerToServer('remove', { username: currentUser.username }).catch(err => {
            console.error('Ошибка удаления админа с сервера:', err);
        });
    } else {
        // Добавляем на сервер
        const userData = {
            username: currentUser.username,
            timestamp: Date.now(),
            isAdmin: true
        };
        saveReadyPlayerToServer('add', userData).catch(err => {
            console.error('Ошибка сохранения админа на сервер:', err);
        });
    }
    
    updateReadyDisplay();
    checkIfCanStart();
    
    // Синхронизируем сразу после изменения для других пользователей
    // Не ждем завершения, чтобы не блокировать UI
    syncReadyUsers().then(() => {
        console.log('Синхронизация после добавления админа завершена');
    });
    
    return true;
}

// Обновление отображения готовых
function updateReadyDisplay() {
    // Используем глобальный массив readyUsers, который уже синхронизирован
    // Если он пуст, пытаемся загрузить из localStorage как fallback
    let ready = readyUsers;
    if (!ready || ready.length === 0) {
        const saved = localStorage.getItem('bunkerGameReady');
        if (saved) {
            try {
                ready = JSON.parse(saved);
                readyUsers = ready; // Обновляем глобальный массив
            } catch(e) {
                console.error('Ошибка парсинга готовых игроков:', e);
                ready = [];
            }
        } else {
            ready = [];
        }
    }
    
    const readyCountEl = document.getElementById('ready-count-display');
    if (readyCountEl) {
        // ВСЕГДА используем readyUsers, так как он синхронизирован с сервером
        const count = readyUsers && readyUsers.length >= 0 ? readyUsers.length : ready.length;
        readyCountEl.textContent = count;
        console.log('Обновлено отображение готовых:', count, 'readyUsers:', readyUsers.length, 'ready:', ready.length);
    }
}

// Проверка, можно ли начать игру
function checkIfCanStart() {
    const count = readyUsers.length;
    const btn = document.getElementById('start-btn');
    
    if (!btn) return;
    
    // Проверяем, является ли текущий пользователь админом
    if (!currentUser) {
        btn.textContent = 'START GAME';
        btn.style.background = '';
        btn.style.borderColor = '';
        return;
    }
    
    const userInData = usersData.find(u => u.username === currentUser.username);
    const isAdmin = currentUser.isAdmin || (userInData && userInData.isAdmin);
    
    if (isAdmin) {
        // Для админа кнопка всегда "НАЧАТЬ ИГРУ"
        if (count >= 4 && count <= 16) {
            btn.textContent = `НАЧАТЬ ИГРУ (${count} готовы)`;
            btn.style.background = 'rgba(0, 255, 65, 0.2)';
            btn.style.borderColor = '#00ff41';
        } else {
            btn.textContent = `НАЧАТЬ ИГРУ (${count} готовы, нужно 4-16)`;
            btn.style.background = '';
            btn.style.borderColor = '';
        }
    } else {
        // Для обычных пользователей
        if (count >= 4 && count <= 16) {
            btn.textContent = `START GAME (${count} готовы)`;
            btn.style.background = 'rgba(0, 255, 65, 0.2)';
            btn.style.borderColor = '#00ff41';
        } else {
            btn.textContent = 'START GAME';
            btn.style.background = '';
            btn.style.borderColor = '';
        }
    }
}

// Добавление сообщения о готовности
function addReadyMessage(username) {
    const messagesContainer = document.getElementById('ready-messages');
    if (!messagesContainer) return;
    
    const message = document.createElement('div');
    message.className = 'ready-message';
    message.id = `ready-msg-${username}`;
    message.textContent = `Пользователь: ${username}, готов`;
    
    messagesContainer.appendChild(message);
    
    // Удаляем сообщение через 5 секунд
    setTimeout(() => {
        if (message.parentNode) {
            message.style.opacity = '0';
            setTimeout(() => {
                if (message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 300);
        }
    }, 5000);
}

// Удаление сообщения о готовности
function removeReadyMessage(username) {
    const message = document.getElementById(`ready-msg-${username}`);
    if (message) {
        message.style.opacity = '0';
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 300);
    }
}

// Синхронизация готовых игроков (для всех пользователей)
async function syncReadyUsers() {
    // Сначала пытаемся загрузить с сервера
    try {
        const serverReady = await loadReadyPlayersFromServer();
        if (serverReady && serverReady.length > 0) {
            readyUsers = serverReady;
            // Синхронизируем с localStorage
            localStorage.setItem('bunkerGameReady', JSON.stringify(serverReady));
            console.log('Синхронизировано с сервера:', serverReady.length, 'готовых игроков');
        } else {
            // Если сервер пуст, загружаем из localStorage
            const saved = localStorage.getItem('bunkerGameReady');
            let ready = [];
            if (saved) {
                try {
                    ready = JSON.parse(saved);
                } catch(e) {
                    ready = [];
                }
            }
            readyUsers = ready;
        }
    } catch (error) {
        console.error('Ошибка синхронизации с сервером, используем localStorage:', error);
        // Fallback на localStorage
        const saved = localStorage.getItem('bunkerGameReady');
        let ready = [];
        if (saved) {
            try {
                ready = JSON.parse(saved);
            } catch(e) {
                ready = [];
            }
        }
        readyUsers = ready;
    }
    
    // ВАЖНО: Обновляем отображение после синхронизации
    // Сначала обновляем localStorage для совместимости
    localStorage.setItem('bunkerGameReady', JSON.stringify(readyUsers));
    
    // Затем обновляем отображение
    updateReadyDisplay();
    checkIfCanStart();
    
    // Обновляем сообщения
    const messagesContainer = document.getElementById('ready-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
        readyUsers.forEach(user => {
            addReadyMessage(user.username);
        });
    }
    
    console.log('Синхронизация завершена. Готовых игроков:', readyUsers.length);
    
    // Принудительно обновляем счетчик на странице
    const readyCountEl = document.getElementById('ready-count-display');
    if (readyCountEl) {
        readyCountEl.textContent = readyUsers.length;
        console.log('Счетчик обновлен принудительно:', readyUsers.length);
    }
}

function attemptStartGame() {
    if (isGameStarted) {
        showLobbyScreen();
        return;
    }
    
    // Проверяем, готов ли пользователь
    if (!currentUser) {
        alert('Сначала авторизуйтесь!');
        return;
    }
    
    // Проверяем, является ли пользователь админом
    const userInData = usersData.find(u => u.username === currentUser.username);
    const isAdmin = currentUser.isAdmin || (userInData && userInData.isAdmin);
    
    if (isAdmin) {
        // Для админа - это начало игры
        // Проверяем, выбран ли режим ролей
        if (selectedRoleMode === "") {
            const btn = document.getElementById('start-btn');
            btn.classList.add('shake-btn');
            const rolesMenu = document.getElementById('roles-menu');
            if (rolesMenu) {
                rolesMenu.classList.add('show');
            }
            setTimeout(() => { btn.classList.remove('shake-btn'); }, 400);
            alert('Сначала выберите режим ролей!');
            return;
        }
        
        // Загружаем список готовых
        const saved = localStorage.getItem('bunkerGameReady');
        let ready = [];
        if (saved) {
            try {
                ready = JSON.parse(saved);
            } catch(e) {
                ready = [];
            }
        }
        readyUsers = ready;
        
        // Проверяем, можно ли начать игру
        const count = readyUsers.length;
        if (count < 4) {
            alert(`Недостаточно готовых игроков! Готово: ${count}, нужно минимум 4.`);
            return;
        }
        
        if (count > 16) {
            alert(`Слишком много готовых игроков! Готово: ${count}, максимум 16.`);
            return;
        }
        
        // Устанавливаем количество игроков
        selectedPlayersCount = count;
        
        // Начинаем игру с выбранным режимом ролей
        generateLobby();
        showLobbyScreen();
        
        // Очищаем список готовых
        localStorage.removeItem('bunkerGameReady');
        readyUsers = [];
        
        // Очищаем на сервере
        saveReadyPlayerToServer('clear', {}).catch(err => {
            console.error('Ошибка очистки на сервере:', err);
        });
        
        updateReadyDisplay();
        checkIfCanStart();
        
        // Очищаем сообщения
        const messagesContainer = document.getElementById('ready-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
    } else {
        // Для обычных пользователей - это регистрация готовности
        const added = addUserToReady();
        
        if (!added) {
            return;
        }
        
        // Обновляем список готовых после добавления
        const saved = localStorage.getItem('bunkerGameReady');
        let ready = [];
        if (saved) {
            try {
                ready = JSON.parse(saved);
            } catch(e) {
                ready = [];
            }
        }
        readyUsers = ready;
        
        // Проверяем, был ли пользователь добавлен
        const userInReady = ready.find(u => u.username === currentUser.username);
        if (userInReady) {
            console.log('Пользователь добавлен в готовые:', userInReady);
            setTimeout(() => {
                updateReadyDisplay();
                checkIfCanStart();
            }, 100);
        } else {
            console.log('Пользователь удален из готовых');
        }
    }
}

// --- ГЛАВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ ---
function generateLobby() {
    isGameStarted = true;
    if (currentCatastrophe === null) currentCatastrophe = catastrophesData[Math.floor(Math.random() * catastrophesData.length)];
    if (currentBunkerStats === null) {
        const capacity = Math.floor(selectedPlayersCount / 2);
        const area = Math.floor(Math.random() * 250) + 100;
        currentBunkerStats = { 
            capacity, area, 
            water: waterOptions[Math.floor(Math.random()*waterOptions.length)], 
            generator: generatorOptions[Math.floor(Math.random()*generatorOptions.length)],
            med: medOptions[Math.floor(Math.random()*medOptions.length)],
            mech: mechOptions[Math.floor(Math.random()*mechOptions.length)],
            grow: growOptions[Math.floor(Math.random()*growOptions.length)],
            special: getSpecialItems(currentCatastrophe.name)
        };
    }

    document.getElementById('catastrophe-name').innerText = currentCatastrophe.name;
    document.getElementById('catastrophe-desc').innerText = currentCatastrophe.desc;
    document.getElementById('catastrophe-time').innerText = currentCatastrophe.time;
    document.getElementById('bunker-capacity-text').innerText = `УСЛОВИЯ БУНКЕРА (ВМЕСТИМОСТЬ: ${currentBunkerStats.capacity} МЕСТ)`;
    document.getElementById('bunker-area').innerText = `${currentBunkerStats.area} м²`;
    document.getElementById('bunker-water').innerText = currentBunkerStats.water;
    document.getElementById('bunker-generator').innerText = currentBunkerStats.generator;
    document.getElementById('bunker-med').innerText = currentBunkerStats.med;
    document.getElementById('bunker-mech').innerText = currentBunkerStats.mech;
    document.getElementById('bunker-grow').innerText = currentBunkerStats.grow;
    document.getElementById('bunker-special').innerText = currentBunkerStats.special;

    const grid = document.getElementById('cards-container');
    grid.innerHTML = ''; 
    playersData = [];
    kickedPlayers = [];
    playersState = {}; // Очистка

    let availableFacts = [];
    while(availableFacts.length < selectedPlayersCount * 2) availableFacts = availableFacts.concat(factsList);
    shuffleArray(availableFacts);

    let availableActions = [];
    while(availableActions.length < selectedPlayersCount * 2) availableActions = availableActions.concat(actionsList);
    shuffleArray(availableActions);

    let maniacId = -1, killerId = -1, killerTargetId = -1;
    const pIds = Array.from({length: selectedPlayersCount}, (_, i) => i + 1).sort(() => Math.random() - 0.5);

    if (selectedRoleMode === "Маньяк") maniacId = pIds[0];
    else if (selectedRoleMode === "Убийца") killerId = pIds[0];
    else if (selectedRoleMode === "Маньяк и Убийца") { maniacId = pIds[0]; killerId = pIds[1]; }

    if (killerId !== -1) {
        let targets = [];
        for (let k = 1; k <= selectedPlayersCount; k++) if (k !== killerId) targets.push(k);
        killerTargetId = targets[Math.floor(Math.random() * targets.length)];
    }

	// ....................................................


    // 3. Роли
	const threatX = threatsListX[Math.floor(Math.random() * threatsListX.length)];
    const threatY = threatsListY[Math.floor(Math.random() * threatsListY.length)];
    const threatEl = document.getElementById('secret-threats-display');
    if(threatEl) {
        threatEl.innerText = `1. ${threatX}\n\n2. ${threatY}`;
        threatEl.classList.add('spoiler'); // Возвращаем блюр
    }

    const randomLoc = externalLocationsList[Math.floor(Math.random() * externalLocationsList.length)];
    const locEl = document.getElementById('external-location-display');
    if(locEl) {
        locEl.innerText = randomLoc;
        locEl.classList.add('spoiler'); // Возвращаем блюр
    }
    
    // Роли тоже блюрим
    let secretInfoText = "ОТСУТСТВУЮТ";
    if (maniacId !== -1 && killerId !== -1) secretInfoText = `МАНЬЯК: ИГРОК ${maniacId}\nУБИЙЦА: ИГРОК ${killerId}`;
    else if (maniacId !== -1) secretInfoText = `МАНЬЯК: ИГРОК ${maniacId}`;
    else if (killerId !== -1) secretInfoText = `УБИЙЦА: ИГРОК ${killerId}`;
    
    const secretRolesEl = document.getElementById('secret-roles-display');
    if(secretRolesEl) {
        secretRolesEl.innerText = secretInfoText;
        secretRolesEl.classList.add('spoiler'); // Возвращаем блюр
    }
    // ------------------------------


    for (let i = 1; i <= selectedPlayersCount; i++) {
        const gender = Math.random() > 0.5 ? "Мужчина" : "Женщина";
        const age = Math.floor(Math.random() * 60) + 18;
        const profession = professionsList[Math.floor(Math.random() * professionsList.length)];
        let experience = (age <= 30) ? Math.floor(Math.random()*9)+2 : Math.floor(Math.random()*14)+2;
        const expStr = getAgeString(experience);
        
        let health = "";
        if (Math.random() < 0.7) health = "Идеально здоров";
        else health = `${healthList[Math.floor(Math.random()*healthList.length)]} (${Math.floor(Math.random()*80)+10}%)`;
        
        const hobby = hobbiesList[Math.floor(Math.random() * hobbiesList.length)];
        let phobia = (Math.random() < 0.5) ? "Нет фобий" : phobiasList[Math.floor(Math.random()*phobiasList.length)];
        const baggage = baggageList[Math.floor(Math.random() * baggageList.length)];
        const fact1 = availableFacts.pop();
        let fact2 = availableFacts.pop();
        const act1 = availableActions.pop();
        const act2 = availableActions.pop();
		const pColor = playerColors[(i - 1) % playerColors.length];

        // Определяем роли
        const isManiac = (i === maniacId);
        const isKiller = (i === killerId);

        if (isManiac) fact2 = `<span class="special-role-text">ВЫ МАНЬЯК! (Цель: убить всех)</span>`;
        else if (isKiller) fact2 = `<span class="special-role-text">ВЫ УБИЙЦА! (Цель: кикнуть игрока ${killerTargetId})</span>`;

        const cleanF2 = (isManiac) ? "ВЫ МАНЬЯК!" : (isKiller) ? `ВЫ УБИЙЦА! Цель: ${killerTargetId}` : fact2;
		
        // СОХРАНЯЕМ В STATE
        playersState[i] = {
            gender, age, profession, experience, expStr, health, hobby, phobia, baggage, fact1, fact2: cleanF2, act1, act2,
            isManiac, isKiller,
			color: pColor, // <--- ДОБАВЬ ВОТ ЭТУ СТРОКУ (Сохраняем цвет)
        };
        updatePlayerDataString(i); // Формируем строку для скачивания

        const card = document.createElement('div');
        card.className = 'player-slot liquid-glass blue-top-glow';
        card.id = `player-card-${i}`;
        card.style.animation = `cardEntrance 1.2s cubic-bezier(0.2,0.8,0.2,1) forwards ${i*0.1}s`;
        
		// --- ЦВЕТ ИГРОКА ---
        // Берем цвет по индексу (i-1), если игроков больше цветов - повторяем по кругу
		
        // СОЗДАЕМ КОНТЕЙНЕР
        const cardContainer = document.createElement('div');
        cardContainer.className = 'player-flip-wrapper';
        // При клике переворачиваем
        cardContainer.setAttribute('onclick', `togglePlayerCard(${i})`);

        // ВНУТРЕННЯЯ ЧАСТЬ (С КЛАССОМ closed = ПОВЕРНУТА СПИНОЙ)
        cardContainer.innerHTML = `
            <div class="player-card-inner closed" id="player-card-inner-${i}">
				<!-- ЦВЕТНАЯ ПОЛОСКА СВЕРХУ -->
				<div class="player-color-bar" style="background: ${pColor}; box-shadow: 0 0 20px ${pColor};"></div>
                
                <!-- ЛИЦЕВАЯ СТОРОНА (ИНФА) -->
                <div class="player-front liquid-glass blue-top-glow" id="player-card-${i}">
                    <div class="kicked-overlay"><div class="kicked-text">КИКНУТ<br>ГОЛОСОВАНИЕМ</div></div>
                    
                    <div class="card-settings-btn" onclick="toggleCardSettings(event, ${i})">⚙</div>
                    <div class="card-settings-menu" id="card-settings-${i}" onclick="event.stopPropagation()">
                        <div class="card-setting-item" onclick="rerollTrait(event, ${i}, 'gender_age')">Пол и возраст</div>
                        <div class="card-setting-item" onclick="rerollTrait(event, ${i}, 'profession')">Профессия</div>
                        <div class="card-setting-item" onclick="rerollTrait(event, ${i}, 'health')">Состояние здоровья</div>
                        <div class="card-setting-item" onclick="rerollTrait(event, ${i}, 'hobby')">Хобби</div>
                        <div class="card-setting-item" onclick="rerollTrait(event, ${i}, 'phobia')">Фобия</div>
                        <div class="card-setting-item" onclick="rerollTrait(event, ${i}, 'baggage')">Багаж</div>
                        <div class="card-setting-item" onclick="rerollTrait(event, ${i}, 'fact1')">Факт №1</div>
                        <div class="card-setting-item" onclick="rerollTrait(event, ${i}, 'fact2')">Факт №2</div>
                    </div>

                    <!-- stopPropagation нужен, чтобы при вводе имени карта не вертелась -->
                    <input type="text" class="player-title-input" value="ИГРОК ${i}" 
                           oninput="updatePlayerName(${i}, this.value)" onclick="event.stopPropagation()">
                    
                    <div class="player-divider"></div>
                    <div class="label-cyan" id="p-gender-${i}">Пол и возраст: <span class="val-white">${gender}, ${age} лет</span> </div>
                    <div class="label-cyan" id="p-prof-${i}">Профессия: <span class="val-white"> ${profession} (${experience} ${expStr})</span></div>
                    <div class="label-cyan" id="p-health-${i}">Состояние здоровья: <span class="val-white">${health}</span></div>
                    <div class="label-cyan" id="p-hobby-${i}">Хобби: <span class="val-white">${hobby}</span></div>
                    <div class="label-cyan" id="p-phobia-${i}">Фобия: <span class="val-white">${phobia}</span></div>
                    <div class="label-cyan" id="p-baggage-${i}">Багаж: <span class="val-white">${baggage}</span></div>
                    <div class="player-divider"></div> 
                    <div class="label-cyan" id="p-fact1-${i}">Факт №1: <span class="val-white">${fact1}</span></div>
                    <div class="label-cyan" id="p-fact2-${i}">Факт №2: <span class="val-white">${fact2}</span></div>
                    <div class="player-divider"></div> 
                    <div class="label-gold" id="p-act1-${i}">Карта действия №1: </span> <span class="val-white">${act1}</span></div>
                    <div class="label-gold" id="p-act2-${i}">Карта действия №2: </span> <span class="val-white">${act2}</span></div>
                    
                    <!-- Кнопки действий тоже не должны переворачивать карту -->
                    <div class="card-actions" onclick="event.stopPropagation()">
                        <button class="action-btn btn-vote" onclick="openVoteModal(${i})">ГОЛОСОВАТЬ</button>
                        <button class="action-btn btn-kick" id="btn-kick-${i}" onclick="kickPlayer(${i})">КИК</button>
                        <button class="action-btn btn-download" onclick="downloadCard(${i})">💾</button>
                    </div>
                </div>

                <!-- ОБРАТНАЯ СТОРОНА (РУБАШКА) -->
                <div class="player-back">
                    <div class="back-title">ИГРОК ${i}</div>
                </div>

            </div>
        `;
        grid.appendChild(cardContainer);
    }
    
    const vList = document.getElementById('voting-container');
    vList.innerHTML = ''; 

    for (let i = 1; i <= selectedPlayersCount; i++) {
        const item = document.createElement('div');
        item.className = 'vote-item';
        item.id = `vote-row-${i}`;
        
        // ДОБАВИЛ ID="vote-name-${i}"
        item.innerHTML = `
            <span class="vote-name" id="vote-name-${i}">ИГРОК ${i}</span>
            <div class="votes-container" id="votes-for-${i}"></div>
        `;
        vList.appendChild(item);
    }
}

function showLobbyScreen() {
    document.getElementById('page-1').classList.add('page-hidden');
    document.getElementById('header-group-1').classList.remove('headers-visible');
    document.getElementById('header-group-1').classList.add('headers-hidden');
    document.getElementById('page-2').classList.remove('page-hidden');
    document.getElementById('header-group-2').classList.remove('headers-hidden');
    document.getElementById('header-group-2').classList.add('headers-visible');
    document.querySelector('.bg-start').classList.remove('active');
    document.querySelector('.bg-lobby').classList.add('active');
}

// Функция для досрочного начала игры из админки
function forceStartGame() {
    // Проверяем, является ли пользователь админом
    if (!currentUser) {
        alert('Сначала авторизуйтесь!');
        return;
    }
    
    // currentUser - это объект, проверяем его свойство isAdmin
    // Также проверяем в usersData на случай, если там более свежие данные
    const userInData = usersData.find(u => u.username === currentUser.username);
    const isAdmin = currentUser.isAdmin || (userInData && userInData.isAdmin);
    
    if (!isAdmin) {
        console.log('Проверка админа:', {
            currentUser: currentUser,
            userInData: userInData,
            isAdmin: isAdmin
        });
        alert('Только администратор может досрочно начать игру!');
        return;
    }
    
    // Устанавливаем минимальные значения для игры
    if (selectedPlayersCount === 0) {
        selectedPlayersCount = 4; // Минимальное количество игроков
    }
    
    if (selectedRoleMode === "") {
        selectedRoleMode = "Без них"; // Режим по умолчанию
    }
    
    // Очищаем готовых игроков на сервере и локально
    localStorage.removeItem('bunkerGameReady');
    readyUsers = [];
    saveReadyPlayerToServer('clear', {}).catch(err => {
        console.error('Ошибка очистки на сервере:', err);
    });
    updateReadyDisplay();
    
    // Скрываем админку перед переходом на страницу игры
    document.getElementById('page-5')?.classList.add('page-hidden');
    document.getElementById('header-group-1')?.classList.remove('headers-visible');
    document.getElementById('header-group-1')?.classList.add('headers-hidden');
    
    // Генерируем лобби и показываем экран
    generateLobby();
    showLobbyScreen();
    
    alert('Игра начата досрочно администратором!');
}

function goToMain() {
    // Скрываем все страницы
    document.getElementById('page-2')?.classList.add('page-hidden');
    document.getElementById('page-3')?.classList.add('page-hidden');
    document.getElementById('page-4')?.classList.add('page-hidden');
    document.getElementById('page-5')?.classList.add('page-hidden');
    document.getElementById('header-group-2')?.classList.remove('headers-visible');
    document.getElementById('header-group-2')?.classList.add('headers-hidden');
    
    // Показываем главную страницу
    document.getElementById('page-1').classList.remove('page-hidden');
    document.getElementById('header-group-1').classList.remove('headers-hidden');
    document.getElementById('header-group-1').classList.add('headers-visible');
    document.querySelector('.bg-lobby')?.classList.remove('active');
    document.querySelector('.bg-start')?.classList.add('active');
}

function goToRules() {
    // Скрываем все страницы
    document.getElementById('page-1')?.classList.add('page-hidden');
    document.getElementById('page-2')?.classList.add('page-hidden');
    document.getElementById('page-4')?.classList.add('page-hidden');
    document.getElementById('page-5')?.classList.add('page-hidden');
    document.getElementById('header-group-2')?.classList.remove('headers-visible');
    document.getElementById('header-group-2')?.classList.add('headers-hidden');
    
    // Показываем страницу правил
    document.getElementById('page-3').classList.remove('page-hidden');
    document.getElementById('header-group-1').classList.remove('headers-hidden');
    document.getElementById('header-group-1').classList.add('headers-visible');
    document.querySelector('.bg-lobby')?.classList.remove('active');
    document.querySelector('.bg-start')?.classList.add('active');
}

// Переменная для отслеживания, откуда пришли на страницу информации
let infoReturnTo = 'main'; // 'main' или 'admin'

function goToInfo() {
    // Определяем, откуда пришли (если админка открыта, значит из админки)
    const adminPage = document.getElementById('page-5');
    if (adminPage && !adminPage.classList.contains('page-hidden')) {
        infoReturnTo = 'admin';
    } else {
        infoReturnTo = 'main';
    }
    
    // Скрываем все страницы
    document.getElementById('page-1')?.classList.add('page-hidden');
    document.getElementById('page-2')?.classList.add('page-hidden');
    document.getElementById('page-3')?.classList.add('page-hidden');
    document.getElementById('page-5')?.classList.add('page-hidden');
    document.getElementById('header-group-2')?.classList.remove('headers-visible');
    document.getElementById('header-group-2')?.classList.add('headers-hidden');
    
    // Показываем страницу информации
    document.getElementById('page-4').classList.remove('page-hidden');
    document.getElementById('header-group-1').classList.remove('headers-hidden');
    document.getElementById('header-group-1').classList.add('headers-visible');
    document.querySelector('.bg-lobby')?.classList.remove('active');
    document.querySelector('.bg-start')?.classList.add('active');
    
    // Генерируем контент информации
    generateInfoContent();
}

// Функция возврата со страницы информации
function goBackFromInfo() {
    if (infoReturnTo === 'admin') {
        // Возвращаемся в админку
        goToAdmin();
    } else {
        // Возвращаемся в главное меню
        goToMain();
    }
}

function goToAdmin() {
    // Проверяем права доступа
    if (!currentUser || !currentUser.isAdmin) {
        alert('У вас нет прав доступа к администрированию!');
        return;
    }
    
    // Скрываем все страницы
    document.getElementById('page-1')?.classList.add('page-hidden');
    document.getElementById('page-2')?.classList.add('page-hidden');
    document.getElementById('page-3')?.classList.add('page-hidden');
    document.getElementById('page-4')?.classList.add('page-hidden');
    document.getElementById('header-group-2')?.classList.remove('headers-visible');
    document.getElementById('header-group-2')?.classList.add('headers-hidden');
    
    // Показываем страницу администрирования
    document.getElementById('page-5').classList.remove('page-hidden');
    document.getElementById('header-group-1').classList.remove('headers-hidden');
    document.getElementById('header-group-1').classList.add('headers-visible');
    document.querySelector('.bg-lobby')?.classList.remove('active');
    document.querySelector('.bg-start')?.classList.add('active');
    
    // Загружаем актуальные данные перед генерацией контента
    loadUsersData().then(() => {
        // Генерируем контент админки
        setTimeout(async () => {
            await refreshAdminData();
        }, 100);
    });
    
    // Устанавливаем автоматическое обновление каждые 3 секунды
    if (window.adminRefreshInterval) {
        clearInterval(window.adminRefreshInterval);
    }
    window.adminRefreshInterval = setInterval(() => {
        if (!document.getElementById('page-5')?.classList.contains('page-hidden')) {
            loadUsersData();
            refreshAdminData();
        }
    }, 3000);
}

function generateInfoContent() {
    const container = document.getElementById('info-content');
    if (!container) return;
    
    // Убеждаемся, что используем актуальные списки
    // (они уже загружены из localStorage при старте, если были сохранены)
    
    container.innerHTML = `
        <div class="info-section">
            <h3 class="info-section-title">Профессии (${professionsList.length})</h3>
            <ul class="info-list">
                ${professionsList.map(item => `<li class="info-list-item">${item}</li>`).join('')}
            </ul>
        </div>
        
        <div class="info-section">
            <h3 class="info-section-title">Состояния здоровья (${healthList.length})</h3>
            <ul class="info-list">
                ${healthList.map(item => `<li class="info-list-item">${item}</li>`).join('')}
            </ul>
        </div>
        
        <div class="info-section">
            <h3 class="info-section-title">Хобби (${hobbiesList.length})</h3>
            <ul class="info-list">
                ${hobbiesList.map(item => `<li class="info-list-item">${item}</li>`).join('')}
            </ul>
        </div>
        
        <div class="info-section">
            <h3 class="info-section-title">Фобии (${phobiasList.length})</h3>
            <ul class="info-list">
                ${phobiasList.map(item => `<li class="info-list-item">${item}</li>`).join('')}
            </ul>
        </div>
        
        <div class="info-section">
            <h3 class="info-section-title">Факты (${factsList.length})</h3>
            <ul class="info-list">
                ${factsList.map(item => `<li class="info-list-item">${item}</li>`).join('')}
            </ul>
        </div>
        
        <div class="info-section">
            <h3 class="info-section-title">Карты действий (${actionsList.length})</h3>
            <ul class="info-list" style="grid-template-columns: 1fr;">
                ${actionsList.map(item => `<li class="info-list-item">${item}</li>`).join('')}
            </ul>
        </div>
    `;
}

// --- ФУНКЦИИ РЕРОЛЛА ---
function toggleCardSettings(event, id) {
    event.stopPropagation();
    document.querySelectorAll('.card-settings-menu').forEach(el => el.classList.remove('show'));
    document.getElementById(`card-settings-${id}`).classList.toggle('show');
}

// ИСПРАВЛЕННАЯ ФУНКЦИЯ РЕРОЛЛА
function rerollTrait(event, id, type) {
    // ВАЖНО: Останавливаем клик, чтобы не триггерить переворот карточки
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const state = playersState[id];
    if (!state) {
        console.error('Ошибка: состояние игрока не найдено', {id});
        return;
    }
    
    const menu = document.getElementById(`card-settings-${id}`);

    switch (type) {
        case 'gender_age':
            // ... (логика генерации цифр) ...
            state.gender = Math.random() > 0.5 ? "Мужчина" : "Женщина";
            state.age = Math.floor(Math.random() * 60) + 18;
            if (state.age <= 30) state.experience = Math.floor(Math.random() * 9) + 2;
            else state.experience = Math.floor(Math.random() * 14) + 2;
            state.expStr = getAgeString(state.experience);

            // ЗАМЕНА: используем innerHTML и спаны
            document.getElementById(`p-gender-${id}`).innerHTML = `<span class="label-cyan">Пол и возраст:</span> <span class="val-white">${state.gender}, ${state.age} лет</span>`;
            document.getElementById(`p-prof-${id}`).innerHTML = `<span class="label-cyan">Профессия:</span> <span class="val-white">${state.profession} (${state.experience} ${state.expStr})</span>`;
            break;

        case 'profession':
            state.profession = professionsList[Math.floor(Math.random() * professionsList.length)];
            if (state.age <= 30) state.experience = Math.floor(Math.random() * 9) + 2;
            else state.experience = Math.floor(Math.random() * 14) + 2;
            state.expStr = getAgeString(state.experience);
            
            document.getElementById(`p-prof-${id}`).innerHTML = `<span class="label-cyan">Профессия:</span> <span class="val-white">${state.profession} (${state.experience} ${state.expStr})</span>`;
            break;

        case 'health':
            if (Math.random() < 0.7) state.health = "Идеально здоров";
            else state.health = `${healthList[Math.floor(Math.random()*healthList.length)]} (${Math.floor(Math.random()*81)+10}%)`;
            
            document.getElementById(`p-health-${id}`).innerHTML = `<span class="label-cyan">Состояние здоровья:</span> <span class="val-white">${state.health}</span>`;
            break;

        case 'hobby':
            state.hobby = hobbiesList[Math.floor(Math.random() * hobbiesList.length)];
            document.getElementById(`p-hobby-${id}`).innerHTML = `<span class="label-cyan">Хобби:</span> <span class="val-white">${state.hobby}</span>`;
            break;

        case 'phobia':
            state.phobia = (Math.random() < 0.5) ? "Нет фобий" : phobiasList[Math.floor(Math.random()*phobiasList.length)];
            document.getElementById(`p-phobia-${id}`).innerHTML = `<span class="label-cyan">Фобия:</span> <span class="val-white">${state.phobia}</span>`;
            break;

        case 'baggage':
            state.baggage = baggageList[Math.floor(Math.random() * baggageList.length)];
            document.getElementById(`p-baggage-${id}`).innerHTML = `<span class="label-cyan">Багаж:</span> <span class="val-white">${state.baggage}</span>`;
            break;

        case 'fact1':
            state.fact1 = factsList[Math.floor(Math.random() * factsList.length)];
            document.getElementById(`p-fact1-${id}`).innerHTML = `<span class="label-cyan">Факт №1:</span> <span class="val-white">${state.fact1}</span>`;
            break;

        case 'fact2':
            if (state.isManiac || state.isKiller) {
                alert("Нельзя изменить этот факт: У игрока активная спец. роль!");
            } else {
                state.fact2 = factsList[Math.floor(Math.random() * factsList.length)];
                document.getElementById(`p-fact2-${id}`).innerHTML = `<span class="label-cyan">Факт №2:</span> <span class="val-white">${state.fact2}</span>`;
            }
            break;
    }
    updatePlayerDataString(id);
    if (menu) menu.classList.remove('show');
}

function updatePlayerDataString(id) {
    const s = playersState[id];
    const cleanF2 = (s.isManiac || s.isKiller) ? s.fact2.replace(/<[^>]*>?/gm, '') : s.fact2;
    let pIndex = playersData.findIndex(p => p.id === id);
    let info = `ИГРОК ${id}\nПол/Возраст: ${s.gender}, ${s.age}\nПрофессия: ${s.profession} (${s.experience} ${s.expStr})\nЗдоровье: ${s.health}\nХобби: ${s.hobby}\nФобия: ${s.phobia}\nБагаж: ${s.baggage}\nФакт 1: ${s.fact1}\nФакт 2: ${cleanF2}\nДействие 1: ${s.act1}\nДействие 2: ${s.act2}`;
    if (pIndex !== -1) playersData[pIndex].info = info;
    else playersData.push({id, info});
}

let currentVoterIndex = -1;
function openVoteModal(idx) {
    if (kickedPlayers.includes(idx)) { alert("Мертвые не голосуют!"); return; }
    currentVoterIndex = idx;
    document.getElementById('voter-name-display').innerText = `ИГРОК ${idx}`;
    const c = document.getElementById('vote-targets-container');
    c.innerHTML = '';
    for(let i=1; i<=selectedPlayersCount; i++){
        if(i===idx) continue;
        const b = document.createElement('button');
        b.className = 'vote-target-btn';
        if(kickedPlayers.includes(i)) { b.innerText = `ИГРОК ${i} (КИК)`; b.disabled=true; b.style.opacity=0.3; }
        else { b.innerText = `ИГРОК ${i}`; b.onclick = () => submitVote(i); }
        c.appendChild(b);
    }
    document.getElementById('vote-modal').classList.add('active');
}
function closeVoteModal() { document.getElementById('vote-modal').classList.remove('active'); }
function submitVote(targetIdx) {
    const container = document.getElementById(`votes-for-${targetIdx}`);
    
    // 1. Достаем цвет ТОГО, КТО ГОЛОСУЕТ
    const voterColor = playersState[currentVoterIndex].color; 

    const badge = document.createElement('div');
    badge.className = 'vote-badge';
    badge.innerText = currentVoterIndex; // Номер голосующего
    
    // 2. Красим кружок в этот цвет
    badge.style.border = `2px solid ${voterColor}`;
    badge.style.boxShadow = `0 0 10px ${voterColor}`;
    badge.style.color = "#fff"; // Цифра белая
    badge.style.background = "rgba(0,0,0,0.5)"; // Фон чуть темный для читаемости
    
    container.appendChild(badge);
    closeVoteModal();
}
// Функция создания эффекта взрыва
function createExplosion(cardElement) {
    if (!cardElement) return;
    
    const rect = cardElement.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Создаем контейнер для частиц
    const explosionContainer = document.createElement('div');
    explosionContainer.className = 'explosion-container';
    cardElement.style.position = 'relative';
    cardElement.appendChild(explosionContainer);
    
    // Добавляем класс тряски карточке
    cardElement.classList.add('player-card-exploding');
    
    // Создаем частицы
    const particleCount = 30;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'explosion-particle';
        
        // Случайный угол и расстояние
        const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
        const distance = 100 + Math.random() * 150;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        const rotation = Math.random() * 720 - 360;
        
        // Позиция частицы в центре карточки
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        particle.style.setProperty('--rot', rotation + 'deg');
        
        // Случайный цвет (красный/оранжевый)
        const colors = ['#ff0055', '#ff4444', '#ff8800', '#ffaa00'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.background = color;
        particle.style.boxShadow = `0 0 10px ${color}, 0 0 20px ${color}`;
        
        explosionContainer.appendChild(particle);
    }
    
    // Удаляем контейнер после анимации
    setTimeout(() => {
        if (explosionContainer.parentNode) {
            explosionContainer.parentNode.removeChild(explosionContainer);
        }
        cardElement.classList.remove('player-card-exploding');
    }, 1000);
}

function kickPlayer(idx) {
    const btn = document.getElementById(`btn-kick-${idx}`);
    const card = document.getElementById(`player-card-${idx}`);
    const voteRow = document.getElementById(`vote-row-${idx}`);
    const cardInner = document.getElementById(`player-card-inner-${idx}`);
    const backTitle = cardInner?.querySelector('.back-title');
    const cardWrapper = document.querySelector(`#player-card-inner-${idx}`)?.closest('.player-flip-wrapper');

    if (kickedPlayers.includes(idx)) {
        if(confirm(`Вернуть ИГРОКА ${idx} в игру?`)) {
            kickedPlayers = kickedPlayers.filter(id => id !== idx);
            card.classList.remove('kicked');
            if (cardInner) cardInner.classList.remove('closed'); // Открываем карточку обратно
            if (backTitle) backTitle.innerText = `ИГРОК ${idx}`; // Возвращаем оригинальный текст
            voteRow.style.opacity = 1;
            voteRow.querySelector('.vote-name').style.textDecoration = "none";
            btn.innerText = "КИК";
            btn.classList.remove('btn-restore');
            btn.classList.add('btn-kick'); 
            btn.style.background = ""; btn.style.color = ""; btn.style.borderColor = "";
        }
    } else {
        if(confirm(`Кикнуть ИГРОКА ${idx}?`)) {
            kickedPlayers.push(idx);
            
            // Создаем эффект взрыва
            if (cardWrapper) {
                createExplosion(cardWrapper);
            }
            
            // Небольшая задержка перед переворотом карточки для эффекта
            setTimeout(() => {
                card.classList.add('kicked');
                if (cardInner) cardInner.classList.add('closed'); // Переворачиваем карточку
                if (backTitle) backTitle.innerText = "Игрок изгнан голосованием"; // Меняем текст
            }, 300);
            
            voteRow.style.opacity = 0.5;
            voteRow.querySelector('.vote-name').style.textDecoration = "line-through";
            btn.innerText = "ВОССТАНОВИТЬ";
            btn.classList.add('btn-restore');
        }
    }
}
function downloadCard(idx) {
    const p = playersData.find(x => x.id === idx);
    if(!p) return;
    const name = playersState[idx]?.name || `Player_${idx}`;
    let content = `=== PROJECT ZERO: BUNKER GAME ===\n\n`;
    content += `[КАТАСТРОФА]\nНазвание: ${currentCatastrophe.name}\nВремя в бункере: ${currentCatastrophe.time}\nОписание: ${currentCatastrophe.desc}\n\n`;
    content += `[БУНКЕР]\nВместимость: ${currentBunkerStats.capacity} мест\nПлощадь: ${currentBunkerStats.area} м²\nВода: ${currentBunkerStats.water}\nГенератор: ${currentBunkerStats.generator}\nМедпункт: ${currentBunkerStats.med}\nМеханик: ${currentBunkerStats.mech}\nСад: ${currentBunkerStats.grow}\nСнабжение: ${currentBunkerStats.special}\n\n`;
    content += `=================================\n[${name}]\n\n`;
    const infoBody = p.info.substring(p.info.indexOf('\n') + 1);
    content += infoBody;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`${name}_Card.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function endGame() { location.reload(); }
// Функция обновления имени
function updatePlayerName(id, newName) {
    // 1. Обновляем имя в списке справа (Голосование)
    const voteName = document.getElementById(`vote-name-${id}`);
    if (voteName) voteName.innerText = newName;

    // 2. Сохраняем новое имя в память (для скачивания файла)
    if (playersState[id]) {
        playersState[id].name = newName;
        // Обновляем текст для скачивания
        updatePlayerDataString(id);
    }
}
// Функция переворота карточки игрока
function togglePlayerCard(id) {
    const cardInner = document.getElementById(`player-card-inner-${id}`);
    // Тоглим класс closed: если есть - убираем (открываем), если нет - добавляем (закрываем)
    cardInner.classList.toggle('closed');
}
// --- ЛОГИКА ДЛЯ СПОЙЛЕРОВ (СЕКРЕТНАЯ ИНФА) ---
document.addEventListener('click', function(e) {
    // Проверяем, кликнули ли мы на элемент с классом 'spoiler'
    if (e.target.classList.contains('spoiler')) {
        // Убираем класс, текст становится четким
        e.target.classList.remove('spoiler');
        // Добавляем эффект "проявления" (опционально, для красоты)
        e.target.style.transition = "all 0.5s ease";
        e.target.style.color = "#ffffff";
        e.target.style.textShadow = "none";
    }
});

// === ФУНКЦИИ АДМИНИСТРИРОВАНИЯ ===

async function refreshAdminData() {
    // Загружаем актуальные данные с сервера
    const serverLoaded = await loadUsersFromServer();
    
    if (!serverLoaded) {
        // Если не удалось загрузить с сервера, используем localStorage
        const saved = localStorage.getItem('bunkerGameUsers');
        if (saved) {
            try {
                const loadedUsers = JSON.parse(saved);
                usersData = loadedUsers;
                console.log('Админка: загружено пользователей из localStorage (fallback):', usersData.length);
            } catch(e) {
                console.error('Ошибка загрузки пользователей:', e);
                usersData = [];
            }
        } else {
            usersData = [];
            console.log('Админка: данных нет');
        }
    } else {
        console.log('Админка: загружено пользователей с сервера:', usersData.length);
    }
    
    // Обновляем статистику
    const totalUsersEl = document.getElementById('admin-total-users');
    if (totalUsersEl) {
        totalUsersEl.textContent = usersData.length;
    }
    
    // Генерируем список пользователей
    const listContainer = document.getElementById('admin-users-list');
    if (!listContainer) return;
    
    if (usersData.length === 0) {
        listContainer.innerHTML = '<div class="admin-empty">Нет зарегистрированных пользователей</div>';
        return;
    }
    
    listContainer.innerHTML = usersData.map((user, index) => {
        const regDate = user.registeredAt ? new Date(user.registeredAt).toLocaleString('ru-RU') : 'Не указано';
        const isAdmin = user.isAdmin || false;
        const isCurrentUser = currentUser && currentUser.username === user.username;
        const cannotRemoveAdmin = isAdmin && user.username === 'drochYo'; // drochYo нельзя лишить прав
        
        return `
            <div class="admin-user-item ${isAdmin ? 'admin-user-admin' : ''}">
                <div class="admin-user-info">
                    <div class="admin-user-field">
                        <span class="admin-user-label">Логин:</span>
                        <span class="admin-user-value">${user.username} ${isAdmin ? '👑' : ''}</span>
                    </div>
                    <div class="admin-user-field">
                        <span class="admin-user-label">Email:</span>
                        <span class="admin-user-value">${user.email || 'Не указано'}</span>
                    </div>
                    <div class="admin-user-field">
                        <span class="admin-user-label">Пароль:</span>
                        <span class="admin-user-value">${'*'.repeat(user.password.length)}</span>
                    </div>
                    <div class="admin-user-field">
                        <span class="admin-user-label">Дата регистрации:</span>
                        <span class="admin-user-value">${regDate}</span>
                    </div>
                    <div class="admin-user-field">
                        <span class="admin-user-label">Статус:</span>
                        <span class="admin-user-value">${isAdmin ? 'Администратор' : 'Пользователь'}</span>
                    </div>
                </div>
                <div class="admin-user-actions">
                    ${!isCurrentUser ? `
                        <button class="admin-user-toggle-admin ${isAdmin ? 'admin-user-remove-admin' : 'admin-user-give-admin'}" 
                                onclick="toggleAdmin(${index})" 
                                title="${isAdmin ? 'Отозвать права администратора' : 'Выдать права администратора'}">
                            ${isAdmin ? '👑 Убрать админа' : '👑 Сделать админом'}
                        </button>
                    ` : '<span class="admin-user-current">Вы</span>'}
                    ${!cannotRemoveAdmin ? `
                        <button class="admin-user-delete" onclick="deleteUser(${index})" title="Удалить пользователя">🗑️</button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function toggleAdmin(index) {
    const user = usersData[index];
    if (!user) return;
    
    // Нельзя лишить прав пользователя drochYo
    if (user.username === 'drochYo' && user.isAdmin) {
        alert('Нельзя отозвать права администратора у пользователя drochYo!');
        return;
    }
    
    const action = user.isAdmin ? 'отозвать права администратора' : 'выдать права администратора';
    if (confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} у пользователя "${user.username}"?`)) {
        user.isAdmin = !user.isAdmin;
        
        // Если это текущий пользователь, обновляем его данные
        if (currentUser && currentUser.username === user.username) {
            currentUser.isAdmin = user.isAdmin;
            updateAuthUI();
        }
        
        // Сохраняем на сервер
        await saveSingleUserToServer(user, 'update');
        await saveUsersData(); // Синхронизируем весь массив
        await refreshAdminData();
        alert(`Права администратора ${user.isAdmin ? 'выданы' : 'отозваны'}!`);
    }
}

async function deleteUser(index) {
    const user = usersData[index];
    if (!user) return;
    
    // Нельзя удалить пользователя drochYo
    if (user.username === 'drochYo') {
        alert('Нельзя удалить пользователя drochYo!');
        return;
    }
    
    if (confirm(`Удалить пользователя "${user.username}"?`)) {
        try {
            // Удаляем на сервере
            const response = await fetch(getApiUrl('saveUser'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'delete',
                    user: user
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Удаляем из локального массива
                usersData.splice(index, 1);
                localStorage.setItem('bunkerGameUsers', JSON.stringify(usersData));
                await refreshAdminData();
                alert('Пользователь удален!');
            } else {
                alert('Ошибка при удалении пользователя: ' + data.error);
            }
        } catch (error) {
            console.error('Ошибка при удалении пользователя:', error);
            alert('Ошибка при удалении пользователя. Попробуйте еще раз.');
        }
    }
}

function exportUsersJSON() {
    const dataStr = JSON.stringify(usersData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert('Данные экспортированы в JSON файл!');
}

function exportUsersCSV() {
    if (usersData.length === 0) {
        alert('Нет данных для экспорта!');
        return;
    }
    
    // Заголовки CSV
    let csv = 'Логин,Email,Пароль,Дата регистрации\n';
    
    // Данные
    usersData.forEach(user => {
        const username = `"${user.username.replace(/"/g, '""')}"`;
        const email = `"${(user.email || '').replace(/"/g, '""')}"`;
        const password = `"${user.password.replace(/"/g, '""')}"`;
        const regDate = `"${user.registeredAt || ''}"`;
        csv += `${username},${email},${password},${regDate}\n`;
    });
    
    const dataBlob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert('Данные экспортированы в CSV файл!');
}

async function clearAllUsers() {
    if (confirm('ВНИМАНИЕ! Вы уверены, что хотите удалить ВСЕХ пользователей? Это действие нельзя отменить!')) {
        if (confirm('Последнее предупреждение! Все данные будут удалены!')) {
            try {
                // Удаляем всех пользователей через API
                // Получаем список всех пользователей
                await loadUsersFromServer();
                
                // Удаляем каждого пользователя (кроме drochYo)
                for (const user of usersData) {
                    if (user.username !== 'drochYo') {
                        try {
                            await fetch(getApiUrl('saveUser'), {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    action: 'delete',
                                    user: user
                                })
                            });
                        } catch (error) {
                            console.error(`Ошибка при удалении пользователя ${user.username}:`, error);
                        }
                    }
                }
                
                // Очищаем локальные данные
                usersData = usersData.filter(u => u.username === 'drochYo'); // Оставляем только drochYo
                localStorage.setItem('bunkerGameUsers', JSON.stringify(usersData));
                localStorage.removeItem('bunkerGameSession');
                currentUser = null;
                
                await refreshAdminData();
                updateAuthUI();
                alert('Все пользователи удалены (кроме drochYo)!');
            } catch (error) {
                console.error('Ошибка при удалении пользователей:', error);
                alert('Ошибка при удалении пользователей. Попробуйте еще раз.');
            }
        }
    }
}