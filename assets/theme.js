// Announcement bar rendered server-side in sections/announcement-bar.liquid

// ─── TOAST ───
function showToast(msg) {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ─── SHOPIFY CART API ───
const ShopifyCart = {
  FREE_SHIP: 30000, // 300 zł in grosz

  async get() {
    const res = await fetch('/cart.js', { headers: { 'Content-Type': 'application/json' } });
    return res.json();
  },

  async add(variantId, quantity) {
    const res = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ id: variantId, quantity }] })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.description || 'Błąd dodawania do koszyka');
    }
    return res.json();
  },

  async change(key, quantity) {
    const res = await fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity })
    });
    return res.json();
  }
};

// ─── CART RENDER ───
function renderCart(cartData) {
  const countEl = document.getElementById('cartCount');
  const shipFill = document.getElementById('shipFill');
  const shipText = document.getElementById('shipText');
  const cartBody = document.getElementById('cartBody');
  const cartFoot = document.getElementById('cartFoot');
  const cartTotal = document.getElementById('cartTotal');
  const charityAmt = document.getElementById('charityAmt');

  const total = cartData.total_price; // in grosz
  const count = cartData.item_count;
  const pct = Math.min(100, (total / ShopifyCart.FREE_SHIP) * 100);

  if (countEl) {
    countEl.textContent = count;
    countEl.dataset.zero = count === 0 ? 'true' : 'false';
  }
  if (shipFill) shipFill.style.width = pct + '%';
  if (shipText) {
    const left = Math.max(0, ShopifyCart.FREE_SHIP - total);
    shipText.textContent = left > 0
      ? `Do darmowej dostawy brakuje Ci ${(left / 100).toFixed(0)} zł`
      : '🎉 Masz darmową dostawę!';
  }

  if (!cartData.items || cartData.items.length === 0) {
    if (cartBody) cartBody.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🥐</div>
        <p>Koszyk pusty jak żołądek przed biegiem.<br>Dodaj pakiet challange i zaczynamy!</p>
      </div>`;
    if (cartFoot) cartFoot.style.display = 'none';
    return;
  }

  if (cartFoot) cartFoot.style.display = 'block';
  if (cartTotal) cartTotal.textContent = (total / 100).toFixed(0) + ' zł';

  const charity = cartData.items.reduce((s, i) => s + 30 * i.quantity, 0);
  if (charityAmt) charityAmt.textContent = charity + ' zł';

  if (cartBody) {
    cartBody.innerHTML = cartData.items.map(item => {
      const img = item.image
        ? `<img src="${item.image}" alt="${item.title}">`
        : '👕';
      const variantLabel = item.variant_title && item.variant_title !== 'Default Title'
        ? item.variant_title
        : '';
      return `
        <div class="cart-item">
          <div class="ci-img">${typeof img === 'string' && img.startsWith('<img') ? img : `<span>${img}</span>`}</div>
          <div class="ci-info">
            <div class="ci-name">${item.product_title}</div>
            ${variantLabel ? `<div class="ci-meta">Unisex · ${variantLabel}</div>` : ''}
            <div class="ci-controls">
              <div class="ci-qty">
                <button onclick="updateCartItem('${item.key}', ${item.quantity - 1})">−</button>
                <span>${item.quantity}</span>
                <button onclick="updateCartItem('${item.key}', ${item.quantity + 1})">+</button>
              </div>
              <div class="ci-price">${(item.line_price / 100).toFixed(0)} zł</div>
              <button class="ci-remove" onclick="updateCartItem('${item.key}', 0)">usuń</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }
}

async function updateCartItem(key, quantity) {
  try {
    const cart = await ShopifyCart.change(key, quantity);
    renderCart(cart);
  } catch (e) {
    showToast('Błąd aktualizacji koszyka');
  }
}

function toggleCart(forceOpen) {
  const overlay = document.getElementById('cartOverlay');
  const drawer = document.getElementById('cartDrawer');
  if (!drawer) return;
  const isOpen = drawer.classList.contains('open');
  const open = forceOpen === true ? true : !isOpen;
  drawer.classList.toggle('open', open);
  if (overlay) overlay.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}

// ─── ROZMIAR (unisex) ───
let selectedSize = null;
let buyQty = 1;

function renderSizeGrid() {
  const grid = document.getElementById('sizeGrid');
  if (!grid) return;
  const product = window.rnrProduct;
  if (!product || !product.variants) return;

  if (!selectedSize) {
    const firstAvailable = product.variants.find(v => v.available) || product.variants[0];
    selectedSize = firstAvailable ? firstAvailable.option1 : null;
  }

  grid.innerHTML = product.variants.map(v => {
    const size = v.option1;
    const isActive = size === selectedSize;
    return `<button class="size-btn${isActive ? ' active' : ''}"${v.available ? '' : ' disabled'} onclick="selectSize('${size.replace(/'/g, "\\'")}', this)">${size}</button>`;
  }).join('');
}

