/**
 * Утилиты для работы с API Битрикс24, включая методы для пагинации и пакетных запросов.
 */

/**
 * Вызов метода API Битрикс24 с поддержкой Promise и автоматической пагинацией.
 * @param {Object} BX24 - Инициализированный объект BX24
 * @param {string} method - Имя метода API Битрикс24
 * @param {Object} params - Параметры для вызова метода
 * @param {boolean} useAutoPagination - Использовать ли автоматическую пагинацию для получения всех результатов
 * @returns {Promise<Array>} - Promise с результатами вызова метода
 */
export const callBX24Method = (
	BX24,
	method,
	params = {},
	useAutoPagination = true
) => {
	return new Promise((resolve, reject) => {
		if (!BX24) {
			return reject(new Error("BX24 объект не доступен."))
		}

		let allResults = []

		// Основной вызов метода через встроенный объект BX24
		BX24.callMethod(method, params, function handleResponse(response) {
			if (response.error()) {
				console.error(`Ошибка при вызове ${method}:`, response.error())
				return reject(
					new Error(
						response.error().error_description || "Ошибка API Битрикс24"
					)
				)
			}

			// Добавляем полученные данные к результатам
			const data = response.data()
			allResults = allResults.concat(Array.isArray(data) ? data : [data])

			// Проверяем, есть ли еще данные и нужна ли пагинация
			if (useAutoPagination && response.more()) {
				// Используем встроенный механизм next() для пагинации
				response.next()
			} else {
				// Возвращаем все собранные результаты
				resolve({
					data: allResults,
					total: response.total ? response.total() : allResults.length,
				})
			}
		})
	})
}

/**
 * Вызов метода API Битрикс24 с оптимизированной пагинацией через пакетные запросы.
 * Используется для методов, которые возвращают большие объемы данных.
 * @param {Object} BX24 - Инициализированный объект BX24
 * @param {string} method - Имя метода API Битрикс24
 * @param {Object} params - Параметры для вызова метода
 * @param {Function} onProgress - Опциональный колбэк для обработки данных по частям
 * @returns {Promise<Array>} - Promise с результатами вызова метода
 */
export const callBX24MethodBatch = async (
	BX24,
	method,
	params = {},
	onProgress = null
) => {
	try {
		// Первый запрос для получения общего количества элементов
		const initialResponse = await callBX24Method(BX24, method, params, false)

		const totalItems = initialResponse.total
		const initialData = initialResponse.data

		// Если данных нет, выходим
		if (totalItems === 0) {
			return []
		}

		// Если есть onProgress, сразу обрабатываем первую порцию
		if (onProgress) {
			await onProgress(initialData)
		}

		// Если все данные получены в первом запросе, возвращаем результат
		if (totalItems <= 50) {
			return initialData
		}

		const allResults = onProgress ? [] : [...initialData]
		const batchLimit = 50 // Лимит команд в одном пакете
		let batchRequests = {}
		let commandCounter = 0

		// Генерируем и выполняем запросы чанками, не превышая лимит
		for (let start = 50; start < totalItems; start += 50) {
			const batchParams = { ...params, start }
			const batchKey = `${method}_${start}`
			batchRequests[batchKey] = { method, params: batchParams }
			commandCounter++

			// Выполняем чанк, если достигли лимита или это последняя итерация
			if (commandCounter === batchLimit || start + 50 >= totalItems) {
				const batchResults = await executeBatchRequest(BX24, batchRequests)

				if (onProgress) {
					// Обрабатываем каждый результат из пакета индивидуально
					for (const key in batchResults) {
						const resultData = batchResults[key]
						if (Array.isArray(resultData) && resultData.length > 0) {
							await onProgress(resultData)
						}
					}
				} else {
					// Собираем все результаты, если onProgress не предоставлен
					const chunkData = []
					Object.values(batchResults).forEach(result => {
						if (Array.isArray(result)) {
							chunkData.push(...result)
						}
					})
					allResults.push(...chunkData)
				}

				// Сбрасываем счетчик и объект для следующего чанка
				batchRequests = {}
				commandCounter = 0
			}
		}

		return allResults
	} catch (error) {
		console.error(`Ошибка при вызове ${method} с пакетными запросами:`, error)
		throw error
	}
}

/**
 * Выполняет пакетный запрос к API Битрикс24.
 * @param {Object} BX24 - Инициализированный объект BX24
 * @param {Object} batch - Объект с пакетными запросами
 * @returns {Promise<Object>} - Promise с результатами пакетного запроса
 */
