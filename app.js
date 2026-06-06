const CONFIG = window.WARUNG_POS_CONFIG || {};
const isConfigured = CONFIG.supabaseUrl
  && CONFIG.supabaseAnonKey
  && !CONFIG.supabaseUrl.includes("ISI_")
  && !CONFIG.supabaseAnonKey.includes("ISI_");

const db = isConfigured
  ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey)
  : null;

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const state = {
  user: null,
  products: [],
  sales: [],
  cart: {},
  activeCategory: "Semua",
  currentReceipt: "",
  loading: false,
};

const sampleProducts = [
  { name: "Aqua 600 ml", category: "Minuman", price: 4000, cost: 2800, stock: 24, low_stock: 6 },
  { name: "Teh Botol", category: "Minuman", price: 5500, cost: 4000, stock: 18, low_stock: 5 },
  { name: "Indomie Goreng", category: "Makanan", price: 3500, cost: 2700, stock: 36, low_stock: 8 },
  { name: "Roti Cokelat", category: "Makanan", price: 4500, cost: 3200, stock: 10, low_stock: 4 },
  { name: "Sabun Mandi", category: "Alat Mandi", price: 6000, cost: 4300, stock: 7, low_stock: 3 },
  { name: "Bedak Tabur", category: "Kosmetik", price: 12000, cost: 8500, stock: 4, low_stock: 3 },
];