function selectSize(size, btn) {
  selectedSize = size;
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function changeBuyQty(delta) {
  buyQty = Math.max(1, buyQty + delta);
  const el = document.getElementById('buyQty');
  if (el) el.textContent = buyQty;
}

// ─── FIND SHOPIFY VARIANT ───
function findVariant() {
  const product = window.rnrProduct;
  if (!product || !product.variants || !selectedSize) return null;
  return product.variants.find(v => v.option1 === selectedSize);
}

// ─── ADD TO CART ───
async function addToCart() {
  const btn = document.querySelector('.btn-buy');

  if (!window.rnrProduct) {
    showToast('⚠ Produkt nie jest skonfigurowany');
    return;
  }

  const variant = findVariant();
  if (!variant) {
    showToast('⚠ Wybierz rozmiar');
    return;
  }

  if (!variant.available) {
    showToast('⚠ Ten rozmiar jest niedostępny');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'DODAJĘ...'; }

  try {
    await ShopifyCart.add(variant.id, buyQty);
    const cart = await ShopifyCart.get();
    renderCart(cart);
    toggleCart(true);
    showToast(`✓ Pakiet (${selectedSize}) dodany`);
  } catch (e) {
    showToast('⚠ ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg> DODAJ DO KOSZYKA'; }
  }
}

// ─── PHOTO GALLERY ───
let galleryIndex = 0;
function galleryGoTo(index) {
  const slides = document.querySelectorAll('.gallery-slide');
  if (!slides.length) return;
  galleryIndex = (index + slides.length) % slides.length;
  slides.forEach((s, i) => s.classList.toggle('active', i === galleryIndex));
  const counter = document.getElementById('galleryCounter');
  if (counter) counter.textContent = `${galleryIndex + 1} / ${slides.length}`;
}
function galleryStep(delta) { galleryGoTo(galleryIndex + delta); }

// ─── SIZE GUIDE MODAL ───
function openSizeGuide() {
  const modal = document.getElementById('sizeModal');
  if (modal) modal.classList.add('open');
}
function closeSizeGuide() {
  const modal = document.getElementById('sizeModal');
  if (modal) modal.classList.remove('open');
}

// ─── NEWSLETTER ───
function subNewsletter(e) {
  e.preventDefault();
  showToast('✓ Zapisano! Będziesz pierwszy przy Drop 002 🥐');
  e.target.reset();
}

// ─── TRACKER PREVIEW (interaktywne demo) ───
// Lekka replika UI prawdziwego trackera (osobne narzędzie "Biegam po bułki").
// Stan żyje tylko w pamięci tej strony (nie zapisuje się) — to zabawka pokazująca mechanikę,
// prawdziwy postęp uczestnicy zapisują na docelowym trackerze. Zasada klikania (tylko po kolei,
// cofnąć można wyłącznie ostatnie kółko) jest 1:1 skopiowana z prawdziwego narzędzia.
const TRACKER_PREVIEW_TOTAL = 30;
const TRACKER_PREVIEW_MILESTONES = [5, 15, 30];
let trackerPreviewDone = Array.from({ length: TRACKER_PREVIEW_TOTAL }, (_, i) => i < 12); // startowy stan demo: 12/30

function renderTrackerPreview() {
  const grid = document.getElementById('trackerPreviewCircles');
  if (!grid) return;
  const doneCount = trackerPreviewDone.filter(Boolean).length;

  if (!grid.children.length) {
    for (let i = 0; i < TRACKER_PREVIEW_TOTAL; i++) {
      const dayNum = i + 1;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tp-circle';
      if (TRACKER_PREVIEW_MILESTONES.includes(dayNum)) btn.classList.add('milestone');
      btn.innerHTML = `<span>${dayNum}</span>`;
      btn.setAttribute('aria-label', `Bieg ${dayNum} z ${TRACKER_PREVIEW_TOTAL}`);
      btn.addEventListener('click', () => toggleTrackerPreview(i));
      grid.appendChild(btn);
    }
  }

  grid.querySelectorAll('.tp-circle').forEach((el, i) => {
    el.classList.remove('done', 'next', 'locked');
    if (trackerPreviewDone[i]) el.classList.add('done');
    else if (i === doneCount) el.classList.add('next');
    else el.classList.add('locked');
  });

  const countEl = document.getElementById('trackerPreviewCount');
  const fillEl = document.getElementById('trackerPreviewFill');
  if (countEl) countEl.textContent = doneCount;
  if (fillEl) fillEl.style.width = Math.round(doneCount / TRACKER_PREVIEW_TOTAL * 100) + '%';
}

function toggleTrackerPreview(idx) {
  const doneCount = trackerPreviewDone.filter(Boolean).length;
  if (trackerPreviewDone[idx]) {
    if (idx !== doneCount - 1) { showToast('Możesz odznaczać tylko ostatni bieg'); return; }
  } else {
    if (idx !== doneCount) { showToast('Zaznaczaj biegi po kolei! 👟'); return; }
  }
  trackerPreviewDone[idx] = !trackerPreviewDone[idx];
  renderTrackerPreview();
  if (trackerPreviewDone.filter(Boolean).length === TRACKER_PREVIEW_TOTAL) {
    showToast('🎉 To była tylko zapowiedź — zapisz prawdziwy postęp na swoim trackerze!');
  }
}

// ─── NAV SCROLL STATE ───
// przy scrollu w dół wjeżdża jasny pasek pod nawigacją i tekst/ikony ciemnieją (patrz .nav.scrolled)
function updateNavOnScroll() {
  const nav = document.getElementById('mainNav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
}

// ─── SCROLL REVEAL ───
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ─── INIT ───
document.addEventListener('DOMContentLoaded', function() {
  // Load initial cart state from Shopify
  ShopifyCart.get().then(renderCart).catch(() => {});

  // Size guide close on overlay click
  const sizeModal = document.getElementById('sizeModal');
  if (sizeModal) {
    sizeModal.addEventListener('click', e => {
      if (e.target === sizeModal) closeSizeGuide();
    });
  }

  renderSizeGrid();
  renderTrackerPreview();

  window.addEventListener('scroll', updateNavOnScroll, { passive: true });
  updateNavOnScroll();
});
