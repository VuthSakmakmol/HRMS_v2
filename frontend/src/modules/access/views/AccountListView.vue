<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import Card from "primevue/card";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import Tag from "primevue/tag";
import { useAuthStore } from "@/app/stores/auth.store.js";
import {
  fetchAccounts,
  fetchRoleLookup,
  createAccount,
  updateAccount,
  resetAccountPassword,
} from "../services/access.api.js";
const toast = useToast(),
  auth = useAuthStore();
const loading = ref(false),
  saving = ref(false),
  items = ref([]),
  roles = ref([]),
  total = ref(0),
  page = ref(1),
  limit = ref(20),
  search = ref(""),
  status = ref("ALL"),
  dialog = ref(false),
  editing = ref(null),
  resetDialog = ref(false),
  resetTarget = ref(null),
  newPassword = ref("");
const form = reactive({
  loginId: "",
  displayName: "",
  password: "",
  status: "ACTIVE",
  roleIds: [],
});
const canCreate = computed(() => auth.hasPermission("ACCESS.ACCOUNT.CREATE")),
  canUpdate = computed(() => auth.hasPermission("ACCESS.ACCOUNT.UPDATE")),
  canReset = computed(() =>
    auth.hasPermission("ACCESS.ACCOUNT.RESET_PASSWORD"),
  );
const roleOptions = computed(() =>
  roles.value.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id })),
);
function assignments(row) {
  return (
    (row.roleAssignments || [])
      .map((a) => a.roleId?.name || a.roleId?.code || "-")
      .join(", ") || "-"
  );
}
async function load() {
  loading.value = true;
  try {
    const r = await fetchAccounts({
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
      summary: "Unable to load accounts",
      detail: e.response?.data?.error?.messageKey || e.message,
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}
function openCreate() {
  editing.value = null;
  Object.assign(form, {
    loginId: "",
    displayName: "",
    password: "",
    status: "ACTIVE",
    roleIds: [],
  });
  dialog.value = true;
}
function openEdit(row) {
  editing.value = row;
  Object.assign(form, {
    loginId: row.loginId,
    displayName: row.displayName,
    password: "",
    status: row.status,
    roleIds: (row.roleAssignments || [])
      .map((a) => a.roleId?.id || a.roleId)
      .filter(Boolean),
  });
  dialog.value = true;
}
async function save() {
  saving.value = true;
  try {
    const roleAssignments = form.roleIds.map((roleId) => ({
      roleId,
      companyId: null,
      allBranches: true,
      branchIds: [],
    }));
    const payload = {
      loginId: form.loginId,
      displayName: form.displayName,
      status: form.status,
      roleAssignments,
    };
    if (editing.value) await updateAccount(editing.value.id, payload);
    else await createAccount({ ...payload, password: form.password });
    dialog.value = false;
    toast.add({
      severity: "success",
      summary: editing.value ? "Account updated" : "Account created",
      life: 2500,
    });
    await load();
  } catch (e) {
    toast.add({
      severity: "error",
      summary: "Unable to save account",
      detail: e.response?.data?.error?.messageKey || e.message,
      life: 4500,
    });
  } finally {
    saving.value = false;
  }
}
async function doReset() {
  try {
    await resetAccountPassword(resetTarget.value.id, newPassword.value);
    resetDialog.value = false;
    toast.add({
      severity: "success",
      summary: "Password reset successfully",
      life: 2500,
    });
  } catch (e) {
    toast.add({
      severity: "error",
      summary: "Unable to reset password",
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
    roles.value = (await fetchRoleLookup()).items;
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
            <h2>Accounts</h2>
            <p>
              Manage login access, assigned role, account status, and password
              reset.
            </p>
          </div>
          <Button
            v-if="canCreate"
            label="New Account"
            icon="pi pi-user-plus"
            @click="openCreate"
          /></div></template
      ><template #content
        ><div class="filters">
          <span class="p-input-icon-left"
            ><i class="pi pi-search" /><InputText
              v-model="search"
              placeholder="Search login or name..."
              @keyup.enter="
                page = 1;
                load();
              " /></span
          ><Select
            v-model="status"
            :options="['ALL', 'ACTIVE', 'DISABLED', 'LOCKED']"
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
          ><Column field="loginId" header="Login ID" /><Column
            field="displayName"
            header="Display Name" /><Column header="Role"
            ><template #body="{ data }">{{
              assignments(data)
            }}</template></Column
          ><Column header="Status"
            ><template #body="{ data }"
              ><Tag
                :value="data.status"
                :severity="
                  data.status === 'ACTIVE'
                    ? 'success'
                    : data.status === 'LOCKED'
                      ? 'warn'
                      : 'danger'
                " /></template></Column
          ><Column field="lastLoginAt" header="Last Login"
            ><template #body="{ data }">{{
              data.lastLoginAt
                ? new Date(data.lastLoginAt).toLocaleString()
                : "-"
            }}</template></Column
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
                  v-if="canReset"
                  icon="pi pi-key"
                  text
                  rounded
                  severity="warn"
                  @click="
                    resetTarget = data;
                    newPassword = '';
                    resetDialog = true;
                  "
                /></div></template></Column></DataTable></template
    ></Card>
    <Dialog
      v-model:visible="dialog"
      modal
      :header="editing ? 'Edit Account' : 'Create Account'"
      class="access-dialog"
      ><div class="form-grid">
        <label>Login ID<InputText v-model="form.loginId" /></label
        ><label>Display Name<InputText v-model="form.displayName" /></label
        ><label v-if="!editing"
          >Initial Password<Password
            v-model="form.password"
            toggleMask
            :feedback="false" /></label
        ><label
          >Roles<MultiSelect
            v-model="form.roleIds"
            :options="roleOptions"
            optionLabel="label"
            optionValue="value"
            filter
            display="chip"
            placeholder="Select roles" /></label
        ><label
          >Status<Select
            v-model="form.status"
            :options="['ACTIVE', 'DISABLED', 'LOCKED']"
        /></label>
      </div>
      <template #footer
        ><Button
          label="Cancel"
          text
          severity="secondary"
          @click="dialog = false" /><Button
          label="Save"
          :loading="saving"
          @click="save" /></template
    ></Dialog>
    <Dialog
      v-model:visible="resetDialog"
      modal
      header="Reset Password"
      :style="{ width: '30rem', maxWidth: '94vw' }"
      ><div class="form-grid one">
        <label
          >New password for {{ resetTarget?.displayName
          }}<Password v-model="newPassword" toggleMask
        /></label>
      </div>
      <template #footer
        ><Button label="Cancel" text @click="resetDialog = false" /><Button
          label="Reset Password"
          severity="warn"
          :disabled="newPassword.length < 8"
          @click="doReset" /></template
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
.form-grid.one {
  grid-template-columns: 1fr;
}
.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 600;
}
.access-dialog {
  width: min(650px, 94vw);
}
@media (max-width: 640px) {
  .head {
    align-items: flex-start;
    flex-direction: column;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
