// Vercel Serverless Function для сохранения/обновления пользователя в Supabase
export default async function handler(req, res) {
    // Разрешаем CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Обработка preflight запроса
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Только POST запросы
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Получаем переменные окружения
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

        console.log('=== SAVE USER FUNCTION ===');
        console.log('Supabase URL:', supabaseUrl ? 'Установлен' : 'НЕ УСТАНОВЛЕН');
        console.log('Service Key:', supabaseServiceKey ? 'Установлен' : 'НЕ УСТАНОВЛЕН');

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Supabase credentials not configured');
            return res.status(500).json({
                success: false,
                error: 'Supabase не настроен. Проверьте переменные окружения.'
            });
        }

        // Получаем данные из тела запроса
        const { user, action } = req.body;

        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'Не указан пользователь'
            });
        }

        if (action === 'create') {
            console.log('Создание пользователя:', user.username);
            
            // Проверяем, не существует ли уже такой пользователь
            const checkResponse = await fetch(`${supabaseUrl}/rest/v1/users?username=eq.${encodeURIComponent(user.username)}&select=username`, {
                method: 'GET',
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (checkResponse.ok) {
                const existing = await checkResponse.json();
                if (existing && existing.length > 0) {
                    return res.status(409).json({
                        success: false,
                        error: 'Пользователь с таким именем уже существует'
                    });
                }
            }

            // Создаем нового пользователя
            const newUser = {
                username: user.username,
                password: user.password,
                email: user.email || null,
                registered_at: user.registeredAt || new Date().toISOString(),
                is_admin: user.isAdmin || false
            };

            const response = await fetch(`${supabaseUrl}/rest/v1/users`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(newUser)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Supabase error: ${response.status} ${errorText}`);
            }

            const createdUser = await response.json();
            const result = Array.isArray(createdUser) ? createdUser[0] : createdUser;

            return res.status(200).json({
                success: true,
                message: 'Пользователь создан',
                user: {
                    username: result.username,
                    email: result.email,
                    registeredAt: result.registered_at,
                    isAdmin: result.is_admin
                }
            });

        } else if (action === 'update') {
            const updateUser = {
                password: user.password,
                email: user.email || null,
                is_admin: user.isAdmin || false,
                updated_at: new Date().toISOString()
            };

            const response = await fetch(`${supabaseUrl}/rest/v1/users?username=eq.${encodeURIComponent(user.username)}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(updateUser)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Supabase error: ${response.status} ${errorText}`);
            }

            const updatedUser = await response.json();
            const result = Array.isArray(updatedUser) ? updatedUser[0] : updatedUser;

            return res.status(200).json({
                success: true,
                message: 'Пользователь обновлен',
                user: {
                    username: result.username,
                    email: result.email,
                    isAdmin: result.is_admin
                }
            });

        } else if (action === 'saveAll') {
            if (!Array.isArray(user)) {
                return res.status(400).json({
                    success: false,
                    error: 'Для saveAll требуется массив пользователей'
                });
            }

            const getAllResponse = await fetch(`${supabaseUrl}/rest/v1/users?select=username`, {
                method: 'GET',
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const existingUsers = await getAllResponse.json();
            const existingUsernames = new Set(existingUsers.map(u => u.username));

            const toCreate = [];
            const toUpdate = [];

            user.forEach(u => {
                const userData = {
                    username: u.username,
                    password: u.password,
                    email: u.email || null,
                    registered_at: u.registeredAt || new Date().toISOString(),
                    is_admin: u.isAdmin || false
                };

                if (existingUsernames.has(u.username)) {
                    toUpdate.push(userData);
                } else {
                    toCreate.push(userData);
                }
            });

            if (toCreate.length > 0) {
                const createResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseServiceKey,
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(toCreate)
                });

                if (!createResponse.ok) {
                    const errorText = await createResponse.text();
                    console.error('Error creating users:', errorText);
                }
            }

            for (const userData of toUpdate) {
                const updateResponse = await fetch(`${supabaseUrl}/rest/v1/users?username=eq.${encodeURIComponent(userData.username)}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseServiceKey,
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        password: userData.password,
                        email: userData.email,
                        is_admin: userData.is_admin,
                        updated_at: new Date().toISOString()
                    })
                });

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    console.error(`Error updating user ${userData.username}:`, errorText);
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Пользователи синхронизированы',
                created: toCreate.length,
                updated: toUpdate.length,
                total: user.length
            });

        } else if (action === 'delete') {
            const response = await fetch(`${supabaseUrl}/rest/v1/users?username=eq.${encodeURIComponent(user.username)}`, {
                method: 'DELETE',
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Supabase error: ${response.status} ${errorText}`);
            }

            return res.status(200).json({
                success: true,
                message: 'Пользователь удален'
            });

        } else {
            return res.status(400).json({
                success: false,
                error: 'Неизвестное действие. Используйте: create, update, saveAll или delete'
            });
        }

    } catch (error) {
        console.error('Ошибка при сохранении пользователя:', error);
        return res.status(500).json({
            success: false,
            error: 'Ошибка сервера при сохранении пользователя: ' + error.message
        });
    }
}

