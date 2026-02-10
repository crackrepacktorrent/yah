<script lang="ts">
  import { page } from "$app/state";
  import { storyblokEditable } from "@storyblok/svelte";
  import { languages, type Language } from "$lib/lang";
  import type { HeaderBlok, HeaderButtonBlok, CardBlok } from "$lib/types/storyblok";
  import * as Sheet from "$lib/components/ui/sheet";
  import Dropdown from "$lib/components/Dropdown.svelte";
  import logo from "$lib/assets/logo.png";
  import Menu from "lucide-svelte/icons/menu";
  import ChevronDown from "lucide-svelte/icons/chevron-down";

  let expandedMobileItem = $state<string | null>(null);

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

<nav class="header flex items-center" style={blok.custom_styles ?? ""}>
  <a href={lang === "en" ? "/" : `/${lang}`} class="logo mr-auto w-[12rem] transition-transform duration-300">
    <img src={logo} alt="Youth Alliance for Housing logo" />
  </a>

  <!-- Desktop menu -->
  <div class="horizontal-menu-wrapper relative hidden lg:block">
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
                  <ChevronDown class="inline-block w-4 h-4 ml-1" />
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
    <div class="absolute right-0 mt-4 flex items-center space-x-2">
      {#each Object.entries(languages) as [code, name], i}
        {#if code === lang}
          <a
            class="mb-0 rounded-sm bg-white px-1 text-sm text-yahrange no-underline"
            href={getLanguageLink(code as Language)}
            hreflang={code}
            aria-current="true"
            aria-label="Current language: {name}"
          >
            {code.toUpperCase()}
          </a>
        {:else}
          <a
            class="mb-0 px-1 text-sm text-white no-underline"
            href={getLanguageLink(code as Language)}
            hreflang={code}
            aria-label="Switch to {name}"
          >
            {code.toUpperCase()}
          </a>
        {/if}
        {#if i !== Object.keys(languages).length - 1}
          <div class="h-3 w-[1px] bg-white"></div>
        {/if}
      {/each}
    </div>
  </div>

  <!-- Mobile Sheet menu -->
  <Sheet.Root>
    <Sheet.Trigger class="lg:hidden rounded-lg bg-white p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-yahrange/50" aria-label="Open navigation menu">
      <Menu class="h-9 w-9 text-yahrange" />
    </Sheet.Trigger>

    <Sheet.Content side="right" class="overflow-y-auto">
      <Sheet.Header class="sr-only">
        <Sheet.Title>Menu</Sheet.Title>
      </Sheet.Header>

      <nav class="flex flex-col gap-1 py-4 pt-6">
        <!-- Language switcher -->
        <div class="flex gap-2 justify-center pb-3 mb-3 border-b border-slate-200">
          {#each Object.entries(languages) as [code, name]}
            {#if code === lang}
              <a
                class="px-3 py-1 rounded-sm text-sm font-medium bg-yahrange text-white no-underline"
                href={getLanguageLink(code as Language)}
                hreflang={code}
                aria-current="true"
                aria-label="Current language: {name}"
              >
                {code.toUpperCase()}
              </a>
            {:else}
              <a
                class="px-3 py-1 text-sm font-medium text-yahrange no-underline"
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
          <div class="flex flex-col gap-1">
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
                      <ChevronDown class="h-4 w-4 transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}" />
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
    </Sheet.Content>
  </Sheet.Root>
</nav>

<style lang="postcss">
  .header {
    margin-bottom: 2rem;
  }

  .logo {
    transition-property: transform;
    transform: perspective(1px) translateZ(0);
  }

  .logo:hover {
    transform: scale(1.1) rotate(1deg);
  }

  .horizontal-menu {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  /* Navigation buttons */
  .nav-button {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    background-color: white;
    color: var(--color-yahrange);
    border: none;
    border-radius: var(--radius-md);
    font-weight: 500;
    font-size: 0.875rem;
    text-decoration: none;
    transition: background-color 150ms ease-in-out;
    cursor: pointer;
  }

  .nav-button:hover {
    background-color: var(--color-accent);
  }

  /* Mobile styles */
  .mobile-expandable-item {
    display: flex;
    flex-direction: column;
  }

  .mobile-expandable-header {
    display: flex;
    align-items: stretch;
    gap: 0;
  }

  .mobile-menu-link-expandable {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 0.625rem 1rem;
    text-align: left;
    transition: background-color 150ms ease-in-out;
    color: var(--color-yahrange);
    text-decoration: none;
    font-weight: 500;
  }

  .mobile-menu-link-expandable:hover {
    background-color: var(--color-accent);
  }

  .mobile-chevron-button {
    padding: 0.625rem;
    border: none;
    background: none;
    color: var(--color-yahrange);
    cursor: pointer;
    transition: background-color 150ms ease-in-out;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mobile-chevron-button:hover {
    background-color: var(--color-accent);
  }

  .mobile-dropdown-content {
    display: flex;
    flex-direction: column;
    margin-top: 0.25rem;
  }

  .mobile-dropdown-item {
    display: block;
    padding: 0.5rem 1rem 0.5rem 2rem;
    color: var(--color-yahrange);
    text-decoration: none;
    transition: background-color 150ms ease-in-out;
    font-size: 0.875rem;
  }

  .mobile-dropdown-item:hover {
    background-color: var(--color-accent);
  }

  .mobile-menu-link {
    display: block;
    width: 100%;
    padding: 0.625rem 1rem;
    text-align: left;
    transition: background-color 150ms ease-in-out;
    outline: none;
    border: none;
    color: var(--color-yahrange);
    text-decoration: none;
    font-weight: 500;
  }

  .mobile-menu-link:hover {
    background-color: var(--color-accent);
  }
</style>
