/**
 * StockFlow Application Core JavaScript
 * Enterprise Inventory & Billing Management Client
 */

// Navigation structure with icons
const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-3-line' },
  { id: 'products', label: 'Products', icon: 'ri-archive-line' },
  { id: 'categories', label: 'Categories', icon: 'ri-price-tag-3-line' },
  { id: 'suppliers', label: 'Suppliers', icon: 'ri-truck-line' },
  { id: 'customers', label: 'Customers', icon: 'ri-user-star-line' },
  { id: 'employees', label: 'Employees', icon: 'ri-team-line' },
  { id: 'bill', label: 'Billing / POS', icon: 'ri-file-list-3-line' },
  { id: 'low-stock', label: 'Low Stock Alerts', icon: 'ri-alarm-warning-line', badge: true }
];

let activePage = 'dashboard';
let cachedData = {};

// DOM Elements
const app = document.querySelector('#app');
const sidebarNav = document.querySelector('#sidebarNav');
const breadcrumbTitle = document.querySelector('#breadcrumbTitle');
const sidebar = document.querySelector('#sidebar');
const menuToggleBtn = document.querySelector('#menuToggleBtn');
const mobileCloseBtn = document.querySelector('#mobileCloseBtn');
const liveClock = document.querySelector('#liveClock');
const quickNewBillBtn = document.querySelector('#quickNewBillBtn');
const toastContainer = document.querySelector('#toastContainer');

// Modal Elements
const modalBackdrop = document.querySelector('#modalBackdrop');
const modalTitle = document.querySelector('#modalTitle');
const modalIcon = document.querySelector('#modalIcon');
const modalBody = document.querySelector('#modalBody');
const modalCloseBtn = document.querySelector('#modalCloseBtn');

// Invoice Modal Elements
const invoiceModalBackdrop = document.querySelector('#invoiceModalBackdrop');
const invoiceContent = document.querySelector('#invoiceContent');
const invoiceCloseBtn = document.querySelector('#invoiceCloseBtn');

// Helpers
const escapeHtml = value => value == null ? '' : String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Update Live Clock
function startClock() {
  const update = () => {
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString('en-US', { hour12: false });
  };
  update();
  setInterval(update, 1000);
}
startClock();

