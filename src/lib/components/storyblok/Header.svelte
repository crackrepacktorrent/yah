<script lang="ts">
  import { page } from "$app/state";
  import { storyblokEditable } from "@storyblok/svelte";
  import { languages, type Language } from "$lib/lang";
  import type { HeaderBlok, HeaderButtonBlok, CardBlok } from "$lib/storyblok/types";
  import { Dialog } from "bits-ui";
  import Dropdown from "./Dropdown.svelte";
  import logo from "$lib/assets/logo.png";
  import Menu from "lucide-svelte/icons/menu";
  import ChevronDown from "lucide-svelte/icons/chevron-down";


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
      return pathWithoutLang === "/" ? "/" : pathWithoutLang;
    } else {
      return `/${targetLang}${pathWithoutLang}`;
    }
  }

  function getButtonHref(button: HeaderButtonBlok): string {
    const url = button.link?.cached_url || button.link?.url || "#";
    // If external URL, return as-is
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:") || url.startsWith("tel:")) {
      return url;
    }
    // Strip any existing language prefix, then add current language
    const pathWithoutLang = getPathWithoutLang(url);

    if (lang === "en") {
      return pathWithoutLang;
    }
    return `/${lang}${pathWithoutLang}`;
  }

  function getCards(button: HeaderButtonBlok): CardBlok[] {
    if (!button.show_dropdown) return [];

    const slug = button.link?.cached_url || button.link?.url || '';
    if (!slug) return [];

    // Strip language prefix - cards are stored with base slug
    const baseSlug = getPathWithoutLang(slug).slice(1); // Remove leading /
    return dropdownCards[baseSlug] || [];
  }

  function shouldOpenInNewTab(button: HeaderButtonBlok): boolean {
    return button.link?.target === '_blank';
  }
</script>

<nav class="header" style={blok.custom_styles ?? ""}>
  <a href={lang === "en" ? "/" : `/${lang}`} class="logo">
    <img src={logo} alt="Youth Alliance for Housing logo" />
  </a>

  <!-- Desktop menu -->
  <div class="desktop-menu">
    <div class="horizontal-menu">
      {#if buttons.length > 0}
        {#each buttons as button}
          {@const cards = getCards(button)}
          {@const hasDropdown = cards.length > 0}
          {@const openInNewTab = shouldOpenInNewTab(button)}

          {#if hasDropdown}
            <!-- Dropdown button -->
            <Dropdown
              align="right"
              items={cards.map(card => {
                const url = card.link?.cached_url || card.link?.url || "#";
                // Skip language prefix handling for external links and anchors
                if (url.startsWith('http') || url === '#') {
                  return {
                    label: card.title,
                    href: url,
                    target: card.link?.target === '_blank' ? "_blank" : undefined,
                    rel: card.link?.target === '_blank' ? "noopener noreferrer" : undefined
                  };
                }
                // Strip any existing language prefix, then add current language
                const pathWithoutLang = getPathWithoutLang(url);
                const cardOpenInNewTab = card.link?.target === '_blank';
                return {
                  label: card.title,
                  href: lang === "en" ? pathWithoutLang : `/${lang}${pathWithoutLang}`,
                  target: cardOpenInNewTab ? "_blank" : undefined,
                  rel: cardOpenInNewTab ? "noopener noreferrer" : undefined
                };
              })}
            >
              {#snippet trigger()}
                <a
                  href={getButtonHref(button)}
                  class="nav-button"
                  style={button.custom_styles ?? ""}
                  target={openInNewTab ? "_blank" : undefined}
                  rel={openInNewTab ? "noopener noreferrer" : undefined}
                >
                  {button.text}
                  <ChevronDown class="nav-chevron" />
                </a>
              {/snippet}
            </Dropdown>
          {:else}
            <!-- Regular button (also clickable when has dropdown) -->
            <a
              href={getButtonHref(button)}
              class="nav-button"
              style={button.custom_styles ?? ""}
              target={openInNewTab ? "_blank" : undefined}
              rel={openInNewTab ? "noopener noreferrer" : undefined}
            >
              {button.text}
            </a>
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
            aria-label="Current language: {name}"
          >
            {code.toUpperCase()}
          </a>
        {:else}
          <a
            class="lang-link"
            href={getLanguageLink(code as Language)}
            hreflang={code}
            aria-label="Switch to {name}"
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
    <Dialog.Trigger class="mobile-menu-trigger" aria-label="Open navigation menu">
      <Menu class="mobile-menu-icon" />
    </Dialog.Trigger>

    <Dialog.Portal>
      <Dialog.Overlay class="sheet-overlay" />

      <Dialog.Content class="sheet-panel">
          <Dialog.Title class="sr-only">Menu</Dialog.Title>

          <nav class="mobile-nav">
            <!-- Language switcher -->
            <div class="mobile-lang-switcher">
              {#each Object.entries(languages) as [code, name]}
                {#if code === lang}
                  <a
                    class="mobile-lang-link active"
                    href={getLanguageLink(code as Language)}
                    hreflang={code}
                    aria-current="true"
                    aria-label="Current language: {name}"
                  >
                    {code.toUpperCase()}
                  </a>
                {:else}
                  <a
                    class="mobile-lang-link"
                    href={getLanguageLink(code as Language)}
                    hreflang={code}
                    aria-label="Switch to {name}"
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
                  {@const openInNewTab = shouldOpenInNewTab(button)}

                  {#if hasDropdown}
                    <!-- Expandable item with link + chevron -->
                    <div class="mobile-expandable-item">
                      <div class="mobile-expandable-header">
                        <a
                          href={getButtonHref(button)}
                          class="mobile-menu-link-expandable"
                          style={button.custom_styles ?? ""}
                          target={openInNewTab ? "_blank" : undefined}
                          rel={openInNewTab ? "noopener noreferrer" : undefined}
                        >
                          {button.text}
                        </a>
                        <button
                          type="button"
                          class="mobile-chevron-button"
                          onclick={() => expandedMobileItem = isExpanded ? null : button._uid}
                          aria-label="Toggle menu"
                        >
                          <ChevronDown class="mobile-chevron {isExpanded ? 'expanded' : ''}" />
                        </button>
                      </div>
                      {#if isExpanded}
                        <div class="mobile-dropdown-content">
                          {#each cards as card}
                            {@const url = card.link?.cached_url || card.link?.url || "#"}
                            {@const cardOpenInNewTab = card.link?.target === '_blank'}
                            {@const href = (url.startsWith('http') || url === '#')
                              ? url
                              : (lang === "en" ? getPathWithoutLang(url) : `/${lang}${getPathWithoutLang(url)}`)}
                            <a
                              href={href}
                              class="mobile-dropdown-item"
                              target={cardOpenInNewTab ? "_blank" : undefined}
                              rel={cardOpenInNewTab ? "noopener noreferrer" : undefined}
                            >
                              {card.title}
                            </a>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {:else}
                    <!-- Regular link -->
                    <a
                      href={getButtonHref(button)}
                      class="mobile-menu-link"
                      style={button.custom_styles ?? ""}
                      target={openInNewTab ? "_blank" : undefined}
                      rel={openInNewTab ? "noopener noreferrer" : undefined}
                    >
                      {button.text}
                    </a>
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

  :global(.nav-chevron) {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    margin-left: 0.25rem;
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
