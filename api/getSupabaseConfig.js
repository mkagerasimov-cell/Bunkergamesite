// Vercel Serverless Function для получения публичной конфигурации Supabase
// Возвращает только публичные ключи, безопасные для использования на клиенте
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
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            return res.status(500).json({
                success: false,
                error: 'Supabase не настроен'
            });
        }

        // Возвращаем только публичные ключи (безопасные для клиента)
        return res.status(200).json({
            success: true,
            url: supabaseUrl,
            anonKey: supabaseAnonKey
        });
    } catch (error) {
        console.error('Ошибка при получении конфигурации Supabase:', error);
        return res.status(500).json({
            success: false,
            error: 'Ошибка сервера: ' + error.message
        });
    }
}

