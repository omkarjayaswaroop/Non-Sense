const STORAGE_KEY = "stocksense_state_v2";
const AUTH_KEY = "stocksense_auth_v1";
const DEMO_USER = { name: "Omkar", email: "admin@stocksense.demo" };
function getDemoPassword() { return localStorage.getItem("stocksense_demo_password_v1") || "stocksense123"; }
let authMode = "login";

const DEFAULT_STATE = {
    products: [
        { id: 1, name: "Steel Rods", sku: "SR-102", category: "Raw Materials", unit: "kg", reorder: 50, locations: { "Main Warehouse": 120, "Production Rack": 30 } },
        { id: 2, name: "Office Chairs", sku: "CH-201", category: "Finished Goods", unit: "units", reorder: 20, locations: { "Warehouse 2": 45 } },
        { id: 3, name: "Aluminium Sheets", sku: "AL-311", category: "Raw Materials", unit: "units", reorder: 30, locations: { "Main Warehouse": 35 } },
        { id: 4, name: "Packing Boxes", sku: "BX-410", category: "Equipment", unit: "boxes", reorder: 25, locations: { "Main Warehouse": 80 } }
    ],
    receipts: [
        { id: "REC-1042", supplier: "Metro Steel Suppliers", productId: 1, qty: 50, location: "Main Warehouse", status: "Validated", date: "2026-09-26T09:42:00" },
        { id: "REC-1043", supplier: "Prime Office Supplies", productId: 2, qty: 20, location: "Warehouse 2", status: "Waiting", date: "2026-09-26T10:15:00" }
    ],
    deliveries: [
        { id: "DEL-203", customer: "Urban Furnishings", productId: 2, qty: 10, location: "Warehouse 2", status: "Picked", date: "2026-09-26T11:20:00" }
    ],
    transfers: [
        { id: "TRF-208", productId: 1, qty: 20, from: "Main Warehouse", to: "Production Rack", status: "Done", date: "2026-09-26T10:15:00" }
    ],
    adjustments: [],
    ledger: [
        { id: "LED-1", type: "Receipt", ref: "REC-1042", productId: 1, qty: 50, location: "Main Warehouse", note: "Supplier receipt validated", date: "2026-09-26T09:42:00" },
        { id: "LED-2", type: "Transfer", ref: "TRF-208", productId: 1, qty: 20, from: "Main Warehouse", to: "Production Rack", note: "Internal transfer completed", date: "2026-09-26T10:15:00" },
        { id: "LED-3", type: "Delivery", ref: "DEL-203", productId: 2, qty: 10, location: "Warehouse 2", note: "Delivery picked", date: "2026-09-26T11:20:00" }
    ]
};

let state = loadState();
let currentPage = "dashboard";
let modalSubmit = null;
let currentSearch = "";

const appPage = document.querySelector("#app-page");
const modalOverlay = document.querySelector("#modal-overlay");
const modalTitle = document.querySelector("#modal-title");
const modalSubtitle = document.querySelector("#modal-subtitle");
const modalContent = document.querySelector("#modal-content");

function ensureToastHost() {
    let host = document.querySelector("#toast-host");
    if (!host) {
        host = document.createElement("div");
        host.id = "toast-host";
        host.setAttribute("aria-live", "polite");
        host.setAttribute("aria-atomic", "true");
        document.body.appendChild(host);
    }
    return host;
}

