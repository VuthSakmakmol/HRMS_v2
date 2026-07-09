import { createRouter, createWebHistory } from "vue-router"

import { useAuthStore } from "@/app/stores/auth.store.js"

const router = createRouter({
    history: createWebHistory(),

    routes: [
        {
            path: "/login",
            name: "login",
            component: () => import("@/modules/auth/LoginView.vue"),
            meta: {
                guestOnly: true,
            },
        },

        {
            path: "/",
            component: () => import("@/layouts/AppShell.vue"),
            meta: {
                requiresAuth: true,
            },

            children: [
                {
                    path: "",
                    name: "workspace",
                    component: () =>
                        import("@/modules/workspace/WorkspaceView.vue"),
                    meta: {
                        titleKey: "nav.overview",
                    },
                },

                {
                    path: "organization/companies",
                    name: "organization-companies",
                    component: () =>
                        import(
                            "@/modules/organization/views/CompanyListView.vue"
                        ),
                    meta: {
                        titleKey: "nav.companies",
                        permissionCode: "ORGANIZATION.COMPANY.VIEW",
                    },
                },

                {
                    path: "organization/branches",
                    name: "organization-branches",
                    component: () =>
                        import(
                            "@/modules/organization/views/BranchListView.vue"
                        ),
                    meta: {
                        titleKey: "nav.branches",
                        permissionCode: "ORGANIZATION.BRANCH.VIEW",
                    },
                },

                {
                    path: "organization/departments",
                    name: "organization-departments",
                    component: () =>
                        import(
                            "@/modules/organization/views/DepartmentListView.vue"
                        ),
                    meta: {
                        titleKey: "nav.departments",
                        permissionCode: "ORGANIZATION.DEPARTMENT.VIEW",
                    },
                },
                
                {
                    path: "organization/positions",
                    name: "organization-positions",
                    component: () =>
                        import("@/modules/organization/views/PositionListView.vue"),
                    meta: {
                        titleKey: "nav.positions",
                        permissionCode: "ORGANIZATION.POSITION.VIEW",
                    },
                },
                
                {
                    path: "organization/lines",
                    name: "organization-lines",
                    component: () => import("@/modules/line/views/LineListView.vue"),
                    meta: {
                        titleKey: "nav.lines",
                        permissionCode: "ORGANIZATION.LINE.VIEW",
                    },
                },

                {
                    path: "organization/shifts",
                    name: "organization-shifts",
                    component: () => import("@/modules/shift/views/ShiftListView.vue"),
                    meta: {
                        titleKey: "nav.shifts",
                        permissionCode: "ORGANIZATION.SHIFT.VIEW",
                    },
                },

                {
                    path: "organization/employee-types",
                    name: "organization-employee-types",
                    component: () =>
                        import("@/modules/employeeType/views/EmployeeTypeListView.vue"),
                    meta: {
                        titleKey: "nav.employeeTypes",
                        permissionCode: "ORGANIZATION.EMPLOYEE_TYPE.VIEW",
                    },
                },

                {
                    path: "organization/locations",
                    name: "organization-locations",
                    component: () =>
                        import("@/modules/location/views/LocationListView.vue"),
                    meta: {
                        titleKey: "nav.locations",
                        permissionCode: "ORGANIZATION.LOCATION.VIEW",
                    },
                },

                {
                    path: "employees",
                    name: "employees",
                    component: () => import("@/modules/employee/views/EmployeeListView.vue"),
                    meta: {
                        titleKey: "nav.employees",
                        permissionCode: "EMPLOYEE.PROFILE.VIEW",
                    },
                },


                {
                    path: "employees/movements",
                    name: "employee-movements",
                    component: () => import("@/modules/employeeMovement/views/EmployeeMovementListView.vue"),
                    meta: {
                        titleKey: "nav.employeeMovements",
                        permissionCode: "EMPLOYEE.MOVEMENT.VIEW",
                    },
                },

                {
                    path: "reports/manpower-plans",
                    name: "report-manpower-plans",
                    component: () => import("@/modules/manpowerPlan/views/ManpowerPlanListView.vue"),
                    meta: {
                        titleKey: "nav.manpowerPlans",
                        permissionCode: "REPORT.MANPOWER_PLAN.VIEW",
                    },
                },

                {
                    path: "calendar",
                    name: "calendar-days",
                    component: () => import("@/modules/calendar/views/CalendarListView.vue"),
                    meta: {
                        titleKey: "nav.calendar",
                        permissionCode: "CALENDAR.DAY.VIEW",
                    },
                },

                {
                    path: "reports/hr-management-dashboard",
                    name: "reports-hr-management-dashboard",
                    component: () => import("@/modules/report/views/HrManagementDashboardView.vue"),
                    meta: {
                        titleKey: "nav.hrManagementDashboard",
                        permissionCode: "REPORT.HR_ANALYTICS.VIEW",
                    },
                },

            ],
        },

        {
            path: "/:pathMatch(.*)*",
            redirect: {
                name: "workspace",
            },
        },
    ],
})

router.beforeEach(async (to) => {
    const authStore = useAuthStore()

    await authStore.bootstrap()

    const requiresAuth = to.matched.some(
        (route) => route.meta.requiresAuth,
    )

    const guestOnly = to.matched.some(
        (route) => route.meta.guestOnly,
    )

    if (requiresAuth && !authStore.isAuthenticated) {
        return {
            name: "login",
            query: {
                redirect: to.fullPath,
            },
        }
    }

    if (guestOnly && authStore.isAuthenticated) {
        return {
            name: "workspace",
        }
    }

    const permissionCode = [...to.matched]
        .reverse()
        .find((route) => route.meta.permissionCode)?.meta.permissionCode

    if (
        requiresAuth &&
        permissionCode &&
        !authStore.hasPermission(permissionCode)
    ) {
        return {
            name: "workspace",
        }
    }

    return true
})

export default router
