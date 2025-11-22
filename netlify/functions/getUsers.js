// Netlify Function для получения списка пользователей из Supabase
exports.handler = async (event, context) => {
    // Разрешаем CORS для всех источников
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    // Только GET запросы
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Получаем переменные окружения
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('Supabase credentials not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Supabase не настроен. Проверьте переменные окружения.',
                    users: []
                })
            };
        }

        // Запрос к Supabase
        const response = await fetch(`${supabaseUrl}/rest/v1/users?select=*&order=registered_at.desc`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Supabase error:', errorText);
            throw new Error(`Supabase error: ${response.status} ${errorText}`);
        }

        const users = await response.json();

        // Преобразуем формат данных для совместимости
        const formattedUsers = users.map(user => ({
            username: user.username,
            password: user.password,
            email: user.email || '',
            registeredAt: user.registered_at || user.created_at,
            isAdmin: user.is_admin || false
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                users: formattedUsers,
                count: formattedUsers.length
            })
        };
    } catch (error) {
        console.error('Ошибка при получении пользователей:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Ошибка сервера при получении пользователей: ' + error.message,
                users: []
            })
        };
    }
};