function notify(message, type = "success") {
    const host = ensureToastHost();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icon = type === "error" ? "×" : type === "info" ? "i" : "✓";
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span><button type="button" aria-label="Close notification">×</button>`;
    toast.querySelector("button").addEventListener("click", () => toast.remove());
    host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 220);
    }, 3200);
}

function animateCounters() {
    document.querySelectorAll("[data-count]").forEach(el => {
        const target = Number(el.dataset.count) || 0;
        const duration = 500;
        const start = performance.now();
        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(target * eased);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    });
}

function applyPageTransition() {
    appPage.classList.remove("page-enter-active");
    void appPage.offsetWidth;
    appPage.classList.add("page-enter-active");
    setTimeout(() => appPage.classList.remove("page-enter-active"), 280);
}

function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
}

function getAuthUser() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }
    catch { return null; }
}

function setAuthUser(user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function clearAuthUser() {
    localStorage.removeItem(AUTH_KEY);
}

function showApp() {
    document.querySelector("#auth-screen").innerHTML = "";
    document.querySelector("#auth-screen").style.display = "none";
    document.querySelector(".app").classList.remove("is-hidden");
    renderPage();
}

function showAuth() {
    document.querySelector(".app").classList.add("is-hidden");
    const screen = document.querySelector("#auth-screen");
    screen.style.display = "flex";
    renderAuth();
}

function renderAuth(error = "") {
    const screen = document.querySelector("#auth-screen");
    const tab = (mode, label) => `<button type="button" class="auth-tab ${authMode===mode?"active":""}" data-auth-mode="${mode}">${label}</button>`;
    let body = "";
    if (authMode === "login") {
        body = `<form class="auth-form" id="login-form">
            <div class="auth-field"><label>Email</label><input name="email" type="email" value="${DEMO_USER.email}" required autocomplete="username"></div>
            <div class="auth-field"><label>Password</label><input name="password" type="password" value="${getDemoPassword()}" required autocomplete="current-password"></div>
            ${error ? `<div class="auth-error">${error}</div>` : ""}
            <button class="auth-submit" type="submit">Sign In to Dashboard</button>
            <button class="auth-secondary" type="button" data-demo-login>Use Demo Account</button>
            <div class="auth-hint"><strong>Demo access</strong><br>${DEMO_USER.email}<br>${getDemoPassword()}</div>
        </form>`;
    } else if (authMode === "signup") {
        body = `<form class="auth-form" id="signup-form">
            <div class="auth-field"><label>Full Name</label><input name="name" required></div>
            <div class="auth-field"><label>Email</label><input name="email" type="email" required></div>
            <div class="auth-field"><label>Password</label><input name="password" type="password" minlength="6" required></div>
            ${error ? `<div class="auth-error">${error}</div>` : ""}
            <button class="auth-submit" type="submit">Create Account</button>
        </form>`;
    } else {
        body = `<form class="auth-form" id="reset-email-form">
            <div class="auth-field"><label>Account Email</label><input name="email" type="email" placeholder="Enter your account email" required></div>
            ${error ? `<div class="auth-error">${error}</div>` : ""}
            <button class="auth-submit" type="submit">Send OTP</button>
            <div class="auth-hint">For this hackathon prototype, the demo OTP is <strong>123456</strong>. A production build would send it through a backend/email or SMS provider.</div>
        </form>`;
    }
    screen.innerHTML = `<div class="auth-card">
        <div class="auth-brand"><h1>StockSense</h1><p>Inventory Management System</p><span class="auth-badge">● Demo-ready prototype</span></div>
        <div class="auth-body"><div class="auth-tabs">${tab("login","Login")}${tab("signup","Sign Up")}${tab("reset","Reset Password")}</div>${body}</div>
        <div class="auth-footer">Centralized stock • Receipts • Deliveries • Transfers • Adjustments • Audit trail</div>
    </div>`;
}

function handleAuthMode(mode) {
    authMode = mode;
    renderAuth();
}

function handleLogin(form) {
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    const account = JSON.parse(localStorage.getItem("stocksense_account_v1") || "null");
    const valid = (email === DEMO_USER.email && password === getDemoPassword()) || (account && email === account.email && password === account.password);
    if (!valid) return renderAuth("Email or password is incorrect.");
    const name = account && email === account.email ? account.name : DEMO_USER.name;
    setAuthUser({ name, email });
    notify("Signed in successfully.", "success");
    showApp();
}

function handleSignup(form) {
    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    if (email === DEMO_USER.email) return renderAuth("That demo email is reserved.");
    localStorage.setItem("stocksense_account_v1", JSON.stringify({ name, email, password }));
    setAuthUser({ name, email });
    notify("Account created. Welcome to StockSense.", "success");
    showApp();
}

function handleResetEmail(form) {
    const email = form.email.value.trim().toLowerCase();
    const account = JSON.parse(localStorage.getItem("stocksense_account_v1") || "null");
    if (!(email === DEMO_USER.email || (account && email === account.email))) return renderAuth("No demo account was found for that email.");
    localStorage.setItem("stocksense_pending_reset_v1", email);
    authMode = "reset-otp";
    renderResetOtp();
}

function renderResetOtp(error = "") {
    const screen = document.querySelector("#auth-screen");
    screen.innerHTML = `<div class="auth-card"><div class="auth-brand"><h1>StockSense</h1><p>Password reset verification</p><span class="auth-badge">OTP verification</span></div><div class="auth-body"><form class="auth-form" id="reset-otp-form"><div class="auth-field"><label>6-digit OTP</label><input name="otp" inputmode="numeric" maxlength="6" placeholder="123456" required></div><div class="auth-field"><label>New Password</label><input name="password" type="password" minlength="6" required></div>${error?`<div class="auth-error">${error}</div>`:""}<button class="auth-submit" type="submit">Update Password</button><div class="auth-hint">Demo OTP: <strong>123456</strong></div></form></div><div class="auth-footer">Secure reset flow for the prototype demonstration</div></div>`;
}

function handleResetOtp(form) {
    if (form.otp.value !== "123456") return renderResetOtp("Invalid OTP. Use the demo OTP 123456.");
    const email = localStorage.getItem("stocksense_pending_reset_v1");
    const account = JSON.parse(localStorage.getItem("stocksense_account_v1") || "null");
    if (email === DEMO_USER.email) {
        localStorage.setItem("stocksense_demo_password_v1", form.password.value);
        notify("Demo password updated successfully.", "success");
    } else if (account && email === account.email) {
        account.password = form.password.value;
        localStorage.setItem("stocksense_account_v1", JSON.stringify(account));
        notify("Password updated successfully.", "success");
    }
    localStorage.removeItem("stocksense_pending_reset_v1");
    authMode = "login";
    renderAuth();
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATE));
    return cloneData(DEFAULT_STATE);
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function productById(id) {
    return state.products.find(p => Number(p.id) === Number(id));
}

function totalStock(product) {
    return Object.values(product.locations || {}).reduce((sum, qty) => sum + Number(qty || 0), 0);
}

function statusForProduct(product) {
    const total = totalStock(product);
    if (total === 0) return { text: "Out of Stock", cls: "status-danger" };
    if (total <= Number(product.reorder)) return { text: "Low", cls: "status-low" };
    return { text: "Healthy", cls: "status-healthy" };
}

function formatDate(value) {
    return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function nextNumber(prefix, list, width = 4) {
    let max = 0;
    list.forEach(item => {
        const match = String(item.id).match(/(\d+)$/);
        if (match) max = Math.max(max, Number(match[1]));
    });
    return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}

function uniqueLocations() {
    const set = new Set(["Main Warehouse", "Warehouse 2", "Production Rack"]);
    state.products.forEach(product => Object.keys(product.locations || {}).forEach(location => set.add(location)));
    return [...set];
}

function optionList(values, selected = "") {
    return values.map(v => `<option ${v === selected ? "selected" : ""}>${v}</option>`).join("");
}

function productOptions(selected = "") {
    return state.products.map(p => `<option value="${p.id}" ${String(p.id) === String(selected) ? "selected" : ""}>${p.name} (${p.sku})</option>`).join("");
}

function statusBadge(text) {
    const lower = text.toLowerCase();
    let cls = "status-neutral";
    if (["healthy", "validated", "done", "applied", "completed"].includes(lower)) cls = "status-healthy";
    else if (["low", "waiting", "ready", "picked", "packed"].includes(lower)) cls = "status-low";
    else if (["out of stock", "canceled", "blocked"].includes(lower)) cls = "status-danger";
    return `<span class="status ${cls}">${text}</span>`;
}

function renderNav() {
    document.querySelectorAll(".nav-link[data-page]").forEach(link => {
        link.classList.toggle("active", link.dataset.page === currentPage || (currentPage === "ledger" && link.dataset.page === "ledger"));
    });
}

function setPageHeader(title, subtitle) {
    document.querySelector("#page-title").textContent = title;
    document.querySelector("#page-subtitle").textContent = subtitle;
}

function renderPage() {
    applyPageTransition();
    renderNav();
    updateAlertCount();
    if (currentPage === "dashboard") renderDashboard();
    else if (currentPage === "products") renderProducts();
    else if (currentPage === "receipts") renderReceipts();
    else if (currentPage === "deliveries") renderDeliveries();
    else if (currentPage === "transfers") renderTransfers();
    else if (currentPage === "adjustments") renderAdjustments();
    else if (currentPage === "ledger" || currentPage === "move-history") renderLedger();
    else if (currentPage === "alerts") renderAlerts();
    else if (currentPage === "warehouses") renderWarehouses();
    else if (currentPage === "settings") renderSettings();
    else if (currentPage === "profile") renderProfile();
}

function updateAlertCount() {
    const alerts = getAlerts();
    const count = document.querySelector("#sidebar-alert-count");
    const dot = document.querySelector(".notification-dot");
    count.textContent = alerts.length;
    dot.style.display = alerts.length ? "block" : "none";
}

function getAlerts() {
    const alerts = [];
    state.products.forEach(p => {
        const stock = totalStock(p);
        if (stock === 0) alerts.push({ type: "danger", title: `${p.name} is out of stock`, detail: `SKU ${p.sku} needs immediate action.` });
        else if (stock <= p.reorder) alerts.push({ type: "warning", title: `${p.name} is below reorder level`, detail: `Available: ${stock} ${p.unit}; reorder level: ${p.reorder}.` });
    });
    state.receipts.filter(r => r.status === "Waiting").forEach(r => alerts.push({ type: "warning", title: `${r.id} is awaiting validation`, detail: `${productById(r.productId)?.name || "Product"} from ${r.supplier}.` }));
    state.deliveries.filter(d => d.status !== "Done").forEach(d => alerts.push({ type: "warning", title: `${d.id} is still in progress`, detail: `Current stage: ${d.status}.` }));
    return alerts;
}

function dashboardLedgerFilters() {
    return `
    <div class="filter-bar">
        <strong class="filter-title">Filters</strong>
        <select id="dash-doc"><option>All Document Types</option><option>Receipt</option><option>Delivery</option><option>Transfer</option><option>Adjustment</option></select>
        <select id="dash-status"><option>All Statuses</option><option>Waiting</option><option>Validated</option><option>Picked</option><option>Packed</option><option>Done</option><option>Applied</option></select>
        <select id="dash-location"><option>All Warehouses</option>${optionList(uniqueLocations())}</select>
        <select id="dash-category"><option>All Categories</option>${optionList([...new Set(state.products.map(p => p.category))])}</select>
    </div>`;
}

function renderDashboard() {
    setPageHeader("Dashboard", "Overview of your inventory operations");
    const total = state.products.reduce((sum, p) => sum + totalStock(p), 0);
    const low = state.products.filter(p => totalStock(p) > 0 && totalStock(p) <= p.reorder).length;
    const out = state.products.filter(p => totalStock(p) === 0).length;
    const pendingReceipts = state.receipts.filter(r => r.status === "Waiting").length;
    const pendingDeliveries = state.deliveries.filter(d => d.status !== "Done").length;
    const pendingTransfers = state.transfers.filter(t => t.status !== "Done").length;
    const healthyPct = state.products.length ? Math.round((state.products.filter(p => totalStock(p) > p.reorder).length / state.products.length) * 100) : 0;
    const attention = low + out;

    appPage.innerHTML = `<section class="page">
        <div class="kpi-grid">
            ${kpi("Total Stock", total, "Current quantity across locations", "□")}
            ${kpi("Low / Out of Stock", attention, `${low} low · ${out} out of stock`, "!")}
            ${kpi("Pending Receipts", pendingReceipts, "Awaiting validation", "↓")}
            ${kpi("Pending Deliveries", pendingDeliveries, "Outgoing operations in progress", "↑")}
            ${kpi("Transfers Scheduled", pendingTransfers, "Internal moves awaiting completion", "↔")}
        </div>
        <div class="dashboard-banner"><div><strong>Inventory control center</strong><p>Monitor stock health and move inventory from one centralized workspace.</p></div><span class="status status-healthy">SYSTEM READY</span></div>
        <div class="panel"><div class="panel-header"><div><h3>Quick Actions</h3><p>Jump straight into the most common inventory operations.</p></div></div><div class="quick-actions">
            <button class="quick-action" data-quick-page="products"><strong>+ Add Product</strong><span>Create a new SKU</span></button>
            <button class="quick-action" data-quick-page="receipts"><strong>↓ New Receipt</strong><span>Receive vendor stock</span></button>
            <button class="quick-action" data-quick-page="deliveries"><strong>↑ New Delivery</strong><span>Process an outgoing order</span></button>
            <button class="quick-action" data-quick-page="transfers"><strong>↔ New Transfer</strong><span>Move stock internally</span></button>
        </div></div>
        ${dashboardLedgerFilters()}
        <div class="dashboard-grid">
            <div class="panel"><div class="panel-header"><div><h3>Stock Health</h3><p>Inventory condition across all products</p></div></div><div class="stock-health-content"><div class="health-circle"><strong>${healthyPct}%</strong><span>Healthy</span></div><div class="health-details">
                <div class="health-item"><span class="health-indicator healthy"></span><div><strong>${state.products.filter(p => totalStock(p) > p.reorder).length} healthy</strong><p>Above reorder level</p></div></div>
                <div class="health-item"><span class="health-indicator low"></span><div><strong>${low} low</strong><p>Need attention</p></div></div>
                <div class="health-item"><span class="health-indicator danger"></span><div><strong>${out} out</strong><p>No stock available</p></div></div>
            </div></div></div>
            <div class="panel"><div class="panel-header"><div><h3>Operations Pipeline</h3><p>Live workload summary</p></div></div><div class="pipeline">
                <div class="step"><span class="step-number">${state.receipts.filter(r=>r.status==='Waiting').length}</span><strong>Receipts</strong></div><div class="step-line"></div>
                <div class="step"><span class="step-number">${pendingDeliveries}</span><strong>Deliveries</strong></div><div class="step-line"></div>
                <div class="step"><span class="step-number">${pendingTransfers}</span><strong>Transfers</strong></div><div class="step-line"></div>
                <div class="step"><span class="step-number">${state.adjustments.filter(a=>a.status==='Applied').length}</span><strong>Adjustments</strong></div>
            </div></div>
        </div>
        <div class="panel"><div class="panel-header"><div><h3>Low Stock Items</h3><p>Products that need attention</p></div><button class="text-button" data-page-action="products">View Products</button></div>${renderLowStockTable()}</div>
        <div class="panel"><div class="panel-header"><div><h3>Recent Stock Movements</h3><p>Latest inventory activity</p></div><button class="text-button" data-page-action="ledger">View Ledger</button></div>${renderLedgerTable(getFilteredLedger())}</div>
    </section>`;

    ["#dash-doc", "#dash-status", "#dash-location", "#dash-category"].forEach(selector => {
        const el = document.querySelector(selector); if (el) el.addEventListener("change", renderDashboard);
    });
    animateCounters();
}

function getFilteredLedger() {
    let rows = [...state.ledger].sort((a,b)=>new Date(b.date)-new Date(a.date));
    const doc = document.querySelector("#dash-doc")?.value || "All Document Types";
    const status = document.querySelector("#dash-status")?.value || "All Statuses";
    const location = document.querySelector("#dash-location")?.value || "All Warehouses";
    const category = document.querySelector("#dash-category")?.value || "All Categories";
    if (doc !== "All Document Types") rows = rows.filter(r => r.type === doc);
    if (location !== "All Warehouses") rows = rows.filter(r => r.location === location || r.from === location || r.to === location);
    if (category !== "All Categories") rows = rows.filter(r => productById(r.productId)?.category === category);
    if (status !== "All Statuses") {
        rows = rows.filter(r => {
            if (r.type === "Receipt") return state.receipts.some(x=>x.id===r.ref && x.status===status);
            if (r.type === "Delivery") return state.deliveries.some(x=>x.id===r.ref && x.status===status);
            if (r.type === "Transfer") return state.transfers.some(x=>x.id===r.ref && x.status===status);
            if (r.type === "Adjustment") return state.adjustments.some(x=>x.id===r.ref && x.status===status);
            return true;
        });
    }
    return rows;
}

function renderLowStockTable() {
    const rows = state.products.filter(p => totalStock(p) <= p.reorder);
    if (!rows.length) return `<div class="empty">No low-stock products.</div>`;
    return `<div class="table-wrapper"><table><thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Reorder</th><th>Locations</th><th>Status</th></tr></thead><tbody>${rows.map(p => { const s=statusForProduct(p); return `<tr><td><strong>${p.name}</strong></td><td>${p.sku}</td><td>${totalStock(p)} ${p.unit}</td><td>${p.reorder}</td><td>${Object.keys(p.locations).join(", ")}</td><td>${statusBadge(s.text)}</td></tr>`; }).join("")}</tbody></table></div>`;
}

function renderLedgerTable(rows) {
    if (!rows.length) return `<div class="empty">No stock movements match the selected filters.</div>`;
    return `<div class="movement-list">${rows.slice(0,6).map(r => `<div class="movement-item"><div class="movement-icon ${r.type==='Receipt'?'movement-in':r.type==='Delivery'?'movement-out':r.type==='Transfer'?'movement-transfer':'movement-adjustment'}">${r.type==='Receipt'?'↓':r.type==='Delivery'?'↑':r.type==='Transfer'?'↔':'±'}</div><div class="movement-info"><strong>${r.type} ${r.ref ? `#${r.ref}` : ""}</strong><p>${productById(r.productId)?.name || "Product"} · ${r.note}</p></div><span class="movement-time">${formatDate(r.date)}</span></div>`).join("")}</div>`;
}

function kpi(title, value, desc, icon) { return `<div class="kpi-card"><div class="kpi-card-top"><span>${title}</span><span class="kpi-icon">${icon}</span></div><h3 data-count="${Number(value) || 0}">0</h3><p>${desc}</p></div>`; }

function renderProducts() {
    setPageHeader("Products", "Create, update and monitor inventory by location");
    appPage.innerHTML = `<section class="page"><div class="page-header"><div><h2>Products</h2><p>Central product catalog with stock availability, categories and reorder rules.</p></div><button class="primary-button" id="add-product">+ Add Product</button></div><div class="panel"><div class="panel-header"><div><h3>Product Inventory</h3><p>Stock is tracked across warehouse locations.</p></div></div><div class="table-wrapper"><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Unit</th><th>Total Stock</th><th>Locations</th><th>Reorder</th><th>Status</th><th>Actions</th></tr></thead><tbody>${state.products.filter(matchesSearch).map(p=>{const s=statusForProduct(p);return `<tr><td><strong>${p.name}</strong></td><td>${p.sku}</td><td>${p.category}</td><td>${p.unit}</td><td>${totalStock(p)}</td><td>${Object.entries(p.locations).map(([k,v])=>`${k}: ${v}`).join(" · ")}</td><td>${p.reorder}</td><td>${statusBadge(s.text)}</td><td><button class="small-button" data-edit-product="${p.id}">Edit</button><button class="small-button delete-product" data-delete-product="${p.id}">Delete</button></td></tr>`}).join("")}</tbody></table></div></div></section>`;
}

function matchesSearch(p) { if(!currentSearch) return true; const q=currentSearch.toLowerCase(); return `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(q); }

function renderReceipts() {
    setPageHeader("Receipts", "Incoming stock from vendors");
    const pending = state.receipts.filter(r=>r.status==='Waiting').length; const validated=state.receipts.filter(r=>r.status==='Validated').length;
    appPage.innerHTML = `<section class="page"><div class="page-header"><div><h2>Receipts</h2><p>Create receipts, validate incoming quantities and automatically increase stock.</p></div><button class="primary-button" id="new-receipt">+ New Receipt</button></div><div class="summary-grid"><div class="panel"><strong>Total Receipts</strong><h3>${state.receipts.length}</h3><p>All receipts recorded</p></div><div class="panel"><strong>Pending</strong><h3>${pending}</h3><p>Awaiting validation</p></div><div class="panel"><strong>Validated</strong><h3>${validated}</h3><p>Inventory already updated</p></div></div><div class="panel"><div class="panel-header"><div><h3>Incoming Stock</h3><p>Validate only after the received quantity is confirmed.</p></div></div>${renderReceiptsTable()}</div></section>`;
}

function renderReceiptsTable(){if(!state.receipts.length)return `<div class="empty">No receipts yet.</div>`;return `<div class="table-wrapper"><table><thead><tr><th>Receipt</th><th>Supplier</th><th>Product</th><th>Qty</th><th>Location</th><th>Status</th><th>Action</th></tr></thead><tbody>${state.receipts.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(r=>`<tr><td><strong>${r.id}</strong></td><td>${r.supplier}</td><td>${productById(r.productId)?.name||"Deleted product"}</td><td>${r.qty}</td><td>${r.location}</td><td>${statusBadge(r.status)}</td><td>${r.status==='Waiting'?`<button class="small-button" data-validate-receipt="${r.id}">Validate</button>`:'Completed'}</td></tr>`).join("")}</tbody></table></div>`;}

function renderDeliveries(){setPageHeader("Deliveries","Outgoing customer shipments");const pending=state.deliveries.filter(d=>d.status!=="Done").length;appPage.innerHTML=`<section class="page"><div class="page-header"><div><h2>Delivery Orders</h2><p>Pick, pack and validate outgoing stock.</p></div><button class="primary-button" id="new-delivery">+ New Delivery</button></div><div class="summary-grid"><div class="panel"><strong>Total Orders</strong><h3>${state.deliveries.length}</h3><p>Outgoing delivery records</p></div><div class="panel"><strong>In Progress</strong><h3>${pending}</h3><p>Not yet completed</p></div><div class="panel"><strong>Completed</strong><h3>${state.deliveries.length-pending}</h3><p>Stock already deducted</p></div></div><div class="panel"><div class="panel-header"><div><h3>Delivery Orders</h3><p>Validate only after pick and pack are complete.</p></div></div>${renderDeliveriesTable()}</div></section>`;}
function renderDeliveriesTable(){if(!state.deliveries.length)return `<div class="empty">No delivery orders yet.</div>`;return `<div class="table-wrapper"><table><thead><tr><th>Order</th><th>Customer</th><th>Product</th><th>Qty</th><th>Location</th><th>Status</th><th>Action</th></tr></thead><tbody>${state.deliveries.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(d=>`<tr><td><strong>${d.id}</strong></td><td>${d.customer}</td><td>${productById(d.productId)?.name||"Deleted product"}</td><td>${d.qty}</td><td>${d.location}</td><td>${statusBadge(d.status)}</td><td>${d.status!=='Done'?`<button class="small-button" data-progress-delivery="${d.id}">${d.status==='Picked'?'Mark Packed':d.status==='Packed'?'Validate':'Pick'}</button>`:'Completed'}</td></tr>`).join("")}</tbody></table></div>`;}

function renderTransfers(){setPageHeader("Transfers","Move stock between warehouses and internal locations");const pending=state.transfers.filter(t=>t.status!=="Done").length;appPage.innerHTML=`<section class="page"><div class="page-header"><div><h2>Internal Transfers</h2><p>Move stock without changing total inventory.</p></div><button class="primary-button" id="new-transfer">+ New Transfer</button></div><div class="summary-grid"><div class="panel"><strong>Total Transfers</strong><h3>${state.transfers.length}</h3><p>Movement records</p></div><div class="panel"><strong>Scheduled</strong><h3>${pending}</h3><p>Awaiting completion</p></div><div class="panel"><strong>Completed</strong><h3>${state.transfers.length-pending}</h3><p>Location stock updated</p></div></div><div class="panel"><div class="panel-header"><div><h3>Transfer History</h3><p>Each completed transfer updates source and destination quantities.</p></div></div><div class="table-wrapper"><table><thead><tr><th>Transfer</th><th>Product</th><th>Qty</th><th>From</th><th>To</th><th>Status</th><th>Action</th></tr></thead><tbody>${state.transfers.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t=>`<tr><td><strong>${t.id}</strong></td><td>${productById(t.productId)?.name||"Deleted product"}</td><td>${t.qty}</td><td>${t.from}</td><td>${t.to}</td><td>${statusBadge(t.status)}</td><td>${t.status!=='Done'?`<button class="small-button" data-validate-transfer="${t.id}">Validate</button>`:'Completed'}</td></tr>`).join("")}</tbody></table></div></div></section>`;}

function renderAdjustments(){setPageHeader("Adjustments","Reconcile recorded stock with physical counts");appPage.innerHTML=`<section class="page"><div class="page-header"><div><h2>Inventory Adjustments</h2><p>Correct stock mismatches and keep an audit trail.</p></div><button class="primary-button" id="new-adjustment">+ New Adjustment</button></div><div class="panel"><div class="panel-header"><div><h3>Adjustment History</h3><p>Physical count differences are recorded as stock movements.</p></div></div>${state.adjustments.length?`<div class="table-wrapper"><table><thead><tr><th>Adjustment</th><th>Product</th><th>Location</th><th>Previous</th><th>Physical</th><th>Difference</th><th>Reason</th><th>Status</th></tr></thead><tbody>${state.adjustments.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(a=>`<tr><td><strong>${a.id}</strong></td><td>${productById(a.productId)?.name||"Deleted product"}</td><td>${a.location}</td><td>${a.previous}</td><td>${a.physical}</td><td>${a.difference>0?'+':''}${a.difference}</td><td>${a.reason}</td><td>${statusBadge(a.status)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No stock adjustments yet.</div>`}</div></section>`;}

function renderLedger(){setPageHeader("Stock Ledger","Complete audit trail of inventory movements");appPage.innerHTML=`<section class="page"><div class="page-header"><div><h2>Stock Ledger</h2><p>Every validated receipt, delivery, transfer and adjustment is recorded here.</p></div><button class="secondary-button" id="export-ledger">Export CSV</button></div><div class="panel"><div class="table-wrapper"><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Product</th><th>Quantity</th><th>Location / Route</th><th>Details</th></tr></thead><tbody>${state.ledger.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(r=>`<tr><td>${formatDate(r.date)}</td><td>${r.type}</td><td>${r.ref||'-'}</td><td>${productById(r.productId)?.name||'Unknown'}</td><td>${r.qty}</td><td>${r.type==='Transfer'?`${r.from} → ${r.to}`:r.location||'-'}</td><td>${r.note}</td></tr>`).join("")}</tbody></table></div></div></section>`;}

function renderAlerts(){const alerts=getAlerts();setPageHeader("Alerts","Low-stock and operational warnings");appPage.innerHTML=`<section class="page"><div class="page-header"><div><h2>Inventory Alerts</h2><p>Issues that need attention before they affect operations.</p></div></div>${alerts.length?`<div class="alert-list">${alerts.map(a=>`<div class="alert-card"><div><strong>${a.title}</strong><p>${a.detail}</p></div>${a.type==='danger'?statusBadge('Out of Stock'):statusBadge('Attention')}</div>`).join("")}</div>`:`<div class="panel"><div class="empty">No active alerts. Inventory is within configured thresholds.</div></div>`}</section>`;}

function renderWarehouses(){const locs=uniqueLocations();const totals=locs.map(l=>({location:l,total:state.products.reduce((s,p)=>s+Number(p.locations?.[l]||0),0)}));const max=Math.max(...totals.map(x=>x.total),1);setPageHeader("Warehouses","Multi-location inventory visibility");appPage.innerHTML=`<section class="page"><div class="page-header"><div><h2>Warehouses & Locations</h2><p>See stock quantities distributed across internal locations.</p></div></div><div class="summary-grid">${totals.map(x=>`<div class="panel location-card"><h3>${x.location}</h3><p>Current stock</p><div class="location-total">${x.total}</div><div class="mini-bar"><span style="width:${Math.max(6,Math.round(x.total/max*100))}%"></span></div></div>`).join("")}</div><div class="panel"><div class="panel-header"><div><h3>Location Stock Detail</h3><p>Product quantities by warehouse/location.</p></div></div><div class="table-wrapper"><table><thead><tr><th>Product</th>${locs.map(l=>`<th>${l}</th>`).join("")}<th>Total</th></tr></thead><tbody>${state.products.map(p=>`<tr><td><strong>${p.name}</strong></td>${locs.map(l=>`<td>${p.locations?.[l]||0}</td>`).join("")}<td>${totalStock(p)}</td></tr>`).join("")}</tbody></table></div></div></section>`;}

function renderSettings(){setPageHeader("Settings","Application configuration");appPage.innerHTML=`<section class="page"><div class="page-header"><div><h2>Settings</h2><p>Manage the demo configuration and local inventory data.</p></div></div><div class="panel"><div class="panel-header"><div><h3>Demo Controls</h3><p>Data is stored in this browser using local storage.</p></div></div><div style="padding:20px;display:grid;gap:14px"><button class="secondary-button" id="reset-demo">Reset Demo Data</button><div class="notice">For the hackathon prototype, inventory changes are stored locally. A production version would connect these operations to a backend database and authentication service.</div></div></div></section>`;}

function renderProfile(){setPageHeader("My Profile","Inventory manager account");appPage.innerHTML=`<section class="page"><div class="page-header"><div><h2>My Profile</h2><p>Signed in as the inventory manager.</p></div></div><div class="panel"><div style="padding:22px;display:grid;gap:12px"><div><strong>Name</strong><p class="muted">Omkar</p></div><div><strong>Role</strong><p class="muted">Inventory Manager</p></div><div><strong>Workspace</strong><p class="muted">StockSense Demo</p></div><div class="notice">Authentication and OTP password recovery can be connected to a backend when the team adds server-side services.</div></div></div></section>`;}

function openModal(title, subtitle, content, submitHandler) {
    modalTitle.textContent = title; modalSubtitle.textContent = subtitle; modalContent.innerHTML = content; modalSubmit = submitHandler; modalOverlay.style.display = "flex";
}
function closeModal(){modalOverlay.style.display="none";modalSubmit=null;modalContent.innerHTML="";}

function productForm(){return `<form id="product-modal-form"><div class="form-grid"><div class="form-group"><label>Product Name</label><input name="name" required></div><div class="form-group"><label>SKU / Code</label><input name="sku" required></div><div class="form-group"><label>Category</label><select name="category" required>${optionList(["Raw Materials","Finished Goods","Equipment"])}</select></div><div class="form-group"><label>Unit of Measure</label><select name="unit" required>${optionList(["units","kg","litres","boxes"])}</select></div><div class="form-group"><label>Initial Stock</label><input name="stock" type="number" min="0" required></div><div class="form-group"><label>Reorder Level</label><input name="reorder" type="number" min="0" required></div></div><div class="form-actions"><button type="button" class="secondary-button" data-close-modal>Cancel</button><button type="submit" class="primary-button">Add Product</button></div></form>`;}

function receiptForm(){return `<form id="receipt-modal-form"><div class="form-grid"><div class="form-group"><label>Supplier</label><input name="supplier" required></div><div class="form-group"><label>Product</label><select name="productId" required>${productOptions()}</select></div><div class="form-group"><label>Quantity Received</label><input name="qty" type="number" min="1" required></div><div class="form-group"><label>Warehouse / Location</label><select name="location" required>${optionList(uniqueLocations())}</select></div></div><div class="form-actions"><button type="button" class="secondary-button" data-close-modal>Cancel</button><button type="submit" class="primary-button">Create Receipt</button></div></form>`;}

function deliveryForm(){return `<form id="delivery-modal-form"><div class="form-grid"><div class="form-group"><label>Customer</label><input name="customer" required></div><div class="form-group"><label>Product</label><select name="productId" required>${productOptions()}</select></div><div class="form-group"><label>Quantity</label><input name="qty" type="number" min="1" required></div><div class="form-group"><label>Warehouse / Location</label><select name="location" required>${optionList(uniqueLocations())}</select></div></div><div class="form-actions"><button type="button" class="secondary-button" data-close-modal>Cancel</button><button type="submit" class="primary-button">Create Delivery</button></div></form>`;}

function transferForm(){return `<form id="transfer-modal-form"><div class="form-grid"><div class="form-group"><label>Product</label><select name="productId" required>${productOptions()}</select></div><div class="form-group"><label>Quantity</label><input name="qty" type="number" min="1" required></div><div class="form-group"><label>From</label><select name="from" required>${optionList(uniqueLocations())}</select></div><div class="form-group"><label>To</label><select name="to" required>${optionList(uniqueLocations())}</select></div></div><div class="form-actions"><button type="button" class="secondary-button" data-close-modal>Cancel</button><button type="submit" class="primary-button">Create Transfer</button></div></form>`;}

function adjustmentForm(){return `<form id="adjustment-modal-form"><div class="form-grid"><div class="form-group"><label>Product</label><select name="productId" required>${productOptions()}</select></div><div class="form-group"><label>Location</label><select name="location" required>${optionList(uniqueLocations())}</select></div><div class="form-group"><label>Physical Count</label><input name="physical" type="number" min="0" required></div><div class="form-group"><label>Reason</label><select name="reason" required>${optionList(["Damaged","Counting mismatch","Lost stock","Other"])}</select></div></div><div class="form-actions"><button type="button" class="secondary-button" data-close-modal>Cancel</button><button type="submit" class="primary-button">Apply Adjustment</button></div></form>`;}

function openAddProduct(){openModal("Add Product","Create a product for your inventory.",productForm(),form=>{const f=new FormData(form);const name=f.get("name").trim();const sku=f.get("sku").trim();if(state.products.some(p=>p.sku.toLowerCase()===sku.toLowerCase())){notify("SKU already exists.", "error");return false;}state.products.push({id:Date.now(),name,sku,category:f.get("category"),unit:f.get("unit"),reorder:Number(f.get("reorder")),locations:{"Main Warehouse":Number(f.get("stock"))}});saveState();closeModal();notify("Product added successfully.");renderPage();});}
function openNewReceipt(){openModal("New Receipt","Record incoming stock from a supplier.",receiptForm(),form=>{const f=new FormData(form);state.receipts.push({id:nextNumber("REC",state.receipts),supplier:f.get("supplier").trim(),productId:Number(f.get("productId")),qty:Number(f.get("qty")),location:f.get("location"),status:"Waiting",date:new Date().toISOString()});saveState();closeModal();notify("Receipt created and is waiting for validation.");renderPage();});}
function openNewDelivery(){openModal("New Delivery","Create an outgoing customer shipment.",deliveryForm(),form=>{const f=new FormData(form);const p=productById(f.get("productId"));const qty=Number(f.get("qty"));const loc=f.get("location");if(Number(p.locations?.[loc]||0)<qty){notify(`Not enough stock at ${loc}. Available: ${p.locations?.[loc]||0}.`, "error");return false;}state.deliveries.push({id:nextNumber("DEL",state.deliveries),customer:f.get("customer").trim(),productId:Number(f.get("productId")),qty,location:loc,status:"Picked",date:new Date().toISOString()});saveState();closeModal();notify("Delivery created successfully.");renderPage();});}
function openNewTransfer(){openModal("New Internal Transfer","Move stock between locations.",transferForm(),form=>{const f=new FormData(form);if(f.get("from")===f.get("to")){notify("Source and destination must be different.", "error");return false;}const p=productById(f.get("productId"));const qty=Number(f.get("qty"));if(Number(p.locations?.[f.get("from")]||0)<qty){notify(`Not enough stock at ${f.get("from")}. Available: ${p.locations?.[f.get("from")]||0}.`, "error");return false;}state.transfers.push({id:nextNumber("TRF",state.transfers),productId:Number(f.get("productId")),qty,from:f.get("from"),to:f.get("to"),status:"Ready",date:new Date().toISOString()});saveState();closeModal();notify("Transfer created successfully.");renderPage();});}
function openNewAdjustment(){openModal("New Stock Adjustment","Match system quantity to the physical count.",adjustmentForm(),form=>{const f=new FormData(form);const p=productById(f.get("productId"));const loc=f.get("location");const previous=Number(p.locations?.[loc]||0);const physical=Number(f.get("physical"));state.adjustments.push({id:nextNumber("ADJ",state.adjustments),productId:Number(f.get("productId")),location:loc,previous,physical,difference:physical-previous,reason:f.get("reason"),status:"Applied",date:new Date().toISOString()});p.locations[loc]=physical;state.ledger.push({id:`LED-${Date.now()}`,type:"Adjustment",ref:state.adjustments.at(-1).id,productId:p.id,qty:Math.abs(physical-previous),location:loc,note:`${f.get("reason")}: ${previous} → ${physical}`,date:new Date().toISOString()});saveState();closeModal();notify("Stock adjustment applied successfully.");renderPage();});}

function validateReceipt(id){const r=state.receipts.find(x=>x.id===id);if(!r||r.status!=="Waiting")return;const p=productById(r.productId);p.locations[r.location]=Number(p.locations?.[r.location]||0)+Number(r.qty);r.status="Validated";state.ledger.push({id:`LED-${Date.now()}`,type:"Receipt",ref:r.id,productId:p.id,qty:r.qty,location:r.location,note:`Received from ${r.supplier}`,date:new Date().toISOString()});saveState();notify(`${r.id} validated successfully. Stock updated.`);renderPage();}
function progressDelivery(id){const d=state.deliveries.find(x=>x.id===id);if(!d)return;const p=productById(d.productId);if(d.status==="Picked"){d.status="Packed";saveState();notify(`${d.id} marked as packed.`);}else if(d.status==="Packed"){d.status="Done";p.locations[d.location]=Number(p.locations?.[d.location]||0)-Number(d.qty);state.ledger.push({id:`LED-${Date.now()}`,type:"Delivery",ref:d.id,productId:p.id,qty:d.qty,location:d.location,note:`Delivered to ${d.customer}`,date:new Date().toISOString()});saveState();notify(`${d.id} validated. Stock updated.`);}renderPage();}
function validateTransfer(id){const t=state.transfers.find(x=>x.id===id);if(!t||t.status==="Done")return;const p=productById(t.productId);if(Number(p.locations?.[t.from]||0)<Number(t.qty)){notify("Insufficient source stock.", "error");return;}p.locations[t.from]=Number(p.locations?.[t.from]||0)-Number(t.qty);p.locations[t.to]=Number(p.locations?.[t.to]||0)+Number(t.qty);t.status="Done";state.ledger.push({id:`LED-${Date.now()}`,type:"Transfer",ref:t.id,productId:p.id,qty:t.qty,from:t.from,to:t.to,note:"Internal transfer completed",date:new Date().toISOString()});saveState();notify(`${t.id} completed successfully. Stock moved.`);renderPage();}

function deleteProduct(id){const p=productById(id);if(!p)return;if(!confirm(`Delete ${p.name}?`))return;state.products=state.products.filter(x=>x.id!==id);saveState();notify(`${p.name} deleted.`);renderPage();}

function editProduct(id){const p=productById(id);if(!p)return;openModal("Edit Product","Update product details and stock threshold.",`<form id="edit-product-form"><div class="form-grid"><div class="form-group"><label>Product Name</label><input name="name" value="${p.name}" required></div><div class="form-group"><label>SKU / Code</label><input name="sku" value="${p.sku}" required></div><div class="form-group"><label>Category</label><select name="category">${optionList(["Raw Materials","Finished Goods","Equipment"],p.category)}</select></div><div class="form-group"><label>Unit</label><select name="unit">${optionList(["units","kg","litres","boxes"],p.unit)}</select></div><div class="form-group"><label>Reorder Level</label><input name="reorder" type="number" min="0" value="${p.reorder}" required></div></div><div class="notice">Stock quantity is managed through receipts, deliveries, transfers and adjustments.</div><div class="form-actions"><button type="button" class="secondary-button" data-close-modal>Cancel</button><button class="primary-button" type="submit">Save Changes</button></div></form>`,form=>{const f=new FormData(form);p.name=f.get("name").trim();p.sku=f.get("sku").trim();p.category=f.get("category");p.unit=f.get("unit");p.reorder=Number(f.get("reorder"));saveState();closeModal();notify("Product details updated.");renderPage();});}

function exportLedger(){const rows=[['Date','Type','Reference','Product','Quantity','Location/Route','Details'],...state.ledger.map(r=>[formatDate(r.date),r.type,r.ref||'',productById(r.productId)?.name||'',r.qty,r.type==='Transfer'?`${r.from} -> ${r.to}`:r.location||'',r.note])];const csv=rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='stocksense-ledger.csv';a.click();URL.revokeObjectURL(url);notify("Ledger exported as CSV.", "info");}

document.addEventListener("click", e=>{
    const authModeButton = e.target.closest("[data-auth-mode]");
    if (authModeButton) { handleAuthMode(authModeButton.dataset.authMode); return; }
    if (e.target.matches("[data-demo-login]")) {
        const email = document.querySelector('#login-form input[name="email"]');
        const password = document.querySelector('#login-form input[name="password"]');
        if (email) email.value = DEMO_USER.email;
        if (password) password.value = getDemoPassword();
        document.querySelector("#login-form")?.requestSubmit();
        return;
    }
    const quick = e.target.closest("[data-quick-page]");
    if (quick) {
        currentPage = quick.dataset.quickPage;
        currentSearch = "";
        document.querySelector("#global-search").value = "";
        renderPage();
        return;
    }
    const nav=e.target.closest(".nav-link[data-page]");
    if(nav){e.preventDefault();currentPage=nav.dataset.page;currentSearch="";document.querySelector("#global-search").value="";renderPage();return;}
    const action=e.target.closest("[data-page-action]"); if(action){currentPage=action.dataset.pageAction;renderPage();return;}
    if(e.target.matches("#add-product"))openAddProduct();
    if(e.target.matches("#new-receipt"))openNewReceipt();
    if(e.target.matches("#new-delivery"))openNewDelivery();
    if(e.target.matches("#new-transfer"))openNewTransfer();
    if(e.target.matches("#new-adjustment"))openNewAdjustment();
    if(e.target.matches("[data-validate-receipt]"))validateReceipt(e.target.dataset.validateReceipt);
    if(e.target.matches("[data-progress-delivery]"))progressDelivery(e.target.dataset.progressDelivery);
    if(e.target.matches("[data-validate-transfer]"))validateTransfer(e.target.dataset.validateTransfer);
    if(e.target.matches("[data-delete-product]"))deleteProduct(Number(e.target.dataset.deleteProduct));
    if(e.target.matches("[data-edit-product]"))editProduct(Number(e.target.dataset.editProduct));
    if(e.target.matches("#export-ledger"))exportLedger();
    if(e.target.matches("#header-alert-button")){currentPage="alerts";renderPage();}
    if(e.target.matches("#reset-demo")){if(confirm("Reset all demo inventory data?")){localStorage.removeItem(STORAGE_KEY);state=loadState();notify("Demo data has been reset.", "info");renderPage();}}
    if(e.target.matches("#logout-link")){e.preventDefault();clearAuthUser();notify("You have been signed out.", "info");showAuth();}
    if(e.target.matches("[data-close-modal]"))closeModal();
});

document.addEventListener("submit", e=>{
    if (e.target.id === "login-form") { e.preventDefault(); handleLogin(e.target); return; }
    if (e.target.id === "signup-form") { e.preventDefault(); handleSignup(e.target); return; }
    if (e.target.id === "reset-email-form") { e.preventDefault(); handleResetEmail(e.target); return; }
    if (e.target.id === "reset-otp-form") { e.preventDefault(); handleResetOtp(e.target); return; }
    if(!modalSubmit)return;
    const handled=["product-modal-form","receipt-modal-form","delivery-modal-form","transfer-modal-form","adjustment-modal-form","edit-product-form"];
    if(!handled.includes(e.target.id))return;
    e.preventDefault();
    const button=e.target.querySelector("button[type=submit]");
    const originalText=button?.textContent || "Save";
    if(button){button.disabled=true;button.classList.add("is-loading");button.textContent="Processing…";}
    const result=modalSubmit(e.target);
    if(result!==false){closeModal();}
    else if(button){button.disabled=false;button.classList.remove("is-loading");button.textContent=originalText;}
});

modalOverlay.addEventListener("click",e=>{if(e.target===modalOverlay)closeModal();});
document.querySelector("#modal-close").addEventListener("click",closeModal);

document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modalOverlay.style.display === "flex") closeModal();
    if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        document.querySelector("#global-search")?.focus();
    }
});

document.querySelector("#global-search").addEventListener("input",e=>{currentSearch=e.target.value;renderPage();});

if (getAuthUser()) showApp(); else showAuth();