// Toast Notifications
function toast(message, type = 'success') {
  const toastEl = document.createElement('div');
  toastEl.className = `toast ${type}`;
  const icon = type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill';
  toastEl.innerHTML = `<i class="${icon}"></i> <span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toastEl);
  setTimeout(() => {
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateX(100%)';
    toastEl.style.transition = 'all 0.25s ease';
    setTimeout(() => toastEl.remove(), 250);
  }, 3500);
}

// API Client
async function api(path, options = {}) {
  try {
    const response = await fetch(`/api/${path}`, options);
    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(data.error || 'Request failed with server error');
    }
    return data;
  } catch (err) {
    throw err;
  }
}

function formBody(form) {
  return new URLSearchParams(new FormData(form));
}

// Sidebar Setup
function initSidebar() {
  sidebarNav.innerHTML = '';
  navigationItems.forEach(item => {
    const button = document.createElement('button');
    button.className = `nav-link ${item.id === activePage ? 'active' : ''}`;
    button.setAttribute('data-target', item.id);
    button.innerHTML = `
      <i class="${item.icon}"></i>
      <span>${item.label}</span>
      ${item.badge ? `<span class="nav-badge" id="sidebarLowStockBadge" style="display:none">0</span>` : ''}
    `;
    button.addEventListener('click', () => {
      show(item.id);
      sidebar.classList.remove('open');
    });
    sidebarNav.appendChild(button);
  });
}

// Update Active Nav Link
function setActiveNav(pageId) {
  activePage = pageId;
  const current = navigationItems.find(item => item.id === pageId);
  breadcrumbTitle.textContent = current ? current.label : pageId;
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-target') === pageId);
  });
}

// Mobile sidebar toggles
if (menuToggleBtn) menuToggleBtn.addEventListener('click', () => sidebar.classList.add('open'));
if (mobileCloseBtn) mobileCloseBtn.addEventListener('click', () => sidebar.classList.remove('open'));
if (quickNewBillBtn) quickNewBillBtn.addEventListener('click', () => show('bill'));

// Modal Helpers
function openModal(title, iconClass, contentHtml) {
  modalTitle.textContent = title;
  modalIcon.className = `${iconClass} modal-title-icon`;
  modalBody.innerHTML = contentHtml;
  modalBackdrop.classList.add('open');
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  modalBody.innerHTML = '';
}

modalCloseBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});

function openInvoiceModal(html) {
  invoiceContent.innerHTML = html;
  invoiceModalBackdrop.classList.add('open');
}

invoiceCloseBtn.addEventListener('click', () => {
  invoiceModalBackdrop.classList.remove('open');
});
invoiceModalBackdrop.addEventListener('click', (e) => {
  if (e.target === invoiceModalBackdrop) invoiceModalBackdrop.classList.remove('open');
});

// Update low stock badge
async function checkLowStockBadge() {
  try {
    const data = await api('dashboard');
    const badge = document.querySelector('#sidebarLowStockBadge');
    if (badge) {
      if (data.lowStock > 0) {
        badge.textContent = data.lowStock;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (e) {
    // silently ignore background badge check
  }
}

// Page Router
async function show(page) {
  setActiveNav(page);
  checkLowStockBadge();
  try {
    if (page === 'dashboard') return await renderDashboard();
    if (page === 'products') return await renderProducts(false);
    if (page === 'low-stock') return await renderProducts(true);
    if (page === 'bill') return await renderBillPage();
    return await renderMasterPage(page);
  } catch (error) {
    app.innerHTML = `
      <div class="panel">
        <div class="empty-state">
          <div class="empty-state-icon" style="color:var(--color-danger); background:var(--color-danger-light)">
            <i class="ri-error-warning-line"></i>
          </div>
          <h4>Failed to load data</h4>
          <p>${escapeHtml(error.message)}</p>
          <button class="btn btn-secondary btn-sm" style="margin-top:16px" onclick="show('${page}')">
            <i class="ri-refresh-line"></i> Try Again
          </button>
        </div>
      </div>
    `;
  }
}

// ==========================================================================
// 1. DASHBOARD VIEW
// ==========================================================================
async function renderDashboard() {
  app.innerHTML = `
    <div style="padding: 40px; text-align: center; color: var(--text-muted)">
      <i class="ri-loader-4-line ri-spin" style="font-size: 2rem;"></i>
      <p style="margin-top: 10px;">Loading dashboard analytics...</p>
    </div>
  `;

  const [data, productsList] = await Promise.all([
    api('dashboard'),
    api('products')
  ]);

  const cards = [
    { label: 'Total Products', value: data.products, icon: 'ri-archive-line', color: '#3b82f6', bg: '#eff6ff', trend: 'Catalog items' },
    { label: 'Registered Customers', value: data.customers, icon: 'ri-user-star-line', color: '#10b981', bg: '#ecfdf5', trend: 'Active clients' },
    { label: 'Active Suppliers', value: data.suppliers, icon: 'ri-truck-line', color: '#8b5cf6', bg: '#f5f3ff', trend: 'Vendors on board' },
    { label: 'Low Stock Alerts', value: data.lowStock, icon: 'ri-alarm-warning-line', color: '#ef4444', bg: '#fef2f2', trend: data.lowStock > 0 ? 'Needs reorder' : 'Healthy inventory' }
  ];

  // Calculate quick metrics
  const totalStockUnits = productsList.reduce((acc, p) => acc + (p.stock || 0), 0);
  const totalInventoryValue = productsList.reduce((acc, p) => acc + ((p.stock || 0) * (Number(p.price) || 0)), 0);

  app.innerHTML = `
    <div class="view-header">
      <div class="view-title-group">
        <h2>Dashboard Overview</h2>
        <p>Monitor your inventory health, supplier relationships, and operational metrics.</p>
      </div>
      <div class="view-actions">
        <button class="btn btn-secondary btn-sm" onclick="renderDashboard()">
          <i class="ri-refresh-line"></i> Refresh
        </button>
        <button class="btn btn-primary btn-sm" onclick="show('bill')">
          <i class="ri-add-line"></i> New Bill
        </button>
      </div>
    </div>

    <div class="stats-grid">
      ${cards.map(c => `
        <div class="stat-card" style="--stat-accent: ${c.color}; --stat-bg: ${c.bg};">
          <div class="stat-meta">
            <span class="stat-label">${c.label}</span>
            <span class="stat-value">${c.value}</span>
            <span class="stat-trend"><i class="ri-information-line"></i> ${c.trend}</span>
          </div>
          <div class="stat-icon">
            <i class="${c.icon}"></i>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Inventory Quick Summary Cards -->
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px; margin-bottom:28px;">
      <div class="stat-card" style="--stat-accent: #06b6d4; --stat-bg: #ecfeff;">
        <div class="stat-meta">
          <span class="stat-label">Total Inventory Units</span>
          <span class="stat-value">${totalStockUnits}</span>
          <span class="stat-trend"><i class="ri-stack-line"></i> Across all categories</span>
        </div>
        <div class="stat-icon">
          <i class="ri-stack-fill"></i>
        </div>
      </div>
      <div class="stat-card" style="--stat-accent: #10b981; --stat-bg: #ecfdf5;">
        <div class="stat-meta">
          <span class="stat-label">Stock Valuation (Cost)</span>
          <span class="stat-value" style="font-size:1.8rem">${formatCurrency(totalInventoryValue)}</span>
          <span class="stat-trend"><i class="ri-money-dollar-circle-line"></i> Asset valuation</span>
        </div>
        <div class="stat-icon">
          <i class="ri-wallet-3-line"></i>
        </div>
      </div>
    </div>

    <!-- Quick Overview Table: Recent Products -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title-group">
          <i class="ri-archive-2-line" style="color:var(--color-primary)"></i>
          <h3>Inventory Stock Snapshot</h3>
          <span class="panel-count">${productsList.length} items</span>
        </div>
        <div class="panel-toolbar">
          <button class="btn btn-secondary btn-sm" onclick="show('products')">View Full Catalog <i class="ri-arrow-right-line"></i></button>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Supplier</th>
              <th>Unit Price</th>
              <th>Current Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${productsList.slice(0, 5).map(p => {
              const isLow = p.stock <= p.reorderLevel;
              const statusBadge = isLow
                ? `<span class="badge badge-danger"><i class="ri-alert-line"></i> Low Stock (${p.stock})</span>`
                : `<span class="badge badge-success"><i class="ri-check-line"></i> In Stock (${p.stock})</span>`;
              return `
                <tr>
                  <td><span style="font-family:var(--font-mono); font-weight:600">#${p.id}</span></td>
                  <td style="font-weight:600">${escapeHtml(p.name)}</td>
                  <td><span class="badge badge-gray">${escapeHtml(p.category || 'N/A')}</span></td>
                  <td>${escapeHtml(p.supplier || 'N/A')}</td>
                  <td style="font-family:var(--font-mono); font-weight:600">${formatCurrency(p.price)}</td>
                  <td>${p.stock} units</td>
                  <td>${statusBadge}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ==========================================================================
// 2. PRODUCTS VIEW (Catalog & Low Stock)
// ==========================================================================
async function renderProducts(isLowStockView) {
  const rows = await api(isLowStockView ? 'low-stock' : 'products');
  cachedData.products = rows;

  app.innerHTML = `
    <div class="view-header">
      <div class="view-title-group">
        <h2>${isLowStockView ? 'Low Stock Warnings' : 'Product Inventory Catalog'}</h2>
        <p>${isLowStockView ? 'Products currently at or below their designated reorder threshold.' : 'Manage inventory items, pricing, categories, and warehouse levels.'}</p>
      </div>
      <div class="view-actions">
        ${isLowStockView ? '' : `
          <button class="btn btn-primary" id="openAddProductModalBtn">
            <i class="ri-add-line"></i> Add New Product
          </button>
        `}
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title-group">
          <i class="${isLowStockView ? 'ri-alarm-warning-line' : 'ri-archive-line'}" style="color:${isLowStockView ? 'var(--color-danger)' : 'var(--color-primary)'}"></i>
          <h3>${isLowStockView ? 'Depleted Items List' : 'All Products'}</h3>
          <span class="panel-count" id="productCount">${rows.length} items</span>
        </div>
        <div class="panel-toolbar">
          <div class="search-box">
            <i class="ri-search-line"></i>
            <input type="text" id="productSearchInput" placeholder="Filter by product name, category...">
          </div>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="data-table" id="productTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Supplier</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Reorder Level</th>
              <th>Status</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody id="productTableBody">
            ${renderProductRows(rows, isLowStockView)}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Search filtering
  const searchInput = document.querySelector('#productSearchInput');
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = rows.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.supplier && p.supplier.toLowerCase().includes(q))
    );
    document.querySelector('#productTableBody').innerHTML = renderProductRows(filtered, isLowStockView);
    document.querySelector('#productCount').textContent = `${filtered.length} items`;
    bindProductActions(filtered);
  });

  // Add Product Button
  if (!isLowStockView) {
    document.querySelector('#openAddProductModalBtn').addEventListener('click', async () => {
      await showAddProductModal();
    });
  }

  bindProductActions(rows);
}

function renderProductRows(list, isLowStockView) {
  if (!list.length) {
    return `
      <tr>
        <td colspan="9">
          <div class="empty-state">
            <div class="empty-state-icon"><i class="ri-inbox-line"></i></div>
            <h4>No products found</h4>
            <p>${isLowStockView ? 'All inventory levels are healthy and above reorder threshold.' : 'No items match your search or have been added yet.'}</p>
          </div>
        </td>
      </tr>
    `;
  }

  return list.map(item => {
    const isLow = item.stock <= item.reorderLevel;
    const status = isLow
      ? `<span class="badge badge-danger"><i class="ri-error-warning-line"></i> Low Stock</span>`
      : `<span class="badge badge-success"><i class="ri-checkbox-circle-line"></i> Healthy</span>`;

    return `
      <tr data-id="${item.id}">
        <td><span style="font-family:var(--font-mono); font-weight:600">#${item.id}</span></td>
        <td style="font-weight:600; color:var(--text-main)">${escapeHtml(item.name)}</td>
        <td><span class="badge badge-gray">${escapeHtml(item.category || 'None')}</span></td>
        <td>${escapeHtml(item.supplier || 'None')}</td>
        <td style="font-family:var(--font-mono); font-weight:600">${formatCurrency(item.price)}</td>
        <td style="font-weight:700; color:${isLow ? 'var(--color-danger)' : 'var(--text-main)'}">${item.stock}</td>
        <td>${item.reorderLevel}</td>
        <td>${status}</td>
        <td style="text-align:right">
          <div class="actions-cell" style="justify-content: flex-end;">
            <button class="btn-icon" data-edit-product="${item.id}" title="Edit product">
              <i class="ri-pencil-line"></i>
            </button>
            <button class="btn-icon delete" data-delete-product="${item.id}" title="Delete product">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function bindProductActions(list) {
  document.querySelectorAll('[data-edit-product]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-edit-product');
      const item = list.find(r => String(r.id) === id);
      if (item) await showEditProductModal(item);
    });
  });

  document.querySelectorAll('[data-delete-product]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete-product');
      if (!confirm(`Are you sure you want to delete Product #${id}? This action cannot be undone.`)) return;
      try {
        await api(`products/${id}`, { method: 'DELETE' });
        toast('Product deleted successfully');
        show('products');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}

async function showAddProductModal() {
  const [categories, suppliers] = await Promise.all([api('categories'), api('suppliers')]);
  const content = `
    <form id="newProductModalForm">
      <div class="form-grid">
        <div class="form-group col-span-2">
          <label>Product Name *</label>
          <input name="name" required placeholder="e.g. Wireless Ergonomic Mouse">
        </div>
        <div class="form-group">
          <label>Category *</label>
          <select name="categoryId" required>
            ${categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Supplier *</label>
          <select name="supplierId" required>
            ${suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Unit Price (₹) *</label>
          <input name="price" type="number" step="0.01" min="0" required placeholder="0.00">
        </div>
        <div class="form-group">
          <label>Opening Stock *</label>
          <input name="stock" type="number" min="0" required placeholder="10">
        </div>
        <div class="form-group col-span-2">
          <label>Reorder Alert Threshold *</label>
          <input name="reorderLevel" type="number" min="0" required placeholder="5">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary"><i class="ri-check-line"></i> Save Product</button>
      </div>
    </form>
  `;
  openModal('Add New Product', 'ri-archive-line', content);

  document.querySelector('#newProductModalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('products', { method: 'POST', body: formBody(e.target) });
      closeModal();
      toast('Product created successfully');
      show('products');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function showEditProductModal(item) {
  const [categories, suppliers] = await Promise.all([api('categories'), api('suppliers')]);
  const content = `
    <form id="editProductModalForm">
      <div class="form-grid">
        <div class="form-group col-span-2">
          <label>Product Name *</label>
          <input name="name" value="${escapeHtml(item.name)}" required>
        </div>
        <div class="form-group">
          <label>Category *</label>
          <select name="categoryId" required>
            ${categories.map(c => `<option value="${c.id}" ${c.name === item.category ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Supplier *</label>
          <select name="supplierId" required>
            ${suppliers.map(s => `<option value="${s.id}" ${s.name === item.supplier ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Unit Price (₹) *</label>
          <input name="price" type="number" step="0.01" min="0" value="${item.price}" required>
        </div>
        <div class="form-group">
          <label>Current Stock *</label>
          <input name="stock" type="number" min="0" value="${item.stock}" required>
        </div>
        <div class="form-group col-span-2">
          <label>Reorder Threshold *</label>
          <input name="reorderLevel" type="number" min="0" value="${item.reorderLevel}" required>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary"><i class="ri-check-line"></i> Update Changes</button>
      </div>
    </form>
  `;
  openModal(`Edit Product #${item.id}`, 'ri-pencil-line', content);

  document.querySelector('#editProductModalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`products/${item.id}`, { method: 'PUT', body: formBody(e.target) });
      closeModal();
      toast('Product updated successfully');
      show('products');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ==========================================================================
// 3. MASTER CRUD PAGES (Categories, Suppliers, Customers, Employees)
// ==========================================================================
const masterDefinitions = {
  categories: {
    title: 'Categories',
    singular: 'Category',
    icon: 'ri-price-tag-3-line',
    fields: [
      { name: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'e.g. Computers & Laptops' }
    ],
    headers: ['ID', 'Category Name']
  },
  suppliers: {
    title: 'Suppliers',
    singular: 'Supplier',
    icon: 'ri-truck-line',
    fields: [
      { name: 'name', label: 'Company / Supplier Name', type: 'text', required: true, placeholder: 'e.g. Acme Components' },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true, placeholder: '+91 9876543210' },
      { name: 'address', label: 'Office Address', type: 'text', required: false, placeholder: 'City, State' }
    ],
    headers: ['ID', 'Supplier Name', 'Phone', 'Address']
  },
  customers: {
    title: 'Customers',
    singular: 'Customer',
    icon: 'ri-user-star-line',
    fields: [
      { name: 'firstName', label: 'First Name', type: 'text', required: true, placeholder: 'John' },
      { name: 'lastName', label: 'Last Name', type: 'text', required: true, placeholder: 'Doe' },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true, placeholder: '+91 9876543210' },
      { name: 'email', label: 'Email Address', type: 'email', required: false, placeholder: 'john@example.com' }
    ],
    headers: ['ID', 'First Name', 'Last Name', 'Phone', 'Email']
  },
  employees: {
    title: 'Employees',
    singular: 'Employee',
    icon: 'ri-team-line',
    fields: [
      { name: 'firstName', label: 'First Name', type: 'text', required: true, placeholder: 'Jane' },
      { name: 'lastName', label: 'Last Name', type: 'text', required: true, placeholder: 'Smith' },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true, placeholder: '+91 9876511111' },
      { name: 'role', label: 'Job Role / Designation', type: 'text', required: true, placeholder: 'Cashier / Manager' }
    ],
    headers: ['ID', 'First Name', 'Last Name', 'Phone', 'Role']
  }
};

async function renderMasterPage(type) {
  const def = masterDefinitions[type];
  const rows = await api(type);
  cachedData[type] = rows;

  app.innerHTML = `
    <div class="view-header">
      <div class="view-title-group">
        <h2>${def.title} Management</h2>
        <p>Maintain directories, contact records, and system entities.</p>
      </div>
      <div class="view-actions">
        <button class="btn btn-primary" id="openAddMasterBtn">
          <i class="ri-add-line"></i> Add ${def.singular}
        </button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title-group">
          <i class="${def.icon}" style="color:var(--color-primary)"></i>
          <h3>All ${def.title}</h3>
          <span class="panel-count">${rows.length} records</span>
        </div>
        <div class="panel-toolbar">
          <div class="search-box">
            <i class="ri-search-line"></i>
            <input type="text" id="masterSearchInput" placeholder="Search ${def.title.toLowerCase()}...">
          </div>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              ${def.headers.map(h => `<th>${h}</th>`).join('')}
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody id="masterTableBody">
            ${renderMasterRows(type, def, rows)}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelector('#openAddMasterBtn').addEventListener('click', () => {
    showAddMasterModal(type, def);
  });

  const searchInput = document.querySelector('#masterSearchInput');
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = rows.filter(item =>
      Object.values(item).some(val => val && String(val).toLowerCase().includes(q))
    );
    document.querySelector('#masterTableBody').innerHTML = renderMasterRows(type, def, filtered);
    bindMasterActions(type, def, filtered);
  });

  bindMasterActions(type, def, rows);
}

function renderMasterRows(type, def, rows) {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="${def.headers.length + 1}">
          <div class="empty-state">
            <div class="empty-state-icon"><i class="ri-inbox-line"></i></div>
            <h4>No ${def.title.toLowerCase()} found</h4>
            <p>Click the Add ${def.singular} button to register a new entry.</p>
          </div>
        </td>
      </tr>
    `;
  }

  return rows.map(item => `
    <tr>
      ${Object.entries(item).map(([k, v]) => {
        if (k === 'id') return `<td><span style="font-family:var(--font-mono); font-weight:600">#${v}</span></td>`;
        if (k === 'role') return `<td><span class="badge badge-info">${escapeHtml(v)}</span></td>`;
        return `<td>${escapeHtml(v)}</td>`;
      }).join('')}
      <td style="text-align:right">
        <div class="actions-cell" style="justify-content: flex-end;">
          <button class="btn-icon" data-edit-master="${item.id}" title="Edit">
            <i class="ri-pencil-line"></i>
          </button>
          <button class="btn-icon delete" data-delete-master="${item.id}" title="Delete">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function bindMasterActions(type, def, rows) {
  document.querySelectorAll('[data-edit-master]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-master');
      const item = rows.find(r => String(r.id) === id);
      if (item) showEditMasterModal(type, def, item);
    });
  });

  document.querySelectorAll('[data-delete-master]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete-master');
      if (!confirm(`Are you sure you want to delete this ${def.singular}? Associated billing or product records may prevent deletion.`)) return;
      try {
        await api(`${type}/${id}`, { method: 'DELETE' });
        toast(`${def.singular} deleted successfully`);
        renderMasterPage(type);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}

