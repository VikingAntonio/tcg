$(document).ready(async function () {
  let currentUser = null;
  let orders = [];
  let digital = [];

  const TYPE_LABEL = {
    accessory: 'Accesorio',
    sticker: 'Sticker',
    spirit: 'Asistente 3D',
    pack: 'Pack'
  };

  const SOURCE_LABEL = {
    purchase: 'Compra',
    gift: 'Regalo',
    pack: 'Incluido en pack',
    backfill: 'Compra anterior'
  };

  await checkSession();
  initTheme();
  bindHeader();

  async function checkSession() {
    try {
      const { data: { session } } = await _supabase.auth.getSession();
      if (session) {
        const { data } = await _supabase
          .from('usuarios')
          .select('id, username, role, store_logo, store_name')
          .eq('id', session.user.id)
          .maybeSingle();
        if (data) {
          currentUser = data;
          localStorage.setItem('tcg_session', JSON.stringify(data));
          updateHeader();
          await loadAll();
          return;
        }
      }
    } catch (e) {
      console.warn('Sesión no disponible:', e);
    }

    const cached = localStorage.getItem('tcg_session');
    if (cached) {
      try {
        currentUser = JSON.parse(cached);
        updateHeader();
        await loadAll();
        return;
      } catch (_) { /* caché corrupta: se ignora */ }
    }

    showGuest();
  }

  async function loadAll() {
    if (!currentUser || !currentUser.id) return showGuest();

    try {
      const [ordersRes, digitalRes] = await Promise.all([
        _supabase
          .from('checkout_orders')
          .select('id, items, total_amount, currency, status, created_at, paid_at')
          .eq('user_id', currentUser.id)
          .eq('status', 'paid')
          .order('paid_at', { ascending: false }),
        _supabase
          .from('user_entitlements')
          .select('id, item_type, item_id, item_snapshot, source, price_paid, currency, granted_at')
          .eq('user_id', currentUser.id)
          .order('granted_at', { ascending: false })
      ]);

      if (ordersRes.error) console.warn('Pedidos:', ordersRes.error.message);
      if (digitalRes.error) console.warn('Compras digitales:', digitalRes.error.message);

      orders = ordersRes.data || [];
      digital = digitalRes.data || [];

      renderOrders();
      renderDigital();
      $('#mc-loading').hide();
    } catch (e) {
      console.error('Error cargando compras:', e);
      $('#mc-loading').html('<i class="fas fa-triangle-exclamation"></i> No se pudieron cargar tus compras.');
    }
  }

  function showGuest() {
    $('#mc-loading').hide();
    $('#mc-guest').show();
  }

  function updateHeader() {
    if (!currentUser) return;
    $('#dropdown-user-name').text(currentUser.store_name || currentUser.username || 'Usuario');
    if (currentUser.role) {
      $('#dropdown-user-role').text(currentUser.role).show();
    }
    if (currentUser.store_logo) {
      $('#dropdown-user-logo').attr('src', mediaUrl(currentUser.store_logo, 100)).show();
    }
  }

  function mediaUrl(url, width) {
    if (!url) return '';
    if (typeof window.optImg === 'function') {
      try { return window.optImg(url, width); } catch (_) { /* se usa la original */ }
    }
    return url;
  }

  function money(value, currency) {
    const n = Number(value) || 0;
    return `$${n.toFixed(2)}${currency && currency !== 'MXN' ? ' ' + currency : ''}`;
  }

  function shortDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function itemImage(url, className) {
    const src = mediaUrl(url, 160);
    if (!src) return `<div class="${className} empty"><i class="fas fa-image"></i></div>`;
    return `<img class="${className}" src="${escapeHtml(src)}" alt="" loading="lazy">`;
  }

  function renderOrders() {
    $('#mc-orders-count').text(orders.length);
    const $panel = $('#mc-orders');

    if (!orders.length) {
      $panel.html(`
        <div class="mc-empty">
          <i class="fas fa-bag-shopping"></i>
          Todavía no tienes pedidos pagados con tarjeta.
        </div>`);
      return;
    }

    $panel.html(orders.map(order => {
      const items = Array.isArray(order.items) ? order.items : [];
      const rows = items.map(it => {
        const qty = Number(it.quantity || it.cart_quantity || 1);
        const unit = Number(it.price || 0);
        return `
          <div class="mc-item">
            ${itemImage(it.image_url, 'mc-item-img')}
            <div>
              <div class="mc-item-name">${escapeHtml(it.name || 'Artículo')}</div>
              <div class="mc-item-meta">${qty} × ${money(unit, order.currency)}</div>
            </div>
            <div class="mc-item-price">${money(unit * qty, order.currency)}</div>
          </div>`;
      }).join('');

      return `
        <div class="mc-order">
          <div class="mc-order-head">
            <span class="mc-order-date">
              <i class="far fa-calendar"></i> ${escapeHtml(shortDate(order.paid_at || order.created_at))}
            </span>
            <span class="mc-badge">PAGADO</span>
          </div>
          <div class="mc-order-items">${rows || '<div class="mc-item"><div class="mc-item-name">Pedido sin artículos</div></div>'}</div>
          <div class="mc-order-foot">
            <span>${items.length} artículo(s)</span>
            <span class="mc-order-total">${money(order.total_amount, order.currency)}</span>
          </div>
        </div>`;
    }).join(''));
  }

  function renderDigital() {
    $('#mc-digital-count').text(digital.length);
    const $panel = $('#mc-digital');

    if (!digital.length) {
      $panel.html(`
        <div class="mc-empty">
          <i class="fas fa-box-open"></i>
          Aún no tienes compras ni regalos digitales.
        </div>`);
      return;
    }

    $panel.html(digital.map(row => {
      const snap = row.item_snapshot || {};
      const name = snap.name || snap.title || snap.card_name || `${TYPE_LABEL[row.item_type] || 'Artículo'}`;
      const image = snap.image_url || snap.poster_url || snap.cover_image_url || '';
      const typeLabel = TYPE_LABEL[row.item_type] || row.item_type;
      const sourceLabel = SOURCE_LABEL[row.source] || row.source;
      const isGift = row.source === 'gift';
      const price = Number(row.price_paid || 0);

      return `
        <div class="mc-digital-item">
          ${itemImage(image, 'mc-digital-img')}
          <div>
            <div class="mc-item-name">${escapeHtml(name)}</div>
            <div class="mc-item-meta">
              <span class="mc-tag">${escapeHtml(typeLabel)}</span>
              <span class="mc-tag${isGift ? ' gift' : ''}">${escapeHtml(sourceLabel)}</span>
              <span>${escapeHtml(shortDate(row.granted_at))}</span>
            </div>
          </div>
          <div class="mc-item-price">${price > 0 ? money(price, row.currency) : 'Gratis'}</div>
        </div>`;
    }).join(''));
  }

  function bindHeader() {
    $('.mc-tab').on('click', function () {
      const tab = $(this).data('tab');
      $('.mc-tab').removeClass('active');
      $(this).addClass('active');
      $('.mc-panel').removeClass('active');
      $(`#mc-${tab}`).addClass('active');
    });

    $(document).on('click', '#avatar-btn', function (e) {
      e.stopPropagation();
      $('#user-dropdown').toggleClass('active');
    });

    $(document).on('click', function (e) {
      if (!$(e.target).closest('.user-menu-container').length) {
        $('#user-dropdown').removeClass('active');
      }
    });

    $('#btn-logout').on('click', async function (e) {
      e.preventDefault();
      await _supabase.auth.signOut();
      localStorage.removeItem('tcg_session');
      window.location.href = 'index.html';
    });

    $('#btn-nav-home').on('click', () => { window.location.href = 'index.html'; });
    $('#btn-nav-return').on('click', () => { window.history.back(); });
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('tcg_theme') || 'theme-dark';
    applyTheme(savedTheme);
    $('.theme-btn-small').on('click', function () {
      applyTheme($(this).data('theme'));
    });
  }

  function applyTheme(theme) {
    $('body').removeClass('theme-light theme-medium theme-dark theme-purple').addClass(theme);
    localStorage.setItem('tcg_theme', theme);
    $('.theme-btn-small').removeClass('active');
    $(`.theme-btn-small[data-theme="${theme}"]`).addClass('active');
  }
});
