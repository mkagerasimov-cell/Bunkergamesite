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

        console.log('=== GET USERS FUNCTION ===');
        console.log('Supabase URL:', supabaseUrl ? 'Установлен' : 'НЕ УСТАНОВЛЕН');
        console.log('Anon Key:', supabaseKey ? 'Установлен' : 'НЕ УСТАНОВЛЕН');
        console.log('Все переменные окружения:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));

        if (!supabaseUrl || !supabaseKey) {
            console.error('Supabase credentials not configured');
            console.error('Доступные переменные:', Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('supabase')));
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Supabase не настроен. Проверьте переменные окружения. Убедитесь, что переменные названы: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY (заглавными буквами) и что сайт передеплоен после добавления переменных.',
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
