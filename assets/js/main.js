/* =============================================
   BOG26 — Shared JS utilities
   ============================================= */

// ---- Navbar active page detection ----
document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar-bog26 .nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === page || (page === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Dropdown items active
  document.querySelectorAll('.navbar-bog26 .dropdown-item').forEach(item => {
    const href = item.getAttribute('href') || '';
    if (href === page) {
      item.classList.add('active');
      // Also mark parent nav-link as active
      const parent = item.closest('.dropdown').previousElementSibling;
      if (parent) parent.classList.add('active');
    }
  });
});

// ---- Generic filter system ----
// Usage: initFilters({ containerSelector, itemSelector, filters: [{selectId, attribute}], noResultsMsg })
function initFilters({ containerSelector, itemSelector, filters, noResultsMsg = 'Sin resultados para los filtros seleccionados.' }) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const items = () => container.querySelectorAll(itemSelector);

  function applyFilters() {
    const values = {};
    filters.forEach(f => {
      const sel = document.getElementById(f.selectId);
      values[f.attribute] = sel ? sel.value : '';
    });

    let visible = 0;
    items().forEach(item => {
      let show = true;
      filters.forEach(f => {
        const val = values[f.attribute];
        if (val && item.dataset[f.attribute] !== val) show = false;
      });
      item.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    // No results message
    let noRes = container.querySelector('.no-results');
    if (!noRes) {
      noRes = document.createElement('div');
      noRes.className = 'no-results col-12 text-center py-5 text-muted';
      noRes.innerHTML = `<p>${noResultsMsg}</p>`;
      container.appendChild(noRes);
    }
    noRes.style.display = visible === 0 ? '' : 'none';
  }

  filters.forEach(f => {
    const sel = document.getElementById(f.selectId);
    if (sel) sel.addEventListener('change', applyFilters);
  });

  // Clear button
  document.querySelectorAll('.btn-limpiar').forEach(btn => {
    btn.addEventListener('click', () => {
      filters.forEach(f => {
        const sel = document.getElementById(f.selectId);
        if (sel) sel.value = '';
      });
      applyFilters();
    });
  });

  applyFilters();
}

// ---- Smooth scroll for anchor links ----
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
