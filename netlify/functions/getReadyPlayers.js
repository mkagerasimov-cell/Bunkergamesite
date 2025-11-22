// Netlify Function для получения списка готовых игроков
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
            // Если Supabase не настроен, возвращаем пустой массив
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    ready: []
                })
            };
        }

        // Запрос к Supabase - получаем готовых игроков
        // Используем таблицу ready_players или game_state
        // Для простоты используем таблицу ready_players
        const response = await fetch(`${supabaseUrl}/rest/v1/ready_players?select=*&order=timestamp.desc`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            // Если таблицы нет, возвращаем пустой массив
            if (response.status === 404 || response.status === 400) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        ready: []
                    })
                };
            }
            const errorText = await response.text();
            throw new Error(`Supabase error: ${response.status} ${errorText}`);
        }

        const readyPlayers = await response.json();

        // Преобразуем формат данных
        const formattedReady = readyPlayers.map(player => ({
            username: player.username,
            timestamp: player.timestamp,
            roleMode: player.role_mode || null,
            isAdmin: player.is_admin || false
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                ready: formattedReady
            })
        };
    } catch (error) {
        console.error('Ошибка при получении готовых игроков:', error);
        // В случае ошибки возвращаем пустой массив
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                ready: []
            })
        };
    }
};

