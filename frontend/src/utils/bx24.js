/**
 * Загружает и инициализирует объект BX24 для взаимодействия с API Битрикс24.
 */

// Флаг, чтобы избежать повторной загрузки скрипта
let isBx24ScriptLoading = false

/**
 * Динамически загружает скрипт api.js из Битрикс24.
 * @returns {Promise<void>}
 */
const loadBx24Script = () => {
	return new Promise((resolve, reject) => {
		// Проверяем, существует ли уже скрипт на странице
		if (document.getElementById("bx24-api-script")) {
			return resolve()
		}

		const script = document.createElement("script")
		script.id = "bx24-api-script"
		script.src = "//api.bitrix24.com/api/v1/"
		script.async = true

		script.onload = () => {
			console.log("BX24 API script loaded successfully.")
			resolve()
		}

		script.onerror = () => {
			console.error("Failed to load BX24 API script.")
			reject(new Error("Не удалось загрузить скрипт BX24 API."))
		}

		document.head.appendChild(script)
	})
}

/**
 * Инициализирует BX24 и возвращает Promise с объектом BX24.
 * @returns {Promise<object>} - Promise, который разрешается с объектом BX24.
 */
export const initBX24 = () => {
	return new Promise(async (resolve, reject) => {
		try {
			// Если скрипт еще не загружается, загружаем его
			if (!isBx24ScriptLoading) {
				isBx24ScriptLoading = true
				await loadBx24Script()
			}

			// Проверяем, доступен ли BX24 в window
			if (window.BX24) {
				// Инициализируем BX24
				window.BX24.init(function () {
					console.log("BX24 initialized.")
					resolve(window.BX24)
				})
			} else {
				// Эта ситуация маловероятна, если скрипт загрузился успешно
				reject(new Error("Объект BX24 не найден после загрузки скрипта."))
			}
		} catch (error) {
			console.error("Error initializing BX24:", error)
			// Если мы здесь, значит, мы не в iframe Битрикс24
			// и не можем работать с реальным API.
			reject(
				new Error(
					"Не удалось инициализировать BX24. Убедитесь, что приложение запущено в iframe Битрикс24."
				)
			)
		}
	})
}