export const executeBatchRequest = (BX24, batch) => {
	return new Promise((resolve, reject) => {
		// Используем встроенный метод BX24.callBatch
		BX24.callBatch(
			batch,
			response => {
				try {
					const results = {}

					// Обрабатываем каждый ответ в пакете
					Object.entries(response).forEach(([key, result]) => {
						if (result.error && result.error()) {
							console.warn(
								`Ошибка в пакетном запросе ${key}:`,
								JSON.stringify(result.error(), null, 2)
							)
							results[key] = []
						} else {
							results[key] = result.data()
						}
					})

					resolve(results)
				} catch (error) {
					console.error("Ошибка при обработке пакетного запроса:", error)
					reject(error)
				}
			},
			false // halt_on_error = false
		)
	})
}

/**
 * Выполняет запрос сущности из Битрикс24.
 * @param {Object} BX24 - Инициализированный объект BX24
 * @param {string} entityType - Тип сущности (crm.company.list, crm.deal.list, department.get, etc.)
 * @param {Object} options - Опции запроса (select, filter, order)
 * @returns {Promise<Array>} - Promise с результатами запроса
 */
export const fetchEntities = async (BX24, entityType, options = {}) => {
	const {
		select = [],
		filter = {},
		order = {},
		useBatch = true,
		onProgress = null,
	} = options

	const params = {
		select,
		filter,
		order,
	}

	// Для методов, которые не заканчиваются на .list, используем прямой вызов
	const methodHasList = entityType.endsWith(".list")
	const method = methodHasList ? entityType : entityType

	// Для больших выборок используем пакетные запросы только для методов с .list
	if (useBatch && methodHasList) {
		try {
			return await callBX24MethodBatch(BX24, method, params, onProgress)
		} catch (error) {
			console.warn(
				`Ошибка при использовании пакетных запросов, переключаемся на обычный запрос: ${error.message}`
			)
			const result = await callBX24Method(BX24, method, params)
			return result.data
		}
	} else {
		const result = await callBX24Method(BX24, method, params)
		return result.data
	}
}

/**
 * Получает связанные сущности по родительской сущности.
 * Например, получение сделок для конкретной компании.
 * @param {Object} BX24 - Инициализированный объект BX24
 * @param {string} entityType - Тип сущности (crm.deal, etc.)
 * @param {string} parentField - Поле связи с родительской сущностью (COMPANY_ID, etc.)
 * @param {string} parentId - ID родительской сущности
 * @param {Object} options - Дополнительные опции запроса
 * @returns {Promise<Array>} - Promise с результатами запроса
 */
export const fetchRelatedEntities = async (
	BX24,
	entityType,
	parentField,
	parentId,
	options = {}
) => {
	const { select = [], filter = {}, order = {}, useBatch = true } = options

	// Добавляем фильтр по родительской сущности
	const entityFilter = {
		...filter,
		[parentField]: parentId,
	}

	return fetchEntities(BX24, entityType, {
		select,
		filter: entityFilter,
		order,
		useBatch,
	})
}

/**
 * Получает связанные сущности для нескольких родительских сущностей с помощью пакетных запросов.
 * @param {Object} BX24 - Инициализированный объект BX24
 * @param {string} entityType - Тип сущности для получения (e.g., 'crm.deal.list')
 * @param {string} parentField - Поле для фильтрации (e.g., 'COMPANY_ID')
 * @param {Array<string>} parentIds - Массив ID родительских сущностей
 * @param {Object} options - Дополнительные параметры (select, filter, etc.)
 * @returns {Promise<Object>} - Promise с объектом, где ключи - parentId, значения - массив сущностей
 */
export const fetchRelatedEntitiesForMultiple = async (
	BX24,
	entityType,
	parentField,
	parentIds,
	options = {}
) => {
	const { select = ["ID"], filter = {}, order = {} } = options
	const batchRequests = {}
	const results = {}

	parentIds.forEach(id => {
		// Создаем уникальный ключ для каждого запроса
		const commandKey = `fetch_${entityType}_for_${id}`

		// Определяем параметры для каждого запроса в пакете
		batchRequests[commandKey] = {
			method: entityType,
			params: {
				filter: { ...filter, [parentField]: id },
				select,
				order,
			},
		}
	})

	try {
		// Выполняем пакетный запрос
		const batchResults = await executeBatchRequest(BX24, batchRequests)

		// Обрабатываем результаты и сопоставляем их с parentId
		Object.keys(batchRequests).forEach(commandKey => {
			const parentId = commandKey.split("_for_")[1] // Извлекаем parentId из ключа
			if (batchResults[commandKey]) {
				results[parentId] = batchResults[commandKey]
			}
		})

		return results
	} catch (error) {
		console.error("Ошибка при выполнении пакетного запроса:", error)
		throw error
	}
}
