<template>
	<div>
		<v-data-table
			v-model:items-per-page="itemsPerPage"
			v-model:page="currentPage"
			:headers="headers"
			:items="departmentData"
			:loading="isLoading"
			class="elevation-1"
			item-value="id"
			:items-per-page-options="itemsPerPageOptions"
			hide-default-footer
			hover
		>
			<template v-slot:item.department="{ item }">
				{{ item.department }}
			</template>
			<template v-slot:item.inProcessCount="{ item }">
				<a
					href="#"
					@click.prevent="showDealsModal(item, 'IN_PROCESS')"
					v-if="item.inProcessCount > 0"
					:class="{
						'department-link': true,
						'highlighted-count':
							isStatusFiltered('IN_PROCESS') && item.filteredInProcessCount > 0,
					}"
				>
					{{
						isStatusFiltered("IN_PROCESS")
							? item.filteredInProcessCount
							: item.inProcessCount
					}}
				</a>
				<span v-else>0</span>
			</template>
			<template v-slot:item.wonCount="{ item }">
				<a
					href="#"
					@click.prevent="showDealsModal(item, 'WON')"
					v-if="item.wonCount > 0"
					:class="{
						'department-link': true,
						'highlighted-count':
							isStatusFiltered('WON') && item.filteredWonCount > 0,
					}"
				>
					{{ isStatusFiltered("WON") ? item.filteredWonCount : item.wonCount }}
				</a>
				<span v-else>0</span>
			</template>
			<template v-slot:item.loseCount="{ item }">
				<a
					href="#"
					@click.prevent="showDealsModal(item, 'LOSE')"
					v-if="item.loseCount > 0"
					:class="{
						'department-link': true,
						'highlighted-count':
							isStatusFiltered('LOSE') && item.filteredLoseCount > 0,
					}"
				>
					{{
						isStatusFiltered("LOSE") ? item.filteredLoseCount : item.loseCount
					}}
				</a>
				<span v-else>0</span>
			</template>
			<template v-slot:loading>
				<v-skeleton-loader type="table-row@5"></v-skeleton-loader>
			</template>

			<template v-slot:bottom>
				<div class="d-flex align-center pa-2 pagination-controls">
					<div class="text-caption">Всего: {{ departmentData.length }}</div>
					<v-spacer></v-spacer>
					<div class="d-flex align-center">
						<span class="text-caption mr-2">Строк на странице:</span>
						<v-select
							v-model="itemsPerPage"
							:items="itemsPerPageOptions"
							density="compact"
							variant="outlined"
							hide-details
							style="max-width: 100px"
							class="mr-4"
						></v-select>
						<v-pagination
							v-model="currentPage"
							:length="pageCount"
							:total-visible="7"
						></v-pagination>
					</div>
				</div>
			</template>
		</v-data-table>

		<!-- Summary Information -->
		<v-card-text class="pa-2 mt-4">
			<v-row justify="end" class="font-weight-bold">
				<v-col cols="auto">Общий итог:</v-col>
				<v-col cols="auto">В работе: {{ totalInProcess }}</v-col>
				<v-col cols="auto">Заключенные: {{ totalWon }}</v-col>
				<v-col cols="auto">Проваленные: {{ totalLose }}</v-col>
			</v-row>
		</v-card-text>

		<!-- Deals Modal -->
		<v-dialog v-model="dealsModalVisible" max-width="900px">
			<v-card>
				<v-card-title>
					<span class="text-h5" :class="modalTitleClass">{{ modalTitle }}</span>
				</v-card-title>
				<v-card-text>
					<v-data-table
						:headers="dealsHeaders"
						:items="selectedDepartmentDeals"
						class="elevation-1"
						item-value="id"
						hover
					>
						<template v-slot:item.title="{ item }">
							<a
								href="#"
								@click.prevent="openDealCard(item.id)"
								class="department-link"
							>
								{{ item.title }}
							</a>
						</template>
						<template v-slot:item.opportunity="{ item }">
							{{ formatCurrency(item.opportunity) }}
						</template>
						<template v-slot:item.manager="{ item }">
							{{ item.manager }}
						</template>
					</v-data-table>
				</v-card-text>
				<v-card-actions>
					<v-spacer></v-spacer>
					<v-btn color="primary" text @click="dealsModalVisible = false"
						>Закрыть</v-btn
					>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script setup>
import { computed, inject, ref, watch } from "vue"
import { fetchEntities } from "../../utils/bx24Api"

const props = defineProps({
	filters: {
		type: Object,
		default: () => ({}),
	},
	loading: {
		type: Boolean,
		default: false,
	},
})

// BX24 API
const BX24 = inject("BX24")

// Table state
const itemsPerPage = ref(10)
const currentPage = ref(1)
const itemsPerPageOptions = [
	{ value: 10, title: "10" },
	{ value: 25, title: "25" },
	{ value: 50, title: "50" },
]
const isLoading = ref(false)
const departmentData = ref([])
const dealsByDepartment = ref({})
const users = ref({}) // To store manager names

// Modal state
const dealsModalVisible = ref(false)
const selectedDepartmentDeals = ref([])
const modalTitle = ref("")
const modalTitleClass = ref("")
const dealsHeaders = [
	{ title: "Название сделки", key: "title", sortable: true },
	{ title: "Сумма", key: "opportunity", sortable: true },
	{ title: "Ответственный", key: "manager", sortable: true },
]

// Pagination computed property
const pageCount = computed(() => {
	return Math.ceil(departmentData.value.length / itemsPerPage.value)
})

// Columns for data table
const headers = ref([
	{
		title: "Отдел",
		key: "department",
		align: "start",
		sortable: true,
	},
	{
		title: "В работе",
		key: "inProcessCount",
		align: "center",
		sortable: true,
	},
	{
		title: "Заключенные",
		key: "wonCount",
		align: "center",
		sortable: true,
		width: "120px",
	},
	{
		title: "Проваленные",
		key: "loseCount",
		align: "center",
		sortable: true,
		width: "120px",
	},
])

