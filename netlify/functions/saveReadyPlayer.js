// Netlify Function для сохранения/удаления готового игрока
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
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            // Если Supabase не настроен, возвращаем успех (fallback на localStorage)
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Supabase не настроен, используется localStorage'
                })
            };
        }

        // Парсим тело запроса
        const data = JSON.parse(event.body);
        const { action, player } = data;

        if (!action || !player) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Не указаны action или player'
                })
            };
        }

        if (action === 'add') {
            // Добавляем готового игрока
            if (!player || !player.username) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Не указано имя игрока'
                    })
                };
            }
            
            const playerData = {
                username: player.username,
                timestamp: player.timestamp ? new Date(player.timestamp).toISOString() : new Date().toISOString(),
                role_mode: player.roleMode || null,
                is_admin: player.isAdmin || false
            };
            
            console.log('Добавление готового игрока:', playerData);

            // Сначала проверяем, есть ли уже такой игрок
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

                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            message: 'Готовый игрок обновлен'
                        })
                    };
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

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Готовый игрок добавлен',
                    data: insertedData
                })
            };

        } else if (action === 'remove') {
            // Удаляем готового игрока
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

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Готовый игрок удален'
                })
            };

        } else if (action === 'clear') {
            // Очищаем всех готовых игроков
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

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Все готовые игроки удалены'
                })
            };

        } else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Неизвестное действие. Используйте: add, remove или clear'
                })
            };
        }

    } catch (error) {
        console.error('Ошибка при сохранении готового игрока:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Ошибка сервера: ' + error.message
            })
        };
    }
};

