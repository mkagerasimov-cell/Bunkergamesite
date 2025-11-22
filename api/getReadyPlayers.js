// Vercel Serverless Function для получения списка готовых игроков
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
                ready: []
            });
        }

        // Запрос к Supabase
        const response = await fetch(`${supabaseUrl}/rest/v1/ready_players?select=*&order=timestamp.desc`, {
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
                    ready: []
                });
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

        return res.status(200).json({
            success: true,
            ready: formattedReady
        });
    } catch (error) {
        console.error('Ошибка при получении готовых игроков:', error);
        return res.status(200).json({
            success: true,
            ready: []
        });
    }
}

