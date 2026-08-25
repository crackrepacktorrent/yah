<script lang="ts">
  import { page } from "$app/state";
  import { storyblokEditable } from "@storyblok/svelte";
  import { languages, type Language } from "$lib/lang";
  import type { HeaderBlok, HeaderButtonBlok, CardBlok } from "$lib/storyblok/types";
  import { getLinkUrl, getLocalizedLinkUrl } from "$lib/storyblok/client";
  import { Dialog } from "bits-ui";
  import Dropdown from "./Dropdown.svelte";
  import logo from "$lib/assets/logo.png";
  import Menu from "@lucide/svelte/icons/menu";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import X from "@lucide/svelte/icons/x";

  let expandedMobileItem = $state<string | null>(null);
  let mobileMenuOpen = $state(false);

  let {
    blok,
    lang,
    dropdownCards = {}
  }: {
    blok: HeaderBlok;
    lang: Language;
    dropdownCards?: Record<string, CardBlok[]>;
  } = $props();

  const buttons = $derived(blok.buttons ?? []);

  function getPathWithoutLang(url: string): string {
    const pathname = url;
    const withoutLeadingSlash = pathname.startsWith("/") ? pathname.slice(1) : pathname;

    if (withoutLeadingSlash === "en" || withoutLeadingSlash === "es") {
      return "/";
    }

    if (withoutLeadingSlash.startsWith("en/") || withoutLeadingSlash.startsWith("es/")) {
      return "/" + withoutLeadingSlash.slice(3);
    }

    return pathname.startsWith("/") ? pathname : "/" + pathname;
  }

  function getLanguageLink(targetLang: Language): string {
    const pathWithoutLang = getPathWithoutLang(page.url.pathname);

    if (targetLang === "en") {
      return `${pathWithoutLang === "/" ? "/" : pathWithoutLang}${page.url.search}${page.url.hash}`;
    } else {
      const localizedPath = pathWithoutLang === "/" ? `/${targetLang}` : `/${targetLang}${pathWithoutLang}`;
      return `${localizedPath}${page.url.search}${page.url.hash}`;
    }
  }

  function currentLanguageLabel(name: string): string {
    return lang === 'es' ? `Idioma actual: ${name}` : `Current language: ${name}`;
  }

  function switchLanguageLabel(name: string): string {
    return lang === 'es' ? `Cambiar a ${name}` : `Switch to ${name}`;
  }

  function localizeHref(link?: CardBlok['link'] | HeaderButtonBlok['link']): string {
    return getLocalizedLinkUrl(link, lang);
  }

  function getCards(button: HeaderButtonBlok): CardBlok[] {
    if (button.show_dropdown !== true) return [];
    const url = getLinkUrl(button.link);
    if (!url) return [];
    const baseSlug = getPathWithoutLang(url.split(/[?#]/, 1)[0]).slice(1);
    return (dropdownCards[baseSlug] || []).filter((card) => !!localizeHref(card.link));
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
    expandedMobileItem = null;
  }

  $effect(() => {
    if (!mobileMenuOpen) expandedMobileItem = null;
  });
</script>

<nav
  use:storyblokEditable={blok}
  class="header"
  style={blok.custom_styles ?? ""}
  aria-label={lang === 'es' ? 'Navegación principal' : 'Main navigation'}
>
  <a href={lang === "en" ? "/" : `/${lang}`} class="logo">
    <img src={logo} width="600" height="323" alt="Youth Alliance for Housing" />
  </a>

  <!-- Desktop menu -->
  <div class="desktop-menu">
    <div class="horizontal-menu">
      {#if buttons.length > 0}
        {#each buttons as button}
          {@const cards = getCards(button)}
          {@const hasDropdown = cards.length > 0}
          {@const openInNewTab = button.link?.target === '_blank'}
          {@const href = localizeHref(button.link)}

          {#if hasDropdown}
            <!-- Dropdown button -->
            <Dropdown
              id={`header-dropdown-${button._uid}`}
              align="right"
              openOnFocus={true}
              items={cards.map(card => {
                const newTab = card.link?.target === '_blank';
                return {
                  label: card.title,
                  href: localizeHref(card.link),
                  target: newTab ? "_blank" : undefined,
                  rel: newTab ? "noopener noreferrer" : undefined
                };
              })}
            >
              {#snippet trigger({ isOpen, menuId, triggerId, toggle })}
                <div class="nav-dropdown-trigger" style={button.custom_styles ?? ""}>
                  {#if href}
                    <a
                      href={href}
                      class="nav-button nav-parent-link"
                      target={openInNewTab ? "_blank" : undefined}
                      rel={openInNewTab ? "noopener noreferrer" : undefined}
                    >
                      {button.text}
                    </a>
                  {:else}
                    <span class="nav-button nav-parent-link">{button.text}</span>
                  {/if}
                  <button
                    id={triggerId}
                    type="button"
                    class="nav-dropdown-toggle"
                    aria-label={lang === 'es'
                      ? `${isOpen ? 'Cerrar' : 'Abrir'} submenú de ${button.text}`
                      : `${isOpen ? 'Close' : 'Open'} ${button.text} submenu`}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    aria-controls={menuId}
                    onclick={toggle}
                  >
                    <ChevronDown class={`nav-chevron${isOpen ? ' expanded' : ''}`} aria-hidden="true" />
                  </button>
                </div>
              {/snippet}
            </Dropdown>
          {:else}
            {#if href}
              <a
                href={href}
                class="nav-button"
                style={button.custom_styles ?? ""}
                target={openInNewTab ? "_blank" : undefined}
                rel={openInNewTab ? "noopener noreferrer" : undefined}
              >
                {button.text}
              </a>
            {:else}
              <span class="nav-button" style={button.custom_styles ?? ""}>{button.text}</span>
            {/if}
          {/if}
        {/each}
      {/if}
    </div>
    <div class="lang-switcher">
      {#each Object.entries(languages) as [code, name], i}
        {#if code === lang}
          <a
            class="lang-link active"
            href={getLanguageLink(code as Language)}
            hreflang={code}
            aria-current="true"
            aria-label={currentLanguageLabel(name)}
          >
            {code.toUpperCase()}
          </a>
        {:else}
          <a
            class="lang-link"
            href={getLanguageLink(code as Language)}
            hreflang={code}
            aria-label={switchLanguageLabel(name)}
          >
            {code.toUpperCase()}
          </a>
        {/if}
        {#if i !== Object.keys(languages).length - 1}
          <div class="lang-divider"></div>
        {/if}
      {/each}
    </div>
  </div>

  <!-- Mobile Sheet menu -->
  <Dialog.Root bind:open={mobileMenuOpen}>
    <Dialog.Trigger class="mobile-menu-trigger" aria-label={lang === 'es' ? 'Abrir menú de navegación' : 'Open navigation menu'}>
      <Menu class="mobile-menu-icon" aria-hidden="true" />
    </Dialog.Trigger>

    <Dialog.Portal>
      <Dialog.Overlay class="sheet-overlay" />

      <Dialog.Content class="sheet-panel">
          <Dialog.Title class="sr-only">{lang === 'es' ? 'Menú' : 'Menu'}</Dialog.Title>

          <Dialog.Close class="mobile-menu-close" aria-label={lang === 'es' ? 'Cerrar menú de navegación' : 'Close navigation menu'}>
            <X aria-hidden="true" />
          </Dialog.Close>

          <nav class="mobile-nav" aria-label={lang === 'es' ? 'Navegación móvil' : 'Mobile navigation'}>
            <!-- Language switcher -->
            <div class="mobile-lang-switcher">
              {#each Object.entries(languages) as [code, name]}
                {#if code === lang}
                  <a
                    class="mobile-lang-link active"
                    href={getLanguageLink(code as Language)}
                    hreflang={code}
                    aria-current="true"
                    aria-label={currentLanguageLabel(name)}
                    onclick={closeMobileMenu}
                  >
                    {code.toUpperCase()}
                  </a>
                {:else}
                  <a
                    class="mobile-lang-link"
                    href={getLanguageLink(code as Language)}
                    hreflang={code}
                    aria-label={switchLanguageLabel(name)}
                    onclick={closeMobileMenu}
                  >
                    {code.toUpperCase()}
                  </a>
                {/if}
              {/each}
            </div>

            <!-- Nav links from Storyblok -->
            {#if buttons.length > 0}
              <div class="mobile-nav-links">
                {#each buttons as button}
                  {@const cards = getCards(button)}
                  {@const hasDropdown = cards.length > 0}
                  {@const isExpanded = expandedMobileItem === button._uid}
                  {@const openInNewTab = button.link?.target === '_blank'}
                  {@const href = localizeHref(button.link)}

                  {#if hasDropdown}
                    <div class="mobile-expandable-item">
                      <div class="mobile-expandable-header">
                        {#if href}
                          <a
                            href={href}
                            class="mobile-menu-link-expandable"
                            style={button.custom_styles ?? ""}
                            target={openInNewTab ? "_blank" : undefined}
                            rel={openInNewTab ? "noopener noreferrer" : undefined}
                            onclick={closeMobileMenu}
                          >
                            {button.text}
                          </a>
                        {:else}
                          <span class="mobile-menu-link-expandable" style={button.custom_styles ?? ""}>{button.text}</span>
                        {/if}
                        <button
                          type="button"
                          class="mobile-chevron-button"
                          onclick={() => expandedMobileItem = isExpanded ? null : button._uid}
                          aria-label={lang === 'es'
                            ? `${isExpanded ? 'Contraer' : 'Expandir'} submenú de ${button.text}`
                            : `${isExpanded ? 'Collapse' : 'Expand'} ${button.text} submenu`}
                          aria-expanded={isExpanded}
                          aria-controls={`mobile-submenu-${button._uid}`}
                        >
                          <ChevronDown class="mobile-chevron {isExpanded ? 'expanded' : ''}" />
                        </button>
                      </div>
                      {#if isExpanded}
                        <div id={`mobile-submenu-${button._uid}`} class="mobile-dropdown-content">
                          {#each cards as card}
                            {@const newTab = card.link?.target === '_blank'}
                            <a
                              href={localizeHref(card.link)}
                              class="mobile-dropdown-item"
                              target={newTab ? "_blank" : undefined}
                              rel={newTab ? "noopener noreferrer" : undefined}
                              onclick={closeMobileMenu}
                            >
                              {card.title}
                            </a>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {:else}
                    {#if href}
                      <a
                        href={href}
                        class="mobile-menu-link"
                        style={button.custom_styles ?? ""}
                        target={openInNewTab ? "_blank" : undefined}
                        rel={openInNewTab ? "noopener noreferrer" : undefined}
                        onclick={closeMobileMenu}
                      >
                        {button.text}
                      </a>
                    {:else}
                      <span class="mobile-menu-link" style={button.custom_styles ?? ""}>{button.text}</span>
                    {/if}
                  {/if}
                {/each}
              </div>
            {/if}
          </nav>
        </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</nav>

<style>
  .header {
    display: flex;
    align-items: center;
    margin-bottom: 2rem;
  }

  .logo {
    margin-right: auto;
    width: 12rem;
    flex-shrink: 0;
    transition: transform 300ms;
    transform: perspective(1px) translateZ(0);
  }

  .logo img {
    width: 100%;
    height: auto;
    display: block;
  }

  .logo:hover {
    transform: scale(1.1) rotate(1deg);
  }

  /* Desktop menu */
  .desktop-menu {
    position: relative;
    display: none;
  }

  @media (min-width: 1024px) {
    .desktop-menu {
      display: block;
    }
  }

  .horizontal-menu {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .nav-button {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    background-color: var(--color-background);
    color: var(--color-primary);
    border-radius: var(--radius-md);
    font-weight: 500;
    font-size: 0.875rem;
    text-decoration: none;
    transition: background-color 150ms ease-in-out;
    cursor: pointer;
  }

  .nav-button:hover {
    background-color: var(--color-hover);
  }

  .nav-dropdown-trigger {
    display: inline-flex;
    align-items: stretch;
    border-radius: var(--radius-md);
    background-color: var(--color-background);
    color: var(--color-primary);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .nav-dropdown-trigger .nav-button {
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    background-color: transparent;
    color: inherit;
    font-size: inherit;
    font-weight: inherit;
  }

  .nav-dropdown-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.625rem;
    border: 0;
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .nav-dropdown-toggle:hover,
  .nav-dropdown-toggle:focus-visible {
    background-color: var(--color-hover);
  }

  :global(.nav-chevron) {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    margin-left: 0.25rem;
    transition: transform 150ms ease-in-out;
  }

  :global(.nav-chevron.expanded) {
    transform: rotate(180deg);
  }

  /* Desktop language switcher */
  .lang-switcher {
    position: absolute;
    right: 0;
    margin-top: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .lang-link {
    margin-bottom: 0;
    padding: 0 0.25rem;
    font-size: 0.875rem;
    color: var(--color-primary-foreground);
    text-decoration: none;
  }

  .lang-link.active {
    background-color: var(--color-background);
    border-radius: var(--radius-sm);
    color: var(--color-primary);
  }

  .lang-divider {
    width: 1px;
    height: 0.75rem;
    background-color: var(--color-primary-foreground);
  }

  /* Mobile menu trigger */
  :global(.mobile-menu-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    background-color: var(--color-background);
    padding: 0.5rem;
    border: none;
    cursor: pointer;
  }

  :global(.mobile-menu-trigger:focus-visible) {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-ring);
  }

  @media (min-width: 1024px) {
    :global(.mobile-menu-trigger) {
      display: none;
    }
  }

  :global(.mobile-menu-icon) {
    width: 2.25rem;
    height: 2.25rem;
    color: var(--color-primary);
  }

  /* Sheet overlay */
  :global(.sheet-overlay) {
    position: fixed;
    inset: 0;
    z-index: 50;
    background-color: var(--color-overlay);
  }

  /* Sheet panel — no horizontal padding so hovers go edge-to-edge */
  :global(.sheet-panel) {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    width: 75%;
    max-width: 24rem;
    background-color: var(--color-background);
    box-shadow: var(--shadow-lg);
    overflow-y: auto;
  }

  :global(.mobile-menu-close) {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    background-color: var(--color-background);
    color: var(--color-primary);
    cursor: pointer;
  }

  :global(.mobile-menu-close:hover),
  :global(.mobile-menu-close:focus-visible) {
    background-color: var(--color-hover);
  }

  /* Mobile nav */
  .mobile-nav {
    display: flex;
    flex-direction: column;
    padding-top: 1rem;
  }

  .mobile-lang-switcher {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    padding: 0 1rem 0.75rem;
    margin-bottom: 0.25rem;
    border-bottom: 1px solid var(--color-border);
  }

  .mobile-lang-link {
    padding: 0.25rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-primary);
    text-decoration: none;
  }

  .mobile-lang-link.active {
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);
    border-radius: var(--radius-sm);
  }

  /* Mobile nav links — full-bleed hover backgrounds */
  .mobile-menu-link-expandable {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 0.625rem 1rem;
    transition: background-color 150ms ease-in-out;
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
  }

  .mobile-menu-link-expandable:hover {
    background-color: var(--color-hover);
  }

  .mobile-expandable-header {
    display: flex;
    align-items: stretch;
  }

  .mobile-chevron-button {
    padding: 0.625rem;
    border: none;
    background: none;
    color: var(--color-primary);
    cursor: pointer;
    transition: background-color 150ms ease-in-out;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mobile-chevron-button:hover {
    background-color: var(--color-hover);
  }

  :global(.mobile-chevron) {
    width: 1rem;
    height: 1rem;
    transition: transform 200ms;
  }

  :global(.mobile-chevron.expanded) {
    transform: rotate(180deg);
  }

  .mobile-dropdown-item {
    display: block;
    padding: 0.5rem 1rem 0.5rem 2rem;
    color: var(--color-primary);
    text-decoration: none;
    transition: background-color 150ms ease-in-out;
    font-size: 0.875rem;
  }

  .mobile-dropdown-item:hover {
    background-color: var(--color-hover);
  }

  .mobile-menu-link {
    display: block;
    padding: 0.625rem 1rem;
    transition: background-color 150ms ease-in-out;
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
  }

  .mobile-menu-link:hover {
    background-color: var(--color-hover);
  }
</style>