function showAddMasterModal(type, def) {
  const content = `
    <form id="addMasterForm">
      <div class="form-grid">
        ${def.fields.map(f => `
          <div class="form-group ${def.fields.length === 1 ? 'col-span-2' : ''}">
            <label>${f.label} ${f.required ? '*' : ''}</label>
            <input name="${f.name}" type="${f.type || 'text'}" ${f.required ? 'required' : ''} placeholder="${f.placeholder || ''}">
          </div>
        `).join('')}
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary"><i class="ri-check-line"></i> Create ${def.singular}</button>
      </div>
    </form>
  `;
  openModal(`Add New ${def.singular}`, def.icon, content);

  document.querySelector('#addMasterForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(type, { method: 'POST', body: formBody(e.target) });
      closeModal();
      toast(`${def.singular} created successfully`);
      renderMasterPage(type);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function showEditMasterModal(type, def, item) {
  const content = `
    <form id="editMasterForm">
      <div class="form-grid">
        ${def.fields.map(f => `
          <div class="form-group ${def.fields.length === 1 ? 'col-span-2' : ''}">
            <label>${f.label} ${f.required ? '*' : ''}</label>
            <input name="${f.name}" type="${f.type || 'text'}" value="${escapeHtml(item[f.name] || '')}" ${f.required ? 'required' : ''}>
          </div>
        `).join('')}
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary"><i class="ri-check-line"></i> Save Changes</button>
      </div>
    </form>
  `;
  openModal(`Edit ${def.singular} #${item.id}`, 'ri-pencil-line', content);

  document.querySelector('#editMasterForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`${type}/${item.id}`, { method: 'PUT', body: formBody(e.target) });
      closeModal();
      toast(`${def.singular} updated successfully`);
      renderMasterPage(type);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ==========================================================================
// 4. POINT OF SALE / BILLING VIEW
// ==========================================================================
async function renderBillPage() {
  const [customers, employees, products] = await Promise.all([
    api('customers'),
    api('employees'),
    api('products')
  ]);

  let cartLines = [];

  app.innerHTML = `
    <div class="view-header">
      <div class="view-title-group">
        <h2>Point of Sale & Billing</h2>
        <p>Generate customer invoices, select inventory items, and automatically deduct stock.</p>
      </div>
    </div>

    <div class="pos-container">
      <!-- Left side: Selectors & Product Adders -->
      <div class="pos-catalog-panel">
        <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:18px; display:flex; align-items:center; gap:8px;">
          <i class="ri-shopping-cart-2-line" style="color:var(--color-primary)"></i>
          Invoice Header & Items
        </h3>

        <form id="posHeaderForm">
          <div class="form-grid" style="margin-bottom:20px;">
            <div class="form-group">
              <label>Select Customer *</label>
              <select id="billCustomerSelect" required>
                ${customers.map(c => `<option value="${c.id}">${escapeHtml(c.firstName + ' ' + c.lastName)} (${escapeHtml(c.phone || '')})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Billed By (Employee) *</label>
              <select id="billEmployeeSelect" required>
                ${employees.map(e => `<option value="${e.id}">${escapeHtml(e.firstName + ' ' + e.lastName)} &bull; ${escapeHtml(e.role)}</option>`).join('')}
              </select>
            </div>
          </div>
        </form>

        <div style="border-top:1px solid var(--border-light); padding-top:18px; margin-top:10px;">
          <h4 style="font-size:0.95rem; font-weight:600; margin-bottom:12px;">Add Product to Bill</h4>
          <div style="display:grid; grid-template-columns: 2fr 1fr auto; gap:12px; align-items:end;">
            <div class="form-group">
              <label>Choose Product</label>
              <select id="posProductSelect">
                ${products.map(p => `
                  <option value="${p.id}" data-price="${p.price}" data-stock="${p.stock}" data-name="${escapeHtml(p.name)}">
                    ${escapeHtml(p.name)} &bull; ${formatCurrency(p.price)} (Stock: ${p.stock})
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Quantity</label>
              <input type="number" id="posQuantityInput" min="1" value="1">
            </div>
            <button type="button" class="btn btn-secondary" id="posAddLineBtn" style="height:40px;">
              <i class="ri-add-line"></i> Add
            </button>
          </div>
        </div>

        <!-- Quick catalog grid (click to add) -->
        <div style="margin-top:28px;">
          <h4 style="font-size:0.85rem; font-weight:600; text-transform:uppercase; color:var(--text-muted); margin-bottom:12px;">
            Quick Pick Catalog
          </h4>
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:10px;">
            ${products.map(p => `
              <div class="quick-product-card" data-quick-id="${p.id}" style="padding:10px; background:#f8fafc; border:1px solid var(--border-light); border-radius:var(--radius-md); cursor:pointer; transition:all 0.15s ease;">
                <div style="font-size:0.85rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.name)}</div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                  <span style="font-family:var(--font-mono); font-size:0.82rem; font-weight:700; color:var(--color-primary);">${formatCurrency(p.price)}</span>
                  <span style="font-size:0.7rem; color:${p.stock > 0 ? 'var(--text-muted)' : 'var(--color-danger)'};">${p.stock} left</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Right side: Cart Summary & Checkout -->
      <div class="pos-order-summary">
        <div class="pos-summary-header">
          <h3 style="font-size:1.1rem; font-weight:700; display:flex; align-items:center; justify-content:space-between;">
            <span>Current Bill</span>
            <span class="badge badge-primary" id="cartItemCount">0 items</span>
          </h3>
        </div>

        <div class="order-items-list" id="cartItemsContainer">
          <div class="empty-state" style="padding:28px 0;">
            <div class="empty-state-icon" style="width:48px; height:48px; font-size:1.4rem;"><i class="ri-shopping-basket-line"></i></div>
            <h4 style="font-size:0.95rem;">Cart is empty</h4>
            <p style="font-size:0.8rem;">Select products from the left panel to begin.</p>
          </div>
        </div>

        <div class="pos-summary-totals">
          <div class="pos-total-row">
            <span>Subtotal</span>
            <span id="posSubtotal">₹0.00</span>
          </div>
          <div class="pos-total-row">
            <span>Tax / GST (0%)</span>
            <span>₹0.00</span>
          </div>
          <div class="pos-total-row grand-total">
            <span>Total Payable</span>
            <span id="posGrandTotal">₹0.00</span>
          </div>
        </div>

        <button class="btn btn-primary" id="checkoutBillBtn" style="width:100%; margin-top:20px; padding:12px; font-size:0.95rem;">
          <i class="ri-secure-payment-line"></i> Complete Order & Print
        </button>
      </div>
    </div>
  `;

  const posProductSelect = document.querySelector('#posProductSelect');
  const posQuantityInput = document.querySelector('#posQuantityInput');
  const posAddLineBtn = document.querySelector('#posAddLineBtn');
  const cartItemsContainer = document.querySelector('#cartItemsContainer');
  const cartItemCount = document.querySelector('#cartItemCount');
  const posSubtotal = document.querySelector('#posSubtotal');
  const posGrandTotal = document.querySelector('#posGrandTotal');
  const checkoutBillBtn = document.querySelector('#checkoutBillBtn');

  function renderCart() {
    if (!cartLines.length) {
      cartItemsContainer.innerHTML = `
        <div class="empty-state" style="padding:28px 0;">
          <div class="empty-state-icon" style="width:48px; height:48px; font-size:1.4rem;"><i class="ri-shopping-basket-line"></i></div>
          <h4 style="font-size:0.95rem;">Cart is empty</h4>
          <p style="font-size:0.8rem;">Select products from the left panel to begin.</p>
        </div>
      `;
      cartItemCount.textContent = '0 items';
      posSubtotal.textContent = '₹0.00';
      posGrandTotal.textContent = '₹0.00';
      return;
    }

    cartItemCount.textContent = `${cartLines.length} item${cartLines.length > 1 ? 's' : ''}`;
    let total = 0;

    cartItemsContainer.innerHTML = cartLines.map((line, idx) => {
      total += line.subtotal;
      return `
        <div class="order-item-card">
          <div class="order-item-info">
            <span class="order-item-title">${escapeHtml(line.name)}</span>
            <span class="order-item-meta">${formatCurrency(line.price)} &times; ${line.quantity}</span>
          </div>
          <div class="order-item-calc">
            <span class="order-item-subtotal">${formatCurrency(line.subtotal)}</span>
            <button class="btn-icon delete" style="width:26px; height:26px;" onclick="removeCartLine(${idx})">
              <i class="ri-close-line"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    posSubtotal.textContent = formatCurrency(total);
    posGrandTotal.textContent = formatCurrency(total);
  }

  window.removeCartLine = (index) => {
    cartLines.splice(index, 1);
    renderCart();
  };

  const addItemToCart = (prodId, quantity) => {
    const p = products.find(prod => String(prod.id) === String(prodId));
    if (!p) return;
    if (quantity <= 0) return toast('Quantity must be greater than 0', 'error');

    const existing = cartLines.find(line => String(line.id) === String(prodId));
    const currentInCart = existing ? existing.quantity : 0;

    if (currentInCart + quantity > p.stock) {
      return toast(`Cannot add ${quantity}. Only ${p.stock - currentInCart} remaining in stock!`, 'error');
    }

    if (existing) {
      existing.quantity += quantity;
      existing.subtotal = existing.quantity * existing.price;
    } else {
      cartLines.push({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        quantity: quantity,
        subtotal: Number(p.price) * quantity
      });
    }
    renderCart();
    toast(`Added ${p.name} to bill`);
  };

  posAddLineBtn.addEventListener('click', () => {
    const selectedOption = posProductSelect.selectedOptions[0];
    if (!selectedOption) return;
    addItemToCart(selectedOption.value, Number(posQuantityInput.value));
  });

  // Quick card click
  document.querySelectorAll('.quick-product-card').forEach(card => {
    card.addEventListener('click', () => {
      addItemToCart(card.getAttribute('data-quick-id'), 1);
    });
  });

  // Checkout Handler
  checkoutBillBtn.addEventListener('click', async () => {
    if (!cartLines.length) {
      return toast('Cart is empty. Please add items to proceed.', 'error');
    }

    const customerId = document.querySelector('#billCustomerSelect').value;
    const employeeId = document.querySelector('#billEmployeeSelect').value;
    const customerObj = customers.find(c => String(c.id) === String(customerId));
    const employeeObj = employees.find(e => String(e.id) === String(employeeId));

    const body = new URLSearchParams();
    body.set('customerId', customerId);
    body.set('employeeId', employeeId);
    body.set('productIds', cartLines.map(l => l.id).join(','));
    body.set('quantities', cartLines.map(l => l.quantity).join(','));

    try {
      checkoutBillBtn.disabled = true;
      checkoutBillBtn.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> Processing...`;

      const result = await api('bills', { method: 'POST', body });
      toast(`Bill #${result.billId} processed successfully!`);

      // Show Invoice Receipt Modal
      const totalAmount = result.total || cartLines.reduce((s, l) => s + l.subtotal, 0);
      const invoiceHtml = `
        <div class="invoice-header-row">
          <div class="invoice-logo">
            <h2><i class="ri-box-3-fill" style="color:var(--color-primary)"></i> StockFlow Retail</h2>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Inventory & Billing Suite &bull; GSTIN: 27AAAAA0000A1Z5</p>
          </div>
          <div class="invoice-badge">
            <h1 style="margin:0; font-size:1.4rem;">TAX INVOICE</h1>
            <p style="font-family:var(--font-mono); font-weight:700; color:var(--color-primary);">#INV-${String(result.billId).padStart(5, '0')}</p>
          </div>
        </div>

        <div class="invoice-details-grid">
          <div>
            <strong style="display:block; margin-bottom:4px; color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">Billed To:</strong>
            <div style="font-weight:700;">${escapeHtml(customerObj ? customerObj.firstName + ' ' + customerObj.lastName : 'Valued Customer')}</div>
            <div>Phone: ${escapeHtml(customerObj ? customerObj.phone : '-')}</div>
            <div>Email: ${escapeHtml(customerObj ? customerObj.email : '-')}</div>
          </div>
          <div>
            <strong style="display:block; margin-bottom:4px; color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">Invoice Info:</strong>
            <div>Date: ${new Date().toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' })}</div>
            <div>Billed By: ${escapeHtml(employeeObj ? employeeObj.firstName + ' ' + employeeObj.lastName : 'Staff')}</div>
            <div>Payment: Cash / Completed</div>
          </div>
        </div>

        <table class="data-table" style="margin-bottom:20px;">
          <thead>
            <tr>
              <th>Item Description</th>
              <th style="text-align:right">Rate</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${cartLines.map(line => `
              <tr>
                <td style="font-weight:600">${escapeHtml(line.name)}</td>
                <td style="text-align:right; font-family:var(--font-mono)">${formatCurrency(line.price)}</td>
                <td style="text-align:center">${line.quantity}</td>
                <td style="text-align:right; font-family:var(--font-mono); font-weight:700">${formatCurrency(line.subtotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display:flex; justify-content:flex-end;">
          <div style="min-width:240px; padding:12px; background:#f8fafc; border-radius:var(--radius-md);">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85rem;">
              <span>Subtotal:</span>
              <span>${formatCurrency(totalAmount)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:1.15rem; font-weight:800; border-top:1px solid var(--border-light); padding-top:8px;">
              <span>Total Paid:</span>
              <span style="color:var(--color-primary)">${formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

        <div style="margin-top:24px; text-align:center; font-size:0.75rem; color:var(--text-muted); border-top:1px solid var(--border-light); padding-top:16px;">
          Thank you for your business! For queries, contact support@stockflow.internal
        </div>
      `;

      openInvoiceModal(invoiceHtml);
      renderBillPage(); // Reset billing form
    } catch (err) {
      toast(err.message, 'error');
      checkoutBillBtn.disabled = false;
      checkoutBillBtn.innerHTML = `<i class="ri-secure-payment-line"></i> Complete Order & Print`;
    }
  });
}

// Initial Boot
initSidebar();
show('dashboard');
