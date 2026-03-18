<script lang="ts">
  import { onMount } from "svelte";
  import { Switch } from "$lib/components/admin";
  import Select from "./Select.svelte";
  import { getLogoDataUrl } from "./logo-path";

  let {
    url,
    title = "qr-code",
  }: {
    url: string;
    title?: string;
  } = $props();

  const presets = [
    { name: "Brown", fg: "#361d12", bg: "#fff7ef" },
    { name: "Orange", fg: "#ff6f00", bg: "#ffffff" },
    { name: "Magenta", fg: "#8f005a", bg: "#ffffff" },
    { name: "Inverted", fg: "#fff7ef", bg: "#361d12" },
  ];

  const dotStyles = [
    { name: "Rounded", value: "rounded" },
    { name: "Dots", value: "dots" },
    { name: "Square", value: "square" },
    { name: "Classy", value: "classy" },
    { name: "Classy Rounded", value: "classy-rounded" },
    { name: "Extra Rounded", value: "extra-rounded" },
  ] as const;

  const cornerStyles = [
    { name: "Extra Rounded", value: "extra-rounded" },
    { name: "Square", value: "square" },
    { name: "Dot", value: "dot" },
    { name: "Rounded", value: "rounded" },
    { name: "Classy", value: "classy" },
    { name: "Classy Rounded", value: "classy-rounded" },
  ] as const;

  let selectedPreset = $state(0);
  let selectedDotStyle = $state(0);
  let selectedCornerStyle = $state(0);
  let showLogo = $state(false);
  let qrContainer: HTMLDivElement;
  type QRCodeStylingInstance = {
    append: (el: HTMLElement) => void;
    download: (opts: { name: string; extension: string }) => void;
    getRawData: (ext: string) => Promise<Blob>;
  };

  let QRCodeStyling: any;
  let qr: QRCodeStylingInstance;

  onMount(async () => {
    const mod = await import("qr-code-styling");
    QRCodeStyling = mod.default;
    renderQR();
  });

  function renderQR() {
    if (!QRCodeStyling || !qrContainer) return;

    const preset = presets[selectedPreset];
    const dotType = dotStyles[selectedDotStyle].value;
    const cornerType = cornerStyles[selectedCornerStyle].value;
    const opts: any = {
      width: 1000,
      height: 1000,
      data: url,
      margin: 8,
      dotsOptions: {
        color: preset.fg,
        type: dotType,
      },
      cornersSquareOptions: {
        type: cornerType,
        color: preset.fg,
      },
      cornersDotOptions: {
        type: cornerType === "extra-rounded" ? "dot" : cornerType,
        color: preset.fg,
      },
      backgroundOptions: {
        color: preset.bg,
      },
      qrOptions: {
        errorCorrectionLevel: "H",
      },
    };

    if (showLogo) {
      opts.image = getLogoDataUrl(preset.fg);
      opts.imageOptions = {
        crossOrigin: "anonymous",
        margin: 4,
        imageSize: 0.35,
      };
    }

    qrContainer.innerHTML = "";
    qr = new QRCodeStyling(opts);
    qr.append(qrContainer);
  }

  $effect(() => {
    selectedPreset;
    selectedDotStyle;
    selectedCornerStyle;
    showLogo;
    url;
    renderQR();
  });

  function downloadSVG() {
    qr?.download({ name: `qr-${title}`, extension: "svg" });
  }

  function downloadPNG() {
    qr?.download({ name: `qr-${title}`, extension: "png" });
  }
</script>

<div class="qr-wrapper">
  <div class="qr-image" bind:this={qrContainer}></div>
  <div class="qr-controls">
    <div class="qr-downloads">
      <button class="dl-btn" onclick={downloadSVG}>SVG</button>
      <button class="dl-btn" onclick={downloadPNG}>PNG</button>
    </div>
    <div class="qr-presets">
      {#each presets as preset, i}
        <button
          class="preset-btn"
          class:preset-active={selectedPreset === i}
          onclick={() => (selectedPreset = i)}
          aria-label={preset.name}
          title={preset.name}
        >
          <span
            class="preset-swatch"
            style:background={preset.fg}
            style:border-color={preset.fg === "#ffffff" ? "#d1d5db" : preset.fg}
          ></span>
        </button>
      {/each}
    </div>
    <div class="qr-picker">
      <span class="picker-label">Dots</span>
      <Select value={String(selectedDotStyle)} onValueChange={(v) => (selectedDotStyle = Number(v))} options={dotStyles.map((s, i) => ({ value: String(i), label: s.name }))} />
    </div>
    <div class="qr-picker">
      <span class="picker-label">Corners</span>
      <Select value={String(selectedCornerStyle)} onValueChange={(v) => (selectedCornerStyle = Number(v))} options={cornerStyles.map((s, i) => ({ value: String(i), label: s.name }))} />
    </div>
    <Switch label="Logo" bind:checked={showLogo} />
  </div>
</div>

<style>
  .qr-wrapper {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .qr-image {
    flex: 1;
    min-width: 0;
  }

  .qr-image :global(canvas),
  .qr-image :global(svg) {
    display: block;
    width: 100%;
    height: auto;
    border-radius: var(--radius-md);
  }

  .qr-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .qr-downloads {
    display: flex;
    gap: 0.35rem;
  }

  .dl-btn {
    padding: 0.3rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-muted);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .dl-btn:hover {
    background: var(--color-hover);
    color: var(--color-foreground);
  }

  .qr-presets {
    display: flex;
    gap: 0.35rem;
  }

  .preset-btn {
    padding: 3px;
    border: 2px solid transparent;
    border-radius: 50%;
    background: none;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .preset-active {
    border-color: var(--color-primary);
  }

  .preset-swatch {
    display: block;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid;
  }

  .qr-picker {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .picker-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-muted);
  }

</style>
