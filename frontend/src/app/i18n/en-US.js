export default {
    app: {
        name: "HRMS Enterprise",
        subtitle: "Workforce Operations Platform",
    },

    common: {
        english: "English",
        khmer: "ខ្មែរ",
        darkMode: "Dark mode",
        lightMode: "Light mode",
        retry: "Retry",
        logout: "Logout",
        menu: "Menu",
    },

    nav: {
        workspace: "Workspace",
        overview: "Overview",
    },

    auth: {
        systemAccess: "Secure system access",
        welcomeTitle: "One secure foundation for your workforce.",
        welcomeDescription:
            "Sign in with your authorized HRMS account to access modules according to your role, permissions, company, and branch scope.",
        securityPoint: "Backend-enforced security and audit-ready access",
        permissionPoint: "Flexible roles and permissions across every module",
        globalDesignPoint: "Global theme, dark mode, and language support",
        signIn: "Sign in",
        signInDescription:
            "Use the Super Admin account seeded in the backend.",
        loginId: "Login ID",
        loginIdPlaceholder: "Enter your login ID",
        password: "Password",
        passwordPlaceholder: "Enter your password",
        rootAdministrator: "Root Administrator",
    },

    workspace: {
        eyebrow: "Secure Workspace",
        welcome: "Welcome back, {name}",
        description:
            "Your session is authenticated by the backend. This workspace only displays access that the backend has authorized.",
        authorizedUser: "Authorized User",
        backendConnection: "Backend API",
        apiConnected: "API connected",
        apiChecking: "Checking API connection",
        apiUnavailable: "API unavailable",
        lastChecked: "Last checked",
        notChecked: "Not checked yet",
        signedInAccount: "Signed-in Account",
        role: "Role",
        accessControl: "Access Control",
        effectivePermissions: "Effective permissions",
        permissionDescription:
            "Permissions are resolved by the backend from your active roles.",
        nextModule: "Next Secure Module",
        organizationTitle: "Company and Branch Management",
        organizationDescription:
            "The next phase will let Root Admin create companies and branches through protected API routes and this interface.",
        permissionPreview: "Permission Preview",
        permissionPreviewDescription:
            "These are the permission codes returned by the backend for this signed-in user.",
        morePermissions: "+{count} more permissions",
    },

    foundation: {
        eyebrow: "System Foundation",
        title: "HRMS Enterprise is ready for secure module development.",
        description:
            "Theme, language, API communication, and global response rules are working from one shared foundation.",
        apiConnection: "Backend API",
        databaseConnection: "MongoDB Atlas",
        language: "Language",
        theme: "Appearance",
        apiConnected: "API connected",
        apiChecking: "Checking API connection",
        apiUnavailable: "API unavailable",
        databasePending: "Database will be connected in the next step",
        databaseConnected: "Database connected",
        lastChecked: "Last checked",
        noCheckYet: "Not checked yet",
    },

    errors: {
        internal: "An unexpected system error occurred.",
        routeNotFound: "The requested route was not found.",
        corsOriginDenied: "This website is not allowed to access the API.",
        validationFailed: "Please review the entered information.",
        authInvalidCredentials: "Login ID or password is incorrect.",
        authTokenRequired: "Your session has expired. Please sign in again.",
        authTokenInvalid: "Your session is invalid. Please sign in again.",
        authTokenRevoked: "Your session is no longer valid. Please sign in again.",
        authAccountUnavailable:
            "This account is unavailable. Please contact a system administrator.",
        permissionDenied: "You do not have permission to perform this action.",
    },
}