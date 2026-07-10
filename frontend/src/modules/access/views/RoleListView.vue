<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import Card from "primevue/card";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import MultiSelect from "primevue/multiselect";
import Select from "primevue/select";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import Checkbox from "primevue/checkbox";
import { useAuthStore } from "@/app/stores/auth.store.js";
import {
  fetchPermissions,
  fetchRoles,
  createRole,
  updateRole,
  deleteRole as removeRole,
} from "../services/access.api.js";
const toast = useToast(),
  auth = useAuthStore();
const loading = ref(false),
  saving = ref(false),
  items = ref([]),
  permissions = ref([]),
  total = ref(0),
  page = ref(1),
  limit = ref(20),
  search = ref(""),
  status = ref("ALL"),
  dialog = ref(false),
  editing = ref(null),
  confirmDelete = ref(false),
  candidate = ref(null);
const form = reactive({
  code: "",
  name: "",
  description: "",
  scope: "COMPANY",
  companyId: null,
  permissionIds: [],
  isActive: true,
});
const canCreate = computed(() => auth.hasPermission("ACCESS.ROLE.CREATE")),
  canUpdate = computed(() => auth.hasPermission("ACCESS.ROLE.UPDATE")),
  canDelete = computed(() => auth.hasPermission("ACCESS.ROLE.DELETE"));
