<script lang="ts">
  import { storyblokEditable } from "@storyblok/svelte";
  import Instagram from "@lucide/svelte/icons/instagram";
  import Twitter from "@lucide/svelte/icons/twitter";
  import Facebook from "@lucide/svelte/icons/facebook";
  import Linkedin from "@lucide/svelte/icons/linkedin";
  import Youtube from "@lucide/svelte/icons/youtube";
  import type { FooterBlok } from "$lib/storyblok/types";
  import { getSafeHttpUrl } from "$lib/storyblok/client";

  let { blok }: { blok: FooterBlok } = $props();

  const defaultCopyright = `© ${new Date().getFullYear()} Youth Alliance for Housing`;
  const copyrightText = $derived(blok.copyright_text?.trim() || defaultCopyright);
  const socialTypes = {
    instagram: { icon: Instagram, label: 'Instagram' },
    twitter: { icon: Twitter, label: 'Twitter' },
    facebook: { icon: Facebook, label: 'Facebook' },
    linkedin: { icon: Linkedin, label: 'LinkedIn' },
    youtube: { icon: Youtube, label: 'YouTube' }
  } as const;
</script>

<footer use:storyblokEditable={blok} class="footer" style={blok.custom_styles ?? ""}>
  {#if blok.social_links && blok.social_links.length > 0}
    <nav class="social-links" aria-label="Social media">
      {#each blok.social_links as link}
        {@const href = getSafeHttpUrl(link.url)}
        {@const social = socialTypes[link.icon]}
        {#if href && social}
          <a
            {href}
            class="social-link"
            aria-label={social.label}
            target="_blank"
            rel="noopener noreferrer"
          >
            <social.icon size={28} aria-hidden="true" />
          </a>
        {/if}
      {/each}
    </nav>
  {/if}
  <div class="copyright">
    {copyrightText}
  </div>
</footer>

<style>
  .footer {
    margin-top: 2rem;
  }

  .social-links {
    display: flex;
    justify-content: center;
    margin-top: 1rem;
    gap: 0.5rem;
  }

  .social-link {
    display: flex;
    color: var(--color-primary-foreground);
    text-decoration: none;
    transition: opacity 150ms ease-in-out;
  }

  .social-link:hover {
    opacity: 0.9;
  }

  .copyright {
    color: var(--color-primary-foreground);
    font-size: 0.75rem;
    text-align: center;
    margin-top: 0.5rem;
  }
</style>
