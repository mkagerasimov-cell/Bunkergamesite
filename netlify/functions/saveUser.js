// Netlify Function для сохранения/обновления пользователя в Supabase
exports.handler = async (event, context) => {
    // Разрешаем CORS для всех источников
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Обработка preflight запроса
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Только POST запросы
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Получаем переменные окружения
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Используем service key для записи

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Supabase credentials not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Supabase не настроен. Проверьте переменные окружения.'
                })
            };
        }

        // Парсим тело запроса
        const data = JSON.parse(event.body);
        const { user, action } = data;

        if (!user) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Не указан пользователь'
                })
            };
        }

        if (action === 'create') {
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
                    return {
                        statusCode: 409,
                        headers,
                        body: JSON.stringify({
                            success: false,
                            error: 'Пользователь с таким именем уже существует'
                        })
                    };
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

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Пользователь создан',
                    user: {
                        username: result.username,
                        email: result.email,
                        registeredAt: result.registered_at,
                        isAdmin: result.is_admin
                    }
                })
            };

        } else if (action === 'update') {
            // Обновляем существующего пользователя
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

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Пользователь обновлен',
                    user: {
                        username: result.username,
                        email: result.email,
                        isAdmin: result.is_admin
                    }
                })
            };

        } else if (action === 'saveAll') {
            // Сохраняем весь массив пользователей (для синхронизации)
            if (!Array.isArray(user)) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Для saveAll требуется массив пользователей'
                    })
                };
            }

            // Получаем всех существующих пользователей
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

            // Разделяем на создание и обновление
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

            // Создаем новых пользователей
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

            // Обновляем существующих пользователей
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

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Пользователи синхронизированы',
                    created: toCreate.length,
                    updated: toUpdate.length,
                    total: user.length
                })
            };

        } else if (action === 'delete') {
            // Удаляем пользователя
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

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Пользователь удален'
                })
            };

        } else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Неизвестное действие. Используйте: create, update, saveAll или delete'
                })
            };
        }

    } catch (error) {
        console.error('Ошибка при сохранении пользователя:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Ошибка сервера при сохранении пользователя: ' + error.message
            })
        };
    }
};
