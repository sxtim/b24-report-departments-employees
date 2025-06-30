<template>
	<v-card>
		<v-card-title class="pb-4 d-flex align-center">
			Отчет по отделам/сотрудникам
			<v-icon class="ml-2" size="small" @click="faqDialog = true">
				mdi-information-outline
			</v-icon>
		</v-card-title>
		<v-card-text>
			<!-- Filters -->
			<v-row align="center">
				<v-col cols="12" sm="6" md="4">
					<v-select
						label="Режим отчета"
						:items="reportModes"
						v-model="selectedReportMode"
						item-title="title"
						item-value="value"
						variant="outlined"
						density="comfortable"
					></v-select>
				</v-col>
				<v-col cols="12" sm="6" md="4">
					<v-select
						label="Статус сделки"
						:items="dealStatusItems"
						v-model="selectedDealStatus"
						item-title="title"
						item-value="value"
						variant="outlined"
						density="comfortable"
						clearable
						persistent-hint
					></v-select>
				</v-col>

				<v-col cols="12" sm="12" md="4">
					<v-menu
						v-model="dateMenu"
						:close-on-content-click="false"
						transition="scale-transition"
						min-width="auto"
						max-width="360px"
						@update:model-value="onDateMenuToggle"
					>
						<template v-slot:activator="{ props }">
							<v-text-field
								v-bind="props"
								:model-value="formattedDateRange"
								label="Период"
								prepend-inner-icon="mdi-calendar"
								readonly
								clearable
								@click:clear="clearDateRange"
								class="date-picker-field"
							></v-text-field>
						</template>
						<v-card
							style="width: 100%; max-width: 360px; box-sizing: border-box"
						>
							<v-card-text>
								<v-date-picker
									v-model="tempDateRange"
									multiple="range"
									color="primary"
									show-adjacent-months
									:first-day-of-week="1"
									hide-header
									locale="ru"
									:day-format="date => new Date(date).getDate()"
									style="width: 100%; max-width: 360px; box-sizing: border-box"
								></v-date-picker>
							</v-card-text>
							<v-card-actions>
								<v-spacer></v-spacer>
								<v-btn variant="text" @click="dateMenu = false"> Отмена </v-btn>
								<v-btn color="primary" variant="text" @click="applyDateRange">
									Применить
								</v-btn>
							</v-card-actions>
						</v-card>
					</v-menu>
				</v-col>
			</v-row>

			<!-- Фильтр по отделу/сотруднику на отдельной строке -->
			<v-row align="center" class="mt-2">
				<v-col cols="12" v-if="selectedReportMode === 'departments'">
					<v-autocomplete
						label="Отдел"
						:items="departmentFilterItems"
						v-model="selectedDepartmentIds"
						item-title="title"
						item-value="value"
						multiple
						clearable
						chips
						closable-chips
						variant="outlined"
						density="comfortable"
					>
						<template v-slot:item="{ props, item }">
							<v-list-item v-bind="props" :title="item.raw.title">
								<template v-slot:prepend>
									<v-checkbox-btn
										:model-value="
											selectedDepartmentIds.includes(item.raw.value)
										"
									></v-checkbox-btn>
								</template>
							</v-list-item>
						</template>
					</v-autocomplete>
				</v-col>
				<v-col cols="12" v-if="selectedReportMode === 'employees'">
					<v-autocomplete
						label="Сотрудник"
						:items="employeeFilterItems"
						v-model="selectedEmployeeIds"
						item-title="title"
						item-value="value"
						multiple
						clearable
						chips
						closable-chips
						variant="outlined"
						density="comfortable"
					>
						<template v-slot:item="{ props, item }">
							<v-list-item v-bind="props" :title="item.raw.title">
								<template v-slot:prepend>
									<v-checkbox-btn
										:model-value="selectedEmployeeIds.includes(item.raw.value)"
									></v-checkbox-btn>
								</template>
							</v-list-item>
						</template>
					</v-autocomplete>
				</v-col>
			</v-row>

			<!-- Отчет в зависимости от выбранного режима -->
			<DepartmentReport
				v-if="selectedReportMode === 'departments'"
				:filters="filters"
				:loading="loading"
			/>
			<EmployeeReport v-else :filters="filters" :loading="loading" />
		</v-card-text>

		<v-alert v-if="error" type="error" dense>
			{{ error }}
		</v-alert>

		<v-dialog v-model="faqDialog" max-width="600px">
			<v-card>
				<v-card-title>
					<span class="text-h5">Справка по работе с отчетом</span>
				</v-card-title>
				<v-card-text>
					<p>
						Это приложение предназначено для формирования отчетов по сделкам
						сотрудников и отделов.
					</p>
					<br />
					<p><strong>Показатели:</strong></p>
					<ul>
						<li>
							<strong>Отдел/Сотрудник:</strong> Название отдела или ФИО
							сотрудника.
						</li>
						<li>
							<strong>Кол-во сделок в работе:</strong> Число сделок, которые
							находятся в процессе.
						</li>
						<li>
							<strong>Кол-во заключенных сделок:</strong> Число успешно закрытых
							сделок.
						</li>
						<li>
							<strong>Кол-во проваленных сделок:</strong> Число сделок, которые
							были закрыты как проваленные.
						</li>
					</ul>
					<br />
					<p><strong>Фильтры:</strong></p>
					<ul>
						<li>
							<strong>Режим отчета:</strong> Выберите режим отображения - по
							отделам или по сотрудникам.
						</li>
						<li v-if="selectedReportMode === 'departments'">
							<strong>Отдел:</strong> Выберите один или несколько отделов для
							фильтрации данных. Если не выбрано ни одного отдела, будут
							показаны все отделы. Этот фильтр доступен только в режиме "По
							отделам".
						</li>
						<li v-if="selectedReportMode === 'employees'">
							<strong>Сотрудник:</strong> Выберите одного или нескольких
							сотрудников для фильтрации данных. Если не выбрано ни одного
							сотрудника, будут показаны все сотрудники. Этот фильтр доступен
							только в режиме "По сотрудникам".
						</li>
						<li>
							<strong>Статус сделки:</strong> Основной фильтр по статусу сделки.
							Позволяет отобразить только сделки определенного статуса (в
							работе, заключенные или проваленные).
						</li>
						<li v-if="selectedReportMode === 'departments'">
							<strong>Дополнительный фильтр по статусу:</strong> Работает
							аналогично основному фильтру, но доступен только в режиме "По
							отделам". Позволяет применять отдельный фильтр статуса для
							отделов.
						</li>
						<li>
							<strong>Период:</strong> Укажите диапазон дат создания сделок.
						</li>
					</ul>
					<br />
					<p><strong>Интерактивные элементы:</strong></p>
					<ul>
						<li>
							<strong>Название отдела/ФИО сотрудника:</strong> Клик по названию
							отдела или ФИО сотрудника откроет соответствующую карточку в
							Битрикс24.
						</li>
						<li>
							<strong>Количество сделок:</strong> Клик по числу в столбцах с
							количеством сделок откроет детальное окно со списком этих сделок.
						</li>
					</ul>
					<br />
					<p>
						Отчет обновляется автоматически при изменении любого из фильтров.
					</p>
				</v-card-text>
				<v-card-actions>
					<v-spacer></v-spacer>
					<v-btn color="primary" text @click="faqDialog = false">Закрыть</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</v-card>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from "vue"
