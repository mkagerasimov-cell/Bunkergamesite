// Vercel Serverless Function для сохранения онлайн пользователя
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

        if (!supabaseUrl || !supabaseServiceKey) {
            return res.status(200).json({
                success: true,
                message: 'Supabase не настроен, используется localStorage'
            });
        }

        // Получаем данные из тела запроса
        const { username, isGuest } = req.body;

        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Не указано имя пользователя'
            });
        }

        const userData = {
            username: username,
            timestamp: new Date().toISOString(),
            is_guest: isGuest || false
        };

        // Проверяем, есть ли уже такой пользователь
        const checkResponse = await fetch(`${supabaseUrl}/rest/v1/online_users?username=eq.${encodeURIComponent(username)}&select=username`, {
            method: 'GET',
            headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (checkResponse.ok) {
            const existing = await checkResponse.json();
            // Supabase возвращает массив, даже если записей нет
            if (Array.isArray(existing) && existing.length > 0) {
                // Обновляем существующую запись
                const updateResponse = await fetch(`${supabaseUrl}/rest/v1/online_users?username=eq.${encodeURIComponent(username)}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseServiceKey,
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        timestamp: userData.timestamp
                    })
                });

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    throw new Error(`Supabase error: ${updateResponse.status} ${errorText}`);
                }

                return res.status(200).json({
                    success: true,
                    message: 'Онлайн пользователь обновлен'
                });
            }
        }

        // Создаем новую запись
        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/online_users`, {
            method: 'POST',
            headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(userData)
        });

        if (!insertResponse.ok) {
            const errorText = await insertResponse.text();
            throw new Error(`Supabase error: ${insertResponse.status} ${errorText}`);
        }

        return res.status(200).json({
            success: true,
            message: 'Онлайн пользователь добавлен'
        });

    } catch (error) {
        console.error('Ошибка при сохранении онлайн пользователя:', error);
        return res.status(500).json({
            success: false,
            error: 'Ошибка сервера: ' + error.message
        });
    }
}

