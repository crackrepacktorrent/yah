<script lang="ts">
  import { storyblokEditable } from "@storyblok/svelte";
  import { onMount } from "svelte";
  import type { ShortlinkBlok } from "$lib/types/storyblok";

  let { blok }: { blok: ShortlinkBlok } = $props();

  const siteUrl = (import.meta.env.VITE_SITE_URL || 'https://y4h.org').replace(/\/$/, '');
  let fullUrl = $derived(`${siteUrl}/${blok.slug}`);

  let qrContainer: HTMLDivElement;
  let qrCodeInstance: any = null;

  onMount(async () => {
    const { default: QRCodeStyling } = await import('qr-code-styling');

    qrCodeInstance = new QRCodeStyling({
      width: 200,
      height: 200,
      data: fullUrl,
      dotsOptions: {
        color: '#ff6f00',
        type: 'rounded',
      },
      backgroundOptions: {
        color: '#ffffff',
      },
      cornersSquareOptions: {
        color: '#ff6f00',
        type: 'extra-rounded',
      },
      cornersDotOptions: {
        color: '#ff6f00',
        type: 'dot',
      },
    });

    qrCodeInstance.append(qrContainer);
  });

  function downloadSVG() {
    qrCodeInstance?.download({ name: `qr-${blok.slug}`, extension: 'svg' });
  }

  function downloadPNG() {
    qrCodeInstance?.download({ name: `qr-${blok.slug}`, extension: 'png' });
  }
</script>

<div use:storyblokEditable={blok} class="shortlink-card">
  <div class="shortlink-info">
    <div class="shortlink-path">{siteUrl}/{blok.slug}</div>
    <div class="shortlink-dest">
      <span class="shortlink-label">Destination:</span>
      <a href={blok.destination_url} target="_blank" rel="noopener noreferrer">{blok.destination_url}</a>
    </div>
    <div class="shortlink-type">
      <span class="shortlink-label">Redirect:</span>
      {blok.http_status === '302' ? 'Temporary (302)' : 'Permanent (301)'}
    </div>
  </div>

  <div class="shortlink-qr">
    <div bind:this={qrContainer} class="qr-container"></div>
    <div class="qr-actions">
      <button onclick={downloadSVG} class="qr-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        SVG
      </button>
      <button onclick={downloadPNG} class="qr-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        PNG
      </button>
    </div>
  </div>
</div>

<style>
  .shortlink-card {
    display: flex;
    gap: 1.5rem;
    align-items: center;
    padding: 1rem 1.25rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background: #fff;
    color: #1f2937;
  }

  .shortlink-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .shortlink-path {
    font-weight: 700;
    font-size: 1.05rem;
    color: #ff6f00;
  }

  .shortlink-dest a {
    color: #2563eb;
    text-decoration: underline;
    word-break: break-all;
  }

  .shortlink-label {
    font-weight: 600;
    margin-right: 0.25rem;
  }

  .shortlink-type {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .shortlink-qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .qr-container {
    width: 200px;
    height: 200px;
  }

  .qr-actions {
    display: flex;
    gap: 0.5rem;
  }

  .qr-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.85rem;
    font-size: 0.8rem;
    font-weight: 600;
    border: none;
    border-radius: 0.375rem;
    background: #ff6f00;
    color: #fff;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .qr-btn:hover {
    background: #e56200;
  }
</style>