import { fetchEntities } from "../utils/bx24Api"
import DepartmentReport from "./reports/DepartmentReport.vue"
import EmployeeReport from "./reports/EmployeeReport.vue"

// --- Helper Functions ---
const formatDate = dateString => {
	const date = new Date(dateString)
	return date.toLocaleDateString("ru-RU", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	})
}

// --- State ---
const loading = ref(false)
const error = ref(null)
const BX24 = inject("BX24")

// Filters
const selectedReportMode = ref("departments") // departments или employees
const selectedDepartmentIds = ref([])
const selectedEmployeeIds = ref([]) // Новое состояние для хранения выбранных сотрудников
const selectedDealStatus = ref(null)
const departmentStatusFilter = ref(null) // Новый фильтр статуса для режима "По отделам"
const dateRange = ref([])
const tempDateRange = ref([])
const dateMenu = ref(false)
const faqDialog = ref(false)

// Данные для фильтров
const allDepartments = ref([])
const allEmployees = ref([]) // Новое состояние для хранения всех сотрудников

const departmentFilterItems = computed(() => {
	return allDepartments.value.map(dept => ({
		title: dept.NAME,
		value: dept.ID,
	}))
})

// Новый computed для элементов фильтра сотрудников
const employeeFilterItems = computed(() => {
	return allEmployees.value.map(employee => ({
		title: `${employee.NAME} ${employee.LAST_NAME}`,
		value: employee.ID,
	}))
})

// Опции для селектов
const reportModes = [
	{ title: "По отделам", value: "departments" },
	{ title: "По сотрудникам", value: "employees" },
]

const dealStatusItems = [
	{ title: "Все", value: null },
	{ title: "В работе", value: "IN_PROCESS" },
	{ title: "Успешно завершены", value: "WON" },
	{ title: "Провалены", value: "LOSE" },
]