const permissionOptions = computed(() =>
  permissions.value.map((p) => ({
    label: `${p.module} · ${p.action}`,
    value: p.id,
  })),
);
function reset() {
  Object.assign(form, {
    code: "",
    name: "",
    description: "",
    scope: "COMPANY",
    companyId: null,
    permissionIds: [],
    isActive: true,
  });
}
async function load() {
  loading.value = true;
  try {
    const r = await fetchRoles({
      page: page.value,
      limit: limit.value,
      search: search.value,
      status: status.value,
    });
    items.value = r.items;
    total.value = r.pagination.total;
  } catch (e) {
    toast.add({
      severity: "error",
      summary: "Unable to load roles",
      detail: e.response?.data?.error?.messageKey || e.message,
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}
function openCreate() {
  editing.value = null;
  reset();
  dialog.value = true;
}
function openEdit(row) {
  editing.value = row;
  Object.assign(form, {
    code: row.code,
    name: row.name,
    description: row.description || "",
    scope: row.scope,
    companyId: row.companyId?.id || row.companyId || null,
    permissionIds: (row.permissionIds || []).map((p) => p.id || p),
    isActive: row.isActive,
  });
  dialog.value = true;
}
async function save() {
  saving.value = true;
  try {
    const payload = {
      ...form,
      companyId: form.scope === "GLOBAL" ? null : form.companyId || null,
    };
    editing.value
      ? await updateRole(editing.value.id, payload)
      : await createRole(payload);
    dialog.value = false;
    toast.add({
      severity: "success",
      summary: editing.value ? "Role updated" : "Role created",
      life: 2500,
    });
    await load();
  } catch (e) {
    toast.add({
      severity: "error",
      summary: "Unable to save role",
      detail: e.response?.data?.error?.messageKey || e.message,
      life: 4500,
    });
  } finally {
    saving.value = false;
  }
}
async function doDelete() {
  try {
    await removeRole(candidate.value.id);
    confirmDelete.value = false;
    toast.add({ severity: "success", summary: "Role deleted", life: 2500 });
    await load();
  } catch (e) {
    toast.add({
      severity: "error",
      summary: "Unable to delete role",
      detail: e.response?.data?.error?.messageKey || e.message,
      life: 4500,
    });
  }
}
function onPage(e) {
  page.value = e.page + 1;
  limit.value = e.rows;
  load();
}
onMounted(async () => {
  try {
    permissions.value = (await fetchPermissions()).items;
  } catch {}
  await load();
});
</script>
<template>
  <div class="access-page">
    <Card
      ><template #title
        ><div class="head">
          <div>
            <h2>Roles & Permissions</h2>
            <p>
              Create flexible roles and select permissions from every HRMS
              module.
            </p>
          </div>
          <Button
            v-if="canCreate"
            label="New Role"
            icon="pi pi-plus"
            @click="openCreate"
          /></div></template
      ><template #content
        ><div class="filters">
          <span class="p-input-icon-left"
            ><i class="pi pi-search" /><InputText
              v-model="search"
              placeholder="Search role..."
              @keyup.enter="
                page = 1;
                load();
              " /></span
          ><Select
            v-model="status"
            :options="[
              { label: 'All', value: 'ALL' },
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Inactive', value: 'INACTIVE' },
            ]"
            optionLabel="label"
            optionValue="value"
            @change="
              page = 1;
              load();
            "
          /><Button
            label="Apply"
            icon="pi pi-filter"
            severity="secondary"
            @click="
              page = 1;
              load();
            "
          />
        </div>
        <DataTable
          :value="items"
          :loading="loading"
          lazy
          paginator
          :rows="limit"
          :totalRecords="total"
          @page="onPage"
          stripedRows
          responsiveLayout="scroll"
          ><Column field="code" header="Code" /><Column
            field="name"
            header="Role" /><Column header="Scope"
            ><template #body="{ data }"
              ><Tag
                :value="data.scope"
                :severity="
                  data.scope === 'GLOBAL' ? 'info' : 'secondary'
                " /></template></Column
          ><Column header="Permissions"
            ><template #body="{ data }">{{
              data.permissionIds?.length || 0
            }}</template></Column
          ><Column header="Status"
            ><template #body="{ data }"
              ><Tag
                :value="data.isActive ? 'ACTIVE' : 'INACTIVE'"
                :severity="
                  data.isActive ? 'success' : 'danger'
                " /></template></Column
          ><Column header="Actions" frozen alignFrozen="right"
            ><template #body="{ data }"
              ><div class="actions">
                <Button
                  v-if="canUpdate"
                  icon="pi pi-pencil"
                  text
                  rounded
                  @click="openEdit(data)"
                /><Button
                  v-if="canDelete && !data.isSystem"
                  icon="pi pi-trash"
                  text
                  rounded
                  severity="danger"
                  @click="
                    candidate = data;
                    confirmDelete = true;
                  "
                /></div></template></Column></DataTable></template
    ></Card>
    <Dialog
      v-model:visible="dialog"
      modal
      :header="editing ? 'Edit Role' : 'Create Role'"
      class="access-dialog"
      ><div class="form-grid">
        <label
          >Code<InputText
            v-model="form.code"
            :disabled="editing?.isSystem" /></label
        ><label>Name<InputText v-model="form.name" /></label
        ><label
          >Scope<Select
            v-model="form.scope"
            :disabled="editing?.isSystem"
            :options="['GLOBAL', 'COMPANY']" /></label
        ><label class="wide"
          >Description<Textarea v-model="form.description" rows="3" /></label
        ><label class="wide"
          >Permissions<MultiSelect
            v-model="form.permissionIds"
            :options="permissionOptions"
            optionLabel="label"
            optionValue="value"
            filter
            display="chip"
            placeholder="Select permissions" /></label
        ><label class="check"
          ><Checkbox v-model="form.isActive" binary /> Active</label
        >
      </div>
      <template #footer
        ><Button
          label="Cancel"
          severity="secondary"
          text
          @click="dialog = false" /><Button
          label="Save"
          :loading="saving"
          @click="save" /></template
    ></Dialog>
    <Dialog
      v-model:visible="confirmDelete"
      modal
      header="Delete Role"
      :style="{ width: '28rem' }"
      ><p>
        Delete <strong>{{ candidate?.name }}</strong
        >? A role assigned to an account cannot be deleted.
      </p>
      <template #footer
        ><Button label="Cancel" text @click="confirmDelete = false" /><Button
          label="Delete"
          severity="danger"
          @click="doDelete" /></template
    ></Dialog>
  </div>
</template>
<style scoped>
.access-page {
  padding: 1rem;
}
.head,
.filters,
.actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}
.head {
  justify-content: space-between;
}
.head h2 {
  margin: 0;
}
.head p {
  margin: 0.25rem 0 0;
  color: var(--p-text-muted-color);
  font-size: 0.84rem;
}
.filters {
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.actions {
  justify-content: center;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 600;
}
.form-grid .wide {
  grid-column: 1/-1;
}
.form-grid .check {
  flex-direction: row;
  align-items: center;
}
.access-dialog {
  width: min(760px, 94vw);
}
@media (max-width: 640px) {
  .head {
    align-items: flex-start;
    flex-direction: column;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .form-grid .wide {
    grid-column: auto;
  }
}
</style>
