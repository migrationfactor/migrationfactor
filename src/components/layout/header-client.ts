/** Dropdown and contact-drawer behavior for the site header. */
export function initSiteHeader(): () => void {
  const header = document.querySelector<HTMLElement>('.header');
  const back = document.querySelector<HTMLElement>('.back-top');
  const toggle = header?.querySelector<HTMLButtonElement>('.menu-toggle');
  const drawer = document.querySelector<HTMLDialogElement>('#contact-drawer');
  if (!header || !toggle || !drawer) return () => {};

  const events = new AbortController();
  const signal = events.signal;
  let previousOverflow = '';
  let scrollFrame = 0;

  const scrollState = () => {
    header.classList.toggle('scrolled', window.scrollY > 40);
    back?.classList.toggle('visible', window.scrollY > 650);
  };

  const onScroll = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      scrollState();
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true, signal });
  scrollState();

  const dropdownButtons = Array.from(header.querySelectorAll<HTMLButtonElement>('.nav-dropdown-toggle'));
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  let hoverCloseTimer: ReturnType<typeof setTimeout> | undefined;
  const clearHoverClose = () => clearTimeout(hoverCloseTimer);
  const closeDropdowns = (except?: HTMLButtonElement) =>
    dropdownButtons.forEach((button) => {
      if (button === except) return;
      button.setAttribute('aria-expanded', 'false');
      const targetId = button.getAttribute('aria-controls');
      if (targetId) {
        const target = document.getElementById(targetId);
        if (target) target.hidden = true;
      }
    });

  closeDropdowns();

  dropdownButtons.forEach((button) => {
    const item = button.closest<HTMLElement>('.nav-item');
    if (!item) return;
    item.addEventListener('pointerenter', (event) => {
      if (!hover.matches || event.pointerType === 'touch') return;
      clearHoverClose();
      closeDropdowns(button);
      button.setAttribute('aria-expanded', 'true');
      const target = document.getElementById(button.getAttribute('aria-controls') ?? '');
      if (target) target.hidden = false;
    }, { signal });
    item.addEventListener('pointerleave', (event) => {
      if (!hover.matches || event.pointerType === 'touch') return;
      clearHoverClose();
      // Allow the pointer to cross the existing visual gap into the submenu.
      hoverCloseTimer = setTimeout(() => {
        if (!item.contains(document.activeElement)) closeDropdowns();
      }, 180);
    }, { signal });
    item.addEventListener('focusout', (event) => {
      if (!item.contains(event.relatedTarget as Node | null) && !item.matches(':hover')) closeDropdowns();
    }, { signal });
  });
  header.querySelectorAll<HTMLElement>('#primary-nav > a').forEach((link) => {
    link.addEventListener('pointerenter', () => {
      if (hover.matches) { clearHoverClose(); closeDropdowns(); }
    }, { signal });
  });

  dropdownButtons.forEach((button) =>
    button.addEventListener(
      'click',
      () => {
        clearHoverClose();
        const open = button.getAttribute('aria-expanded') !== 'true';
        closeDropdowns(button);
        button.setAttribute('aria-expanded', String(open));
        const targetId = button.getAttribute('aria-controls');
        if (targetId) {
          const target = document.getElementById(targetId);
          if (target) target.hidden = !open;
        }
      },
      { signal }
    )
  );

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.nav-item')) closeDropdowns();
    },
    { signal }
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;
      const activeButton = dropdownButtons.find((button) => button.getAttribute('aria-expanded') === 'true');
      closeDropdowns();
      activeButton?.focus();
    },
    { signal }
  );

  const mobile = matchMedia('(max-width:1199px)');
  mobile.addEventListener('change', () => closeDropdowns(), { signal });

  const openDrawer = () => {
      if (drawer.open) return;
      closeDropdowns();
      previousOverflow = document.body.style.overflow;
      drawer.showModal();
      document.body.style.overflow = 'hidden';
      toggle.setAttribute('aria-expanded', 'true');
      const sr = toggle.querySelector('.sr-only');
      if (sr) sr.textContent = 'Close menu and contact details';
  };
  toggle.addEventListener('click', openDrawer, { signal });
  toggle.addEventListener('pointerenter', (event) => {
    if (hover.matches && event.pointerType !== 'touch') openDrawer();
  }, { signal });

  drawer.addEventListener(
    'close',
    () => {
      document.body.style.overflow = previousOverflow;
      toggle.setAttribute('aria-expanded', 'false');
      const sr = toggle.querySelector('.sr-only');
      if (sr) sr.textContent = 'Open menu and contact details';
      toggle.focus({ preventScroll: true });
    },
    { signal }
  );

  drawer.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('a[href]')) {
        drawer.close();
        return;
      }
      if (event.target !== drawer) return;
      const bounds = drawer.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        drawer.close();
      }
    },
    { signal }
  );

  return () => {
    events.abort();
    clearHoverClose();
    cancelAnimationFrame(scrollFrame);
    if (drawer.open) {
      drawer.close();
      document.body.style.overflow = previousOverflow;
    }
  };
}
