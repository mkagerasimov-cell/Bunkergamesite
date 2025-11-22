// Vercel Serverless Function для получения списка пользователей из Supabase
export default async function handler(req, res) {
    // Разрешаем CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Обработка preflight запроса
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Только GET запросы
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Получаем переменные окружения
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        console.log('=== GET USERS FUNCTION ===');
        console.log('Supabase URL:', supabaseUrl ? 'Установлен' : 'НЕ УСТАНОВЛЕН');
        console.log('Anon Key:', supabaseKey ? 'Установлен' : 'НЕ УСТАНОВЛЕН');

        if (!supabaseUrl || !supabaseKey) {
            console.error('Supabase credentials not configured');
            return res.status(500).json({
                success: false,
                error: 'Supabase не настроен. Проверьте переменные окружения.',
                users: []
            });
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

        return res.status(200).json({
            success: true,
            users: formattedUsers,
            count: formattedUsers.length
        });
    } catch (error) {
        console.error('Ошибка при получении пользователей:', error);
        return res.status(500).json({
            success: false,
            error: 'Ошибка сервера при получении пользователей: ' + error.message,
            users: []
        });
    }
}

