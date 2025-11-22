// Vercel Serverless Function для сохранения/удаления готового игрока
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
        const { action, player } = req.body;

        console.log('Получен запрос saveReadyPlayer:', { action, player });

        if (!action) {
            return res.status(400).json({
                success: false,
                error: 'Не указано действие (action)'
            });
        }

        if (action !== 'clear' && !player) {
            return res.status(400).json({
                success: false,
                error: 'Не указан игрок (player)'
            });
        }

        if (action === 'add') {
            if (!player.username) {
                return res.status(400).json({
                    success: false,
                    error: 'Не указано имя игрока'
                });
            }
            
            // Преобразуем timestamp в ISO строку, если это число
            let timestampValue;
            if (player.timestamp) {
                if (typeof player.timestamp === 'number') {
                    timestampValue = new Date(player.timestamp).toISOString();
                } else {
                    timestampValue = player.timestamp;
                }
            } else {
                timestampValue = new Date().toISOString();
            }
            
            const playerData = {
                username: player.username,
                timestamp: timestampValue,
                role_mode: player.roleMode || null,
                is_admin: player.isAdmin || false
            };
            
            console.log('Добавление готового игрока:', playerData);

            // Проверяем, есть ли уже такой игрок
            const checkResponse = await fetch(`${supabaseUrl}/rest/v1/ready_players?username=eq.${encodeURIComponent(player.username)}&select=username`, {
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
                    // Обновляем существующую запись
                    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/ready_players?username=eq.${encodeURIComponent(player.username)}`, {
                        method: 'PATCH',
                        headers: {
                            'apikey': supabaseServiceKey,
                            'Authorization': `Bearer ${supabaseServiceKey}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify(playerData)
                    });

                    if (!updateResponse.ok) {
                        const errorText = await updateResponse.text();
                        throw new Error(`Supabase error: ${updateResponse.status} ${errorText}`);
                    }

                    return res.status(200).json({
                        success: true,
                        message: 'Готовый игрок обновлен'
                    });
                }
            }

            // Создаем новую запись
            console.log('Создание новой записи готового игрока:', playerData);
            const insertResponse = await fetch(`${supabaseUrl}/rest/v1/ready_players`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(playerData)
            });

            if (!insertResponse.ok) {
                const errorText = await insertResponse.text();
                console.error('Ошибка при создании записи:', errorText);
                throw new Error(`Supabase error: ${insertResponse.status} ${errorText}`);
            }

            const insertedData = await insertResponse.json();
            console.log('Готовый игрок успешно добавлен в Supabase:', insertedData);

            return res.status(200).json({
                success: true,
                message: 'Готовый игрок добавлен',
                data: insertedData
            });

        } else if (action === 'remove') {
            const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/ready_players?username=eq.${encodeURIComponent(player.username)}`, {
                method: 'DELETE',
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!deleteResponse.ok && deleteResponse.status !== 404) {
                const errorText = await deleteResponse.text();
                throw new Error(`Supabase error: ${deleteResponse.status} ${errorText}`);
            }

            return res.status(200).json({
                success: true,
                message: 'Готовый игрок удален'
            });

        } else if (action === 'clear') {
            const deleteAllResponse = await fetch(`${supabaseUrl}/rest/v1/ready_players`, {
                method: 'DELETE',
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!deleteAllResponse.ok && deleteAllResponse.status !== 404) {
                const errorText = await deleteAllResponse.text();
                throw new Error(`Supabase error: ${deleteAllResponse.status} ${errorText}`);
            }

            return res.status(200).json({
                success: true,
                message: 'Все готовые игроки удалены'
            });

        } else {
            return res.status(400).json({
                success: false,
                error: 'Неизвестное действие. Используйте: add, remove или clear'
            });
        }

    } catch (error) {
        console.error('Ошибка при сохранении готового игрока:', error);
        return res.status(500).json({
            success: false,
            error: 'Ошибка сервера: ' + error.message
        });
    }
}

