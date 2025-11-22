// Vercel Serverless Function для получения списка онлайн пользователей
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

        if (!supabaseUrl || !supabaseKey) {
            return res.status(200).json({
                success: true,
                online: []
            });
        }

        // Запрос к Supabase - получаем онлайн пользователей (активные за последние 30 секунд)
        // Важно: получаем только из таблицы online_users, а не из users!
        const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
        const response = await fetch(`${supabaseUrl}/rest/v1/online_users?timestamp=gt.${thirtySecondsAgo}&select=username,timestamp,is_guest&order=timestamp.desc`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 404 || response.status === 400) {
                return res.status(200).json({
                    success: true,
                    online: []
                });
            }
            const errorText = await response.text();
            throw new Error(`Supabase error: ${response.status} ${errorText}`);
        }

        const onlineUsers = await response.json();

        // Преобразуем формат данных
        const formattedOnline = onlineUsers.map(user => ({
            username: user.username,
            timestamp: user.timestamp,
            isGuest: user.is_guest === true || user.is_guest === 'true'
        }));

        return res.status(200).json({
            success: true,
            online: formattedOnline
        });
    } catch (error) {
        console.error('Ошибка при получении онлайн пользователей:', error);
        return res.status(200).json({
            success: true,
            online: []
        });
    }
}

