import { appParams } from '@/lib/app-params';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

/**
 * @typedef {Object} EntityManager
 * @property {(query?: any, sort?: string, limit?: number) => Promise<any[]>} filter
 * @property {(sort?: string, limit?: number) => Promise<any[]>} list
 * @property {(data: any) => Promise<any>} create
 * @property {(id: string, data: any) => Promise<any>} update
 * @property {(id: string) => Promise<any>} get
 * @property {(id: string) => Promise<any>} delete
 */

class ApiClient {
    constructor(config) {
        this.config = config;
        // Track entities that returned 404 so we avoid repeated network calls
        this._missingEntities = new Set();
    }

    // Auth Namespace
    /**
     * @returns {{
     *   login: (email: string, password: string) => Promise<any>,
     *   me: () => Promise<any>,
     *   isAuthenticated: () => Promise<boolean>,
     *   logout: () => Promise<void>,
     *   redirectToLogin: (returnUrl?: string) => void
     * }}
     */
    get auth() {
        return {
            me: async () => {
                const email = localStorage.getItem('mock_user_email');
                const headers = email ? { 'x-mock-user-email': email } : {};
                const res = await fetch(`${API_BASE}/auth/me`, { headers });
                if (!res.ok) return null;
                return res.json();
            },
            login: async (email, password) => {
                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Login failed');
                }

                const data = await res.json();
                localStorage.setItem('mock_user_email', data.user.email);
                return data.user;
            },
            isAuthenticated: async () => {
                try {
                    if (!localStorage.getItem('mock_user_email')) return false;

                    const email = localStorage.getItem('mock_user_email');
                    const headers = email ? { 'x-mock-user-email': email } : {};
                    const res = await fetch(`${API_BASE}/auth/me`, { headers });
                    return res.ok;
                } catch (e) {
                    console.error("Auth check failed", e);
                    return false;
                }
            },
            logout: async () => {
                localStorage.removeItem('mock_user_email');
                window.location.reload();
            },
            redirectToLogin: (returnUrl) => {
                localStorage.setItem('mock_user_email', 'admin@sarthi.com');
                window.location.reload();
            }
        };
    }

    // Entities Namespace
    /**
     * @returns {{ [key: string]: EntityManager } & {
     *   Project: EntityManager,
     *   Task: EntityManager,
     *   User: EntityManager,
     *   Department: EntityManager,
     *   Group: EntityManager,
     *   Sprint: EntityManager,
     *   Tag: EntityManager,
     *   CustomField: EntityManager,
     *   TaskGroup: EntityManager,
     *   MarketingTask: EntityManager,
     *   Activity: EntityManager,
     *   UserInvitation: EntityManager,
     *   AuditLog: EntityManager,
     *   Builder: EntityManager,
     *   Role: EntityManager
     * }}
     */
    get entities() {
        /** @type {any} */
        const proxy = new Proxy({}, {
            get: (target, prop) => {
                if (typeof prop === 'symbol') return Reflect.get(target, prop);

                const entityName = String(prop);

                // If we already detected this entity is missing (404), return
                // a lightweight stub that throws quickly to avoid further network calls.
                if (this._missingEntities.has(entityName)) {
                    return {
                        filter: async () => { return []; },
                        list: async () => { return []; },
                        create: async () => { throw new Error(`Entity Error: ${entityName} not available`); },
                        update: async () => { throw new Error(`Entity Error: ${entityName} not available`); },
                        get: async () => { return null; },
                        delete: async () => { throw new Error(`Entity Error: ${entityName} not available`); }
                    };
                }

                return {
                    filter: async (query, sort, limit) => {
                        const body = { ...query };
                        if (sort) body._sort = sort;
                        if (limit) body._limit = limit;

                        const res = await fetch(`${API_BASE}/rest/v1/${entityName}/filter`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        });
                        if (!res.ok) {
                            if (res.status === 404) this._missingEntities.add(entityName);
                            throw new Error(`Entity Error: ${res.statusText}`);
                        }
                        const data = await res.json();
                        if (Array.isArray(data)) {
                            return data.map(item => ({ ...(item || {}), id: item?.id || item?._id }));
                        }
                        return data;
                    },

                    list: async (sort, limit) => {
                        const body = {};
                        if (sort) body._sort = sort;
                        if (limit) body._limit = limit;

                        const res = await fetch(`${API_BASE}/rest/v1/${entityName}/filter`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        });
                        if (!res.ok) {
                            if (res.status === 404) this._missingEntities.add(entityName);
                            throw new Error(`Entity Error: ${res.statusText}`);
                        }
                        const data = await res.json();
                        if (Array.isArray(data)) {
                            return data.map(item => ({ ...(item || {}), id: item?.id || item?._id }));
                        }
                        return data;
                    },

                    create: async (data) => {
                        const res = await fetch(`${API_BASE}/rest/v1/${entityName}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        if (!res.ok) {
                            if (res.status === 404) this._missingEntities.add(entityName);
                            throw new Error(`Entity Error: ${res.statusText}`);
                        }
                        const created = await res.json();
                        return { ...(created || {}), id: created?.id || created?._id };
                    },

                    update: async (id, data) => {
                        if (id === undefined || id === null) {
                            throw new Error(`Entity Error: update called with invalid id for ${entityName}`);
                        }
                        const res = await fetch(`${API_BASE}/rest/v1/${entityName}/${id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        if (!res.ok) {
                            if (res.status === 404) this._missingEntities.add(entityName);
                            throw new Error(`Entity Error: ${res.statusText}`);
                        }
                        const updated = await res.json();
                        return { ...(updated || {}), id: updated?.id || updated?._id };
                    },

                    get: async (id) => {
                        const res = await fetch(`${API_BASE}/rest/v1/${entityName}/${id}`);
                        if (!res.ok) {
                            if (res.status === 404) {
                                this._missingEntities.add(entityName);
                                throw new Error(`${entityName} not found`);
                            }
                            throw new Error(`Entity Error: ${res.statusText}`);
                        }
                        const obj = await res.json();
                        return { ...(obj || {}), id: obj?.id || obj?._id };
                    },

                    delete: async (id) => {
                        if (id === undefined || id === null) {
                            throw new Error(`Entity Error: delete called with invalid id for ${entityName}`);
                        }
                        const res = await fetch(`${API_BASE}/rest/v1/${entityName}/${id}`, {
                            method: 'DELETE'
                        });
                        if (!res.ok) {
                            if (res.status === 404) this._missingEntities.add(entityName);
                            throw new Error(`Entity Error: ${res.statusText}`);
                        }
                        const obj = await res.json().catch(() => null);
                        return obj;
                    }
                };
            }
        });
        return proxy;
    }

    // Integrations
    get integrations() {
        return {
            Core: {
                InvokeLLM: async (payload) => {
                    return {};
                },
                SendEmail: async () => ({ success: true }),
                UploadFile: async ({ file }) => {
                    // For now, create a local blob URL - in production, upload to server
                    const url = URL.createObjectURL(file);
                    return { file_url: url, url, id: 'local_id' };
                },
            }
        };
    }

    // Functions (Invoke Server Side Functions)
    /**
     * @returns {{
     *   invoke: (functionName: string, payload?: any) => Promise<{data: any}>
     * }}
     */
    get functions() {
        return {
            invoke: async (functionName, payload) => {
                const res = await fetch(`${API_BASE}/functions/v1/invoke/${functionName}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload || {})
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `Function Error: ${res.statusText}`);
                }
                const data = await res.json();
                return { data };
            }
        };
    }

    // Storage
    get storage() {
        return {
            upload: async (file) => ({ url: URL.createObjectURL(file), id: 'local_id' }),
            getPublicUrl: (path) => ({ publicUrl: path })
        }
    }

    // App Logs (Analytics)
    /**
     * @returns {{
     *   logUserInApp: (pageName: string) => Promise<{success: boolean}>
     * }}
     */
    get appLogs() {
        return {
            logUserInApp: async (pageName) => {
                console.log(`[Analytics] User visited page: ${pageName}`);
                return { success: true };
            }
        };
    }

    get asServiceRole() {
        return this;
    }
}

export const createClient = (config) => new ApiClient(config);

// Export as 'api' for new code, keep 'base44' alias for backward compatibility
export const api = createClient({});
export const base44 = api; // Backward compatibility alias