// Helper function to format currency
const formatCurrency = amount => {
	return new Intl.NumberFormat("ru-RU", {
		style: "currency",
		currency: "RUB",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount)
}

// Total metrics
const totalInProcess = computed(() => {
	return departmentData.value.reduce(
		(sum, department) => sum + department.inProcessCount,
		0
	)
})

const totalWon = computed(() => {
	return departmentData.value.reduce(
		(sum, department) => sum + department.wonCount,
		0
	)
})

const totalLose = computed(() => {
	return departmentData.value.reduce(
		(sum, department) => sum + department.loseCount,
		0
	)
})

// Open department card in Bitrix24
const openDepartmentCard = departmentId => {
	if (BX24) {
		BX24.openPath(
			`/company/structure.php?set_filter_structure=Y&structure_UF_DEPARTMENT=${departmentId}`
		)
	}
}

// Open deal card in Bitrix24
const openDealCard = dealId => {
	if (BX24) {
		BX24.openPath(`/crm/deal/details/${dealId}/`)
	}
}

// Show deals modal for a specific department
const showDealsModal = (department, status) => {
	const statusTitles = {
		IN_PROCESS: "в работе",
		WON: "заключенные",
		LOSE: "проваленные",
	}

	const statusClasses = {
		IN_PROCESS: "text-primary",
		WON: "text-success",
		LOSE: "text-error",
	}

	modalTitle.value = `${department.department}: ${statusTitles[status]} сделки`
	modalTitleClass.value = statusClasses[status]

	// Фильтруем сделки по выбранному статусу
	if (dealsByDepartment.value[department.departmentId]) {
		// Показываем все сделки соответствующие статусу, независимо от фильтра
		selectedDepartmentDeals.value = dealsByDepartment.value[
			department.departmentId
		].filter(deal => deal.stageId === status)
	} else {
		selectedDepartmentDeals.value = []
	}

	dealsModalVisible.value = true
}

// Проверка, есть ли фильтрация по определенному статусу
const isStatusFiltered = status => {
	return props.filters && props.filters.STATUS_ID === status
}

// Load department and deal data
const loadData = async () => {
	isLoading.value = true

	try {
		// Загрузка отделов
		const departments = await fetchEntities(BX24, "department.get", {
			select: ["ID", "NAME"],
		})

		// Загрузка пользователей для получения их отделов
		const usersData = await fetchEntities(BX24, "user.get", {
			select: ["ID", "NAME", "LAST_NAME", "UF_DEPARTMENT"],
		})

		// Создаем карту пользователей по ID
		usersData.forEach(user => {
			users.value[user.ID] = {
				name: `${user.NAME} ${user.LAST_NAME}`,
				departments: user.UF_DEPARTMENT || [],
			}
		})

		// Загрузка сделок с учетом фильтров
		const dealFilter = { ...props.filters }

		// Удаляем фильтр по отделам из фильтра сделок, так как мы будем фильтровать сделки по отделам вручную
		if (dealFilter.DEPARTMENT_ID) {
			delete dealFilter.DEPARTMENT_ID
		}

		// Удаляем фильтр STATUS_ID для загрузки всех сделок
		// Мы будем использовать его только для выделения нужных типов сделок
		const statusFilter = dealFilter.STATUS_ID
		delete dealFilter.STATUS_ID

		const deals = await fetchEntities(BX24, "crm.deal.list", {
			select: ["ID", "TITLE", "OPPORTUNITY", "STAGE_ID", "ASSIGNED_BY_ID"],
			filter: dealFilter,
		})

		// Группировка сделок по отделам
		const departmentsMap = {}

		// Фильтруем отделы по выбранным в фильтре (если есть)
		let filteredDepartments = [...departments]
		if (props.filters.DEPARTMENT_ID && props.filters.DEPARTMENT_ID.length > 0) {
			filteredDepartments = departments.filter(dept =>
				props.filters.DEPARTMENT_ID.includes(dept.ID)
			)
		}

		filteredDepartments.forEach(dept => {
			departmentsMap[dept.ID] = {
				departmentId: dept.ID,
				department: dept.NAME,
				inProcessCount: 0,
				wonCount: 0,
				loseCount: 0,
				deals: [],
				// Добавляем дополнительные поля для хранения отфильтрованных сделок
				filteredInProcessCount: 0,
				filteredWonCount: 0,
				filteredLoseCount: 0,
				hasFilteredDeals: false,
			}
		})

		// Распределение сделок по отделам
		dealsByDepartment.value = {}

		deals.forEach(deal => {
			const assignedUser = users.value[deal.ASSIGNED_BY_ID]
			if (!assignedUser) return

			// Определяем статус сделки
			let status = "IN_PROCESS"
			if (deal.STAGE_ID === "WON") status = "WON"
			else if (deal.STAGE_ID === "LOSE") status = "LOSE"

			// Проверяем, соответствует ли сделка фильтру по статусу, если он установлен
			const matchesStatusFilter = !statusFilter || status === statusFilter

			// Добавляем информацию о менеджере к сделке
			const dealWithManager = {
				...deal,
				manager: assignedUser.name,
				stageId: status,
				id: deal.ID,
				title: deal.TITLE,
				opportunity: deal.OPPORTUNITY,
				matchesFilter: matchesStatusFilter,
			}

			// Распределяем по отделам
			assignedUser.departments.forEach(deptId => {
				if (departmentsMap[deptId]) {
					departmentsMap[deptId].deals.push(dealWithManager)

					// Увеличиваем общие счетчики
					if (status === "IN_PROCESS") departmentsMap[deptId].inProcessCount++
					else if (status === "WON") departmentsMap[deptId].wonCount++
					else if (status === "LOSE") departmentsMap[deptId].loseCount++

					// Увеличиваем счетчики отфильтрованных сделок, если сделка соответствует фильтру
					if (matchesStatusFilter) {
						departmentsMap[deptId].hasFilteredDeals = true
						if (status === "IN_PROCESS")
							departmentsMap[deptId].filteredInProcessCount++
						else if (status === "WON") departmentsMap[deptId].filteredWonCount++
						else if (status === "LOSE")
							departmentsMap[deptId].filteredLoseCount++
					}

					// Сохраняем сделки отдела для модального окна
					if (!dealsByDepartment.value[deptId]) {
						dealsByDepartment.value[deptId] = []
					}
					dealsByDepartment.value[deptId].push(dealWithManager)
				}
			})
		})

		// Преобразуем в массив для таблицы, показываем только отделы с соответствующими фильтру сделками
		departmentData.value = Object.values(departmentsMap)
			.filter(dept => {
				// Если нет фильтра по статусу, показываем отделы с любыми сделками
				if (!statusFilter) {
					return (
						dept.inProcessCount > 0 || dept.wonCount > 0 || dept.loseCount > 0
					)
				}
				// Если есть фильтр по статусу, показываем только отделы с подходящими сделками
				return dept.hasFilteredDeals
			})
			.sort((a, b) => b.wonCount - a.wonCount)
	} catch (error) {
		console.error("Error loading department data:", error)
	} finally {
		isLoading.value = false
	}
}

// Watch for filter changes
watch(
	() => props.filters,
	() => {
		loadData()
	},
	{ deep: true, immediate: true }
)
</script>

<style scoped>
.department-link {
	color: #2196f3;
	text-decoration: none;
}
.department-link:hover {
	text-decoration: underline;
}
.highlighted-count {
	font-weight: bold;
	color: #ff5722;
}
.text-success {
	color: #4caf50;
}
.text-error {
	color: #f44336;
}
.text-primary {
	color: #2196f3;
}
</style>