// Следим за изменением режима отчета
watch(selectedReportMode, newMode => {
	// При переключении режима отчета сбрасываем фильтры
	selectedDepartmentIds.value = []
	selectedEmployeeIds.value = [] // Сбрасываем выбранных сотрудников
	selectedDealStatus.value = null
	departmentStatusFilter.value = null
	dateRange.value = []
})

const onDateMenuToggle = isOpen => {
	if (isOpen) {
		// Clone the array to avoid reactivity issues
		tempDateRange.value = [...dateRange.value]
	}
}

const applyDateRange = () => {
	dateRange.value = [...tempDateRange.value]
	dateMenu.value = false
}

// Форматирование диапазона дат для отображения
const formattedDateRange = computed(() => {
	if (!dateRange.value || dateRange.value.length === 0) {
		return ""
	}

	if (dateRange.value.length === 1) {
		return formatDate(dateRange.value[0])
	}
	return `${formatDate(dateRange.value[0])} — ${formatDate(
		dateRange.value[dateRange.value.length - 1]
	)}`
})

// Общие фильтры для передачи в дочерние компоненты
const filters = computed(() => {
	const filterObj = {}

	// Добавляем общий статус сделки или статус для режима по отделам, если он выбран
	if (
		selectedReportMode.value === "departments" &&
		departmentStatusFilter.value
	) {
		filterObj.STATUS_ID = departmentStatusFilter.value
	} else if (selectedDealStatus.value) {
		filterObj.STATUS_ID = selectedDealStatus.value
	}

	// Добавляем фильтр по отделам только для режима по отделам
	if (
		selectedReportMode.value === "departments" &&
		selectedDepartmentIds.value &&
		selectedDepartmentIds.value.length > 0
	) {
		filterObj.DEPARTMENT_ID = selectedDepartmentIds.value
	}

	// Добавляем фильтр по сотрудникам только для режима по сотрудникам
	// Используем ASSIGNED_BY_ID для фильтрации сделок по ответственным сотрудникам
	if (
		selectedReportMode.value === "employees" &&
		selectedEmployeeIds.value &&
		selectedEmployeeIds.value.length > 0
	) {
		filterObj.ASSIGNED_BY_ID = selectedEmployeeIds.value
	}

	if (dateRange.value && dateRange.value.length > 0) {
		// Для диапазона дат
		if (dateRange.value.length > 1) {
			const startDate = new Date(dateRange.value[0])
			startDate.setHours(0, 0, 0, 0)

			const endDate = new Date(dateRange.value[dateRange.value.length - 1])
			endDate.setHours(23, 59, 59, 999)

			filterObj[">=DATE_CREATE"] = startDate.toISOString()
			filterObj["<=DATE_CREATE"] = endDate.toISOString()
		}
		// Для одной даты
		else {
			const singleDate = new Date(dateRange.value[0])
			const startOfDay = new Date(singleDate)
			startOfDay.setHours(0, 0, 0, 0)
			const endOfDay = new Date(singleDate)
			endOfDay.setHours(23, 59, 59, 999)

			filterObj[">=DATE_CREATE"] = startOfDay.toISOString()
			filterObj["<=DATE_CREATE"] = endOfDay.toISOString()
		}
	}

	return filterObj
})

// Загрузка данных отделов и сотрудников при монтировании компонента
const loadDepartments = async () => {
	try {
		loading.value = true
		const departments = await fetchEntities(BX24, "department.get", {
			select: ["ID", "NAME"],
		})
		allDepartments.value = departments
	} catch (err) {
		console.error("Ошибка при загрузке отделов:", err)
		error.value = "Не удалось загрузить список отделов"
	} finally {
		loading.value = false
	}
}

// Новая функция для загрузки сотрудников
const loadEmployees = async () => {
	try {
		loading.value = true
		const employees = await fetchEntities(BX24, "user.get", {
			select: ["ID", "NAME", "LAST_NAME", "UF_DEPARTMENT"],
		})
		allEmployees.value = employees
	} catch (err) {
		console.error("Ошибка при загрузке сотрудников:", err)
		error.value = "Не удалось загрузить список сотрудников"
	} finally {
		loading.value = false
	}
}

// Загрузка данных при монтировании компонента
onMounted(() => {
	loadDepartments()
	loadEmployees() // Добавляем загрузку сотрудников
})

const clearDateRange = () => {
	dateRange.value = []
}
</script>

<style>
.date-picker-field {
	max-width: 360px;
}
.v-input__control {
}
</style>
