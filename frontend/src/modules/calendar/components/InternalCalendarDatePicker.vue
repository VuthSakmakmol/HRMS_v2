<script setup>
import { computed, ref, watch } from "vue"
import { useI18n } from "vue-i18n"

import DatePicker from "primevue/datepicker"
import Tag from "primevue/tag"

import { resolveCalendarDay } from "../services/calendar.api.js"

const props = defineProps({
    modelValue: {
        type: String,
        default: "",
    },
    companyId: {
        type: String,
        default: "",
    },
    branchId: {
        type: String,
        default: "",
    },
    placeholder: {
        type: String,
        default: "",
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    showStatus: {
        type: Boolean,
        default: true,
    },
})

const emit = defineEmits(["update:modelValue", "resolved"])

const { t } = useI18n()

const loading = ref(false)
const resolvedDay = ref(null)

const pickerValue = computed({
    get() {
        if (!props.modelValue) return null
        const date = new Date(`${props.modelValue}T00:00:00`)
        return Number.isNaN(date.getTime()) ? null : date
    },
    set(value) {
        if (!value) {
            emit("update:modelValue", "")
            resolvedDay.value = null
            emit("resolved", null)
            return
        }

        const year = value.getFullYear()
        const month = String(value.getMonth() + 1).padStart(2, "0")
        const day = String(value.getDate()).padStart(2, "0")
        emit("update:modelValue", `${year}-${month}-${day}`)
    },
})

const statusSeverity = computed(() => {
    if (!resolvedDay.value) return "secondary"

    if (["WORKING_DAY", "SPECIAL_WORKING_DAY", "COMPANY_EVENT"].includes(resolvedDay.value.dayType)) {
        return "success"
    }

    if (resolvedDay.value.dayType === "WEEKEND") return "warn"
    return "danger"
})

async function resolveSelectedDate() {
    if (!props.modelValue) {
        resolvedDay.value = null
        emit("resolved", null)
        return
    }

    loading.value = true

    try {
        const day = await resolveCalendarDay({
            date: props.modelValue,
            companyId: props.companyId || undefined,
            branchId: props.branchId || undefined,
        })

        resolvedDay.value = day
        emit("resolved", day)
    } finally {
        loading.value = false
    }
}

watch(
    () => [props.modelValue, props.companyId, props.branchId],
    () => resolveSelectedDate(),
    { immediate: true },
)
</script>

<template>
    <div class="internal-calendar-picker">
        <DatePicker
            v-model="pickerValue"
            date-format="yy-mm-dd"
            show-icon
            :disabled="disabled"
            :placeholder="placeholder || t('calendar.day.selectDate')"
        />

        <div v-if="showStatus && (resolvedDay || loading)" class="internal-calendar-picker__status">
            <Tag
                v-if="resolvedDay"
                :severity="statusSeverity"
                :value="`${t(`calendar.dayTypes.${resolvedDay.dayType}`)} - ${resolvedDay.name}`"
            />

            <span v-else>{{ t("calendar.day.resolving") }}</span>
        </div>
    </div>
</template>

<style scoped>
.internal-calendar-picker {
    display: grid;
    gap: 0.35rem;
}

.internal-calendar-picker__status {
    display: inline-flex;
    align-items: center;
    min-height: 1.5rem;
}

.internal-calendar-picker__status span {
    color: var(--hrms-text-muted);
    font-size: 0.76rem;
}
</style>