const els = {
  authScreen: document.querySelector("#authScreen"),
  appContent: document.querySelector("#appContent"),
  bottomNav: document.querySelector("#bottomNav"),
  authForm: document.querySelector("#authForm"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  signupBtn: document.querySelector("#signupBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  syncStatus: document.querySelector("#syncStatus"),
  screens: document.querySelectorAll(".screen"),
  navButtons: document.querySelectorAll(".nav-button"),
  productGrid: document.querySelector("#productGrid"),
  categoryFilter: document.querySelector("#categoryFilter"),
  productSearch: document.querySelector("#productSearch"),
  cartLines: document.querySelector("#cartLines"),
  cartEmpty: document.querySelector("#cartEmpty"),
  cartTotal: document.querySelector("#cartTotal"),
  paymentMethods: document.querySelectorAll('input[name="paymentMethod"]'),
  cashField: document.querySelector("#cashField"),
  cashInput: document.querySelector("#cashInput"),
  changeRow: document.querySelector("#changeRow"),
  changeDue: document.querySelector("#changeDue"),
  completeSaleBtn: document.querySelector("#completeSaleBtn"),
  clearCartBtn: document.querySelector("#clearCartBtn"),
  productForm: document.querySelector("#productForm"),
  productId: document.querySelector("#productId"),
  nameInput: document.querySelector("#nameInput"),
  categoryInput: document.querySelector("#categoryInput"),
  priceInput: document.querySelector("#priceInput"),
  costInput: document.querySelector("#costInput"),
  stockInput: document.querySelector("#stockInput"),
  lowStockInput: document.querySelector("#lowStockInput"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  categoryOptions: document.querySelector("#categoryOptions"),
  inventoryList: document.querySelector("#inventoryList"),
  dateFrom: document.querySelector("#dateFrom"),
  dateTo: document.querySelector("#dateTo"),
  timeFrom: document.querySelector("#timeFrom"),
  timeTo: document.querySelector("#timeTo"),
  historyList: document.querySelector("#historyList"),
  todayRevenue: document.querySelector("#todayRevenue"),
  todayProfit: document.querySelector("#todayProfit"),
  historyRevenue: document.querySelector("#historyRevenue"),
  historyProfit: document.querySelector("#historyProfit"),
  receiptDialog: document.querySelector("#receiptDialog"),
  receiptText: document.querySelector("#receiptText"),
  shareReceiptBtn: document.querySelector("#shareReceiptBtn"),
  closeReceiptBtn: document.querySelector("#closeReceiptBtn"),
  resetDemoBtn: document.querySelector("#resetDemoBtn"),
  toast: document.querySelector("#toast"),
};

function rupiah(value) {
  return currency.format(Number(value || 0)).replace(/\s/g, "");
}

function toProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    cost: row.cost,
    stock: row.stock,
    lowStock: row.low_stock,
  };
}

function fromProduct(data) {
  return {
    name: data.name,
    category: data.category,
    price: data.price,
    cost: data.cost,
    stock: data.stock,
    low_stock: data.lowStock,
  };
}

function toSale(row) {
  return {
    id: row.id,
    code: row.code,
    createdAt: row.created_at,
    items: (row.sale_items || []).map((item) => ({
      id: item.product_id,
      name: item.name,
      category: item.category,
      price: item.price,
      cost: item.cost,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
    total: row.total,
    costTotal: row.cost_total,
    profit: row.profit,
    paymentMethod: row.payment_method,
    cash: row.cash,
    change: row.change,
  };
}

function setLoading(loading, message = "Menyimpan...") {
  state.loading = loading;
  els.completeSaleBtn.disabled = loading || els.completeSaleBtn.disabled;
  els.syncStatus.textContent = loading ? message : "Online";
  els.syncStatus.classList.toggle("warning", loading);
}

function setSignedIn(signedIn) {
  els.authScreen.classList.toggle("is-hidden", signedIn);
  els.appContent.classList.toggle("is-hidden", !signedIn);
  els.bottomNav.classList.toggle("is-hidden", !signedIn);
  els.logoutBtn.classList.toggle("is-hidden", !signedIn);
  els.resetDemoBtn.classList.toggle("is-hidden", !signedIn);
  els.syncStatus.classList.toggle("is-hidden", !signedIn);
}

function categories() {
  return [...new Set(state.products.map((product) => product.category).filter(Boolean))].sort();
}

function cartItems() {
  return Object.entries(state.cart)
    .map(([productId, quantity]) => {
      const product = state.products.find((item) => item.id === productId);
      return product ? { ...product, quantity } : null;
    })
    .filter(Boolean);
}

function cartTotal() {
  return cartItems().reduce((total, item) => total + item.price * item.quantity, 0);
}

function cartProfit(items = cartItems()) {
  return items.reduce((total, item) => total + (item.price - item.cost) * item.quantity, 0);
}

function selectedPaymentMethod() {
  return document.querySelector('input[name="paymentMethod"]:checked')?.value || "Cash";
}

function isToday(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

async function init() {
  if (!db) {
    setSignedIn(false);
    els.syncStatus.textContent = "Butuh config";
    showToast("Isi Supabase URL dan anon key di config.js dulu.");
    return;
  }

  showAuthRedirectError();

  const { data, error } = await db.auth.getSession();
  if (error) {
    showToast(error.message);
    return;
  }

  state.user = data.session?.user || null;
  setSignedIn(Boolean(state.user));
  if (state.user) await loadOnlineData();

  db.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null;
    state.cart = {};
    setSignedIn(Boolean(state.user));
    if (state.user) {
      await loadOnlineData();
    } else {
      state.products = [];
      state.sales = [];
      renderAll();
    }
  });
}

async function loadOnlineData() {
  setLoading(true, "Memuat...");
  try {
    const [{ data: products, error: productError }, { data: sales, error: salesError }] = await Promise.all([
      db.from("products").select("*").order("name", { ascending: true }),
      db
        .from("sales")
        .select("*, sale_items(*)")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    if (productError) throw productError;
    if (salesError) throw salesError;

    state.products = products.map(toProduct);
    state.sales = sales.map(toSale);
    renderAll();
  } catch (error) {
    showToast(`Gagal memuat data: ${error.message}`);
  } finally {
    setLoading(false);
  }
}

function renderAll() {
  renderCategories();
  renderProducts();
  renderCart();
  renderInventory();
  renderHistory();
  renderSummaries();
}

function renderCategories() {
  const allCategories = ["Semua", ...categories()];
  els.categoryFilter.innerHTML = allCategories
    .map(
      (category) =>
        `<button class="chip ${category === state.activeCategory ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
    )
    .join("");

  els.categoryOptions.innerHTML = categories()
    .map((category) => `<option value="${escapeHtml(category)}"></option>`)
    .join("");
}

function renderProducts() {
  const query = els.productSearch.value.trim().toLowerCase();
  const products = state.products.filter((product) => {
    const matchCategory = state.activeCategory === "Semua" || product.category === state.activeCategory;
    const matchQuery = [product.name, product.category].join(" ").toLowerCase().includes(query);
    return matchCategory && matchQuery;
  });

  if (!products.length) {
    els.productGrid.innerHTML = `<div class="empty-state">Produk belum ada atau tidak ditemukan.</div>`;
    return;
  }

  els.productGrid.innerHTML = products
    .map((product) => {
      const low = product.stock <= product.lowStock;
      const initial = product.name.slice(0, 1).toUpperCase();
      return `
        <button class="product-tile" type="button" data-add="${product.id}" ${product.stock <= 0 ? "disabled" : ""}>
          <span class="tile-icon">${escapeHtml(initial)}</span>
          <span class="tile-name">${escapeHtml(product.name)}</span>
          <span class="tile-meta"><strong>${rupiah(product.price)}</strong><span class="${low ? "stock-low" : ""}">Stok ${product.stock}</span></span>
        </button>
      `;
    })
    .join("");
}

function renderCart() {
  const items = cartItems();
  els.cartEmpty.classList.toggle("hidden", items.length > 0);
  els.cartLines.innerHTML = items
    .map(
      (item) => `
        <div class="cart-line">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${rupiah(item.price)} x ${item.quantity}</span>
          </div>
          <div class="qty-controls">
            <button type="button" data-dec="${item.id}" aria-label="Kurangi ${escapeHtml(item.name)}">-</button>
            <strong>${item.quantity}</strong>
            <button type="button" data-inc="${item.id}" aria-label="Tambah ${escapeHtml(item.name)}">+</button>
          </div>
        </div>
      `
    )
    .join("");

  const total = cartTotal();
  const paymentMethod = selectedPaymentMethod();
  const cash = Number(els.cashInput.value || 0);
  const isCash = paymentMethod === "Cash";
  els.cashField.classList.toggle("is-hidden", !isCash);
  els.changeRow.classList.toggle("is-hidden", !isCash);
  els.cashInput.required = isCash;
  els.cartTotal.textContent = rupiah(total);
  els.changeDue.textContent = rupiah(Math.max(cash - total, 0));
  els.completeSaleBtn.disabled = state.loading || !items.length || (isCash && cash < total);
}

function renderInventory() {
  if (!state.products.length) {
    els.inventoryList.innerHTML = `<div class="empty-state">Tambahkan produk pertama untuk mulai jualan.</div>`;
    return;
  }

  els.inventoryList.innerHTML = [...state.products]
    .sort((a, b) => a.name.localeCompare(b.name, "id"))
    .map(
      (product) => `
        <article class="inventory-item">
          <div class="item-main">
            <div>
              <h3>${escapeHtml(product.name)}</h3>
              <div class="meta-line">
                <span>${rupiah(product.price)}</span>
                <span>Modal ${rupiah(product.cost)}</span>
                <span class="${product.stock <= product.lowStock ? "stock-low" : ""}">Stok ${product.stock}</span>
              </div>
            </div>
            <span class="pill">${escapeHtml(product.category)}</span>
          </div>
          <div class="item-actions">
            <button class="secondary-button" type="button" data-edit="${product.id}">Edit</button>
            <button class="secondary-button" type="button" data-restock="${product.id}">+ Stok</button>
          </div>
        </article>
      `
    )
    .join("");
}

function filteredSales() {
  return state.sales.filter((sale) => {
    const date = new Date(sale.createdAt);
    const datePart = dateInputValue(date);
    const timePart = date.toTimeString().slice(0, 5);
    return (!els.dateFrom.value || datePart >= els.dateFrom.value)
      && (!els.dateTo.value || datePart <= els.dateTo.value)
      && (!els.timeFrom.value || timePart >= els.timeFrom.value)
      && (!els.timeTo.value || timePart <= els.timeTo.value);
  });
}

function renderHistory() {
  const sales = filteredSales().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!sales.length) {
    els.historyList.innerHTML = `<div class="empty-state">Belum ada penjualan pada filter ini.</div>`;
    els.historyRevenue.textContent = rupiah(0);
    els.historyProfit.textContent = rupiah(0);
    return;
  }

  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const profit = sales.reduce((sum, sale) => sum + sale.profit, 0);
  els.historyRevenue.textContent = rupiah(revenue);
  els.historyProfit.textContent = rupiah(profit);
  els.historyList.innerHTML = sales
    .map(
      (sale) => `
        <article class="history-item">
          <div class="item-main">
            <div>
              <h3>${formatDateTime(sale.createdAt)}</h3>
              <div class="meta-line">
                <span>${sale.items.length} jenis barang</span>
                <span>${escapeHtml(sale.paymentMethod || "Cash")}</span>
                <span>Total ${rupiah(sale.total)}</span>
                <span>Untung ${rupiah(sale.profit)}</span>
              </div>
            </div>
            <span class="pill">${sale.code}</span>
          </div>
          <button class="secondary-button" type="button" data-receipt="${sale.id}">Lihat Struk</button>
        </article>
      `
    )
    .join("");
}

function renderSummaries() {
  const todaySales = state.sales.filter((sale) => isToday(sale.createdAt));
  els.todayRevenue.textContent = rupiah(todaySales.reduce((sum, sale) => sum + sale.total, 0));
  els.todayProfit.textContent = rupiah(todaySales.reduce((sum, sale) => sum + sale.profit, 0));
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product || product.stock <= 0) return;
  const current = state.cart[productId] || 0;
  if (current >= product.stock) {
    showToast("Stok tidak cukup.");
    return;
  }
  state.cart[productId] = current + 1;
  renderCart();
}

function updateCart(productId, diff) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  const next = (state.cart[productId] || 0) + diff;
  if (next <= 0) {
    delete state.cart[productId];
  } else if (next <= product.stock) {
    state.cart[productId] = next;
  } else {
    showToast("Stok tidak cukup.");
  }
  renderCart();
}

async function completeSale() {
  const items = cartItems();
  const total = cartTotal();
  const paymentMethod = selectedPaymentMethod();
  const isCash = paymentMethod === "Cash";
  const cash = isCash ? Number(els.cashInput.value || 0) : total;
  if (!items.length || (isCash && cash < total)) return;

  setLoading(true);
  try {
    const saleItems = items.map((item) => ({
      product_id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      cost: item.cost,
      quantity: item.quantity,
      subtotal: item.price * item.quantity,
    }));
    const salePayload = {
      code: makeSaleCode(),
      total,
      cost_total: saleItems.reduce((sum, item) => sum + item.cost * item.quantity, 0),
      profit: cartProfit(items),
      payment_method: paymentMethod,
      cash,
      change: isCash ? cash - total : 0,
    };

    const { data: insertedSale, error: saleError } = await db
      .from("sales")
      .insert(salePayload)
      .select("*")
      .single();
    if (saleError) throw saleError;

    const saleItemPayload = saleItems.map((item) => ({ ...item, sale_id: insertedSale.id }));
    const { error: itemError } = await db.from("sale_items").insert(saleItemPayload);
    if (itemError) throw itemError;

    for (const item of items) {
      const nextStock = item.stock - item.quantity;
      const { error: stockError } = await db
        .from("products")
        .update({ stock: nextStock, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (stockError) throw stockError;
    }

    const sale = toSale({ ...insertedSale, sale_items: saleItemPayload });
    state.sales = [sale, ...state.sales];
    state.products = state.products.map((product) => {
      const sold = items.find((item) => item.id === product.id);
      return sold ? { ...product, stock: product.stock - sold.quantity } : product;
    });
    state.cart = {};
    els.cashInput.value = "";
    renderAll();
    showReceipt(sale);
    showToast("Penjualan online tersimpan.");
  } catch (error) {
    showToast(`Gagal menyimpan: ${error.message}`);
  } finally {
    setLoading(false);
    renderCart();
  }
}

function showReceipt(sale) {
  state.currentReceipt = buildReceipt(sale);
  els.receiptText.textContent = state.currentReceipt;
  els.receiptDialog.showModal();
}

function buildReceipt(sale) {
  const lines = [
    "Toko Aufada🛒",
    "Struk Penjualan🧾",
    sale.code,
    formatDateTime(sale.createdAt),
    "------------------------------",
    ...sale.items.map((item) => {
      const name = item.name.length > 18 ? `${item.name.slice(0, 18)}.` : item.name;
      return `${name}\n  ${item.quantity} x ${rupiah(item.price)} = ${rupiah(item.subtotal)}`;
    }),
    "------------------------------",
    `Total      : ${rupiah(sale.total)}`,
    `Bayar      : ${sale.paymentMethod || "Cash"}`,
    `Diterima   : ${rupiah(sale.cash ?? sale.total)}`,
    `Kembalian  : ${rupiah(sale.change || 0)}`,
    "------------------------------",
    "Terima kasih🙏",
  ];
  return lines.join("\n");
}

async function saveProduct(event) {
  event.preventDefault();
  const data = {
    name: els.nameInput.value.trim(),
    category: els.categoryInput.value.trim(),
    price: Number(els.priceInput.value || 0),
    cost: Number(els.costInput.value || 0),
    stock: Number(els.stockInput.value || 0),
    lowStock: Number(els.lowStockInput.value || 1),
  };

  if (!data.name || !data.category) return;
  setLoading(true, "Menyimpan produk...");
  try {
    const existingId = els.productId.value;
    if (existingId) {
      const { data: updated, error } = await db
        .from("products")
        .update({ ...fromProduct(data), updated_at: new Date().toISOString() })
        .eq("id", existingId)
        .select("*")
        .single();
      if (error) throw error;
      state.products = state.products.map((product) => product.id === existingId ? toProduct(updated) : product);
      showToast("Produk diperbarui.");
    } else {
      const { data: inserted, error } = await db
        .from("products")
        .insert(fromProduct(data))
        .select("*")
        .single();
      if (error) throw error;
      state.products.push(toProduct(inserted));
      showToast("Produk ditambahkan.");
    }

    els.productForm.reset();
    els.lowStockInput.value = 5;
    els.productId.value = "";
    renderAll();
  } catch (error) {
    showToast(`Gagal menyimpan produk: ${error.message}`);
  } finally {
    setLoading(false);
  }
}

function editProduct(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  els.productId.value = product.id;
  els.nameInput.value = product.name;
  els.categoryInput.value = product.category;
  els.priceInput.value = product.price;
  els.costInput.value = product.cost;
  els.stockInput.value = product.stock;
  els.lowStockInput.value = product.lowStock;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function restockProduct(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  const nextStock = product.stock + 1;
  setLoading(true, "Update stok...");
  try {
    const { error } = await db
      .from("products")
      .update({ stock: nextStock, updated_at: new Date().toISOString() })
      .eq("id", productId);
    if (error) throw error;
    product.stock = nextStock;
    renderAll();
  } catch (error) {
    showToast(`Gagal update stok: ${error.message}`);
  } finally {
    setLoading(false);
  }
}

async function seedSampleProducts() {
  if (!state.user) return;
  setLoading(true, "Tambah contoh...");
  try {
    const { data, error } = await db.from("products").insert(sampleProducts).select("*");
    if (error) throw error;
    state.products = [...state.products, ...data.map(toProduct)];
    renderAll();
    showToast("Data contoh ditambahkan.");
  } catch (error) {
    showToast(`Gagal tambah contoh: ${error.message}`);
  } finally {
    setLoading(false);
  }
}

async function signIn(event) {
  event.preventDefault();
  if (!db) {
    showToast("Isi config.js dulu.");
    return;
  }
  setLoading(true, "Login...");
  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;
  const { error } = await db.auth.signInWithPassword({ email, password });
  setLoading(false);
  if (error) showToast(error.message);
}

async function signUp() {
  if (!db) {
    showToast("Isi config.js dulu.");
    return;
  }
  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;
  if (!email || password.length < 6) {
    showToast("Isi email dan password minimal 6 karakter.");
    return;
  }
  setLoading(true, "Buat akun...");
  const { error } = await db.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.href.split("#")[0],
    },
  });
  setLoading(false);
  if (error) {
    showToast(error.message);
  } else {
    showToast("Akun dibuat. Cek email jika Supabase meminta konfirmasi.");
  }
}

async function signOut() {
  if (!db) return;
  await db.auth.signOut();
}

async function shareReceipt() {
  if (!state.currentReceipt) return;
  if (navigator.share) {
    await navigator.share({ title: "Struk Warung", text: state.currentReceipt });
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(state.currentReceipt);
    showToast("Struk disalin.");
  } else {
    showToast("Pilih teks struk untuk disalin.");
  }
}

function switchScreen(screen) {
  els.screens.forEach((item) => item.classList.toggle("active", item.id === `screen-${screen}`));
  els.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.screen === screen));
}

function makeSaleCode() {
  return `TRX-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${String(Date.now()).slice(-5)}`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function showAuthRedirectError() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const description = hash.get("error_description");
  if (!description) return;
  const cleanMessage = description.replace(/\+/g, " ");
  showToast(`Link login bermasalah: ${cleanMessage}`);
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

els.navButtons.forEach((button) => {
  button.addEventListener("click", () => switchScreen(button.dataset.screen));
});

els.categoryFilter.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.activeCategory = button.dataset.category;
  renderCategories();
  renderProducts();
});

els.productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (button) addToCart(button.dataset.add);
});

els.cartLines.addEventListener("click", (event) => {
  const inc = event.target.closest("[data-inc]");
  const dec = event.target.closest("[data-dec]");
  if (inc) updateCart(inc.dataset.inc, 1);
  if (dec) updateCart(dec.dataset.dec, -1);
});

els.inventoryList.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit]");
  const restock = event.target.closest("[data-restock]");
  if (edit) editProduct(edit.dataset.edit);
  if (restock) restockProduct(restock.dataset.restock);
});

els.historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-receipt]");
  if (!button) return;
  const sale = state.sales.find((item) => item.id === button.dataset.receipt);
  if (sale) showReceipt(sale);
});

els.authForm.addEventListener("submit", signIn);
els.signupBtn.addEventListener("click", signUp);
els.logoutBtn.addEventListener("click", signOut);
els.productSearch.addEventListener("input", renderProducts);
els.cashInput.addEventListener("input", renderCart);
els.paymentMethods.forEach((input) => input.addEventListener("change", renderCart));
els.completeSaleBtn.addEventListener("click", completeSale);
els.clearCartBtn.addEventListener("click", () => {
  state.cart = {};
  renderCart();
});
els.productForm.addEventListener("submit", saveProduct);
els.cancelEditBtn.addEventListener("click", () => {
  els.productForm.reset();
  els.lowStockInput.value = 5;
  els.productId.value = "";
});
[els.dateFrom, els.dateTo, els.timeFrom, els.timeTo].forEach((input) => {
  input.addEventListener("input", renderHistory);
});
els.closeReceiptBtn.addEventListener("click", () => els.receiptDialog.close());
els.shareReceiptBtn.addEventListener("click", () => shareReceipt().catch(() => showToast("Struk belum bisa dibagikan.")));
els.resetDemoBtn.addEventListener("click", seedSampleProducts);

setSignedIn(false);
renderAll();
init();
