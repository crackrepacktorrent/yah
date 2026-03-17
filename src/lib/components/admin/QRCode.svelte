<script lang="ts">
  import { onMount } from "svelte";
  import { Switch } from "$lib/components/admin";

  let {
    url,
    title = "qr-code",
  }: {
    url: string;
    title?: string;
  } = $props();

  const presets = [
    { name: "Default", fg: "#000000", bg: "#ffffff" },
    { name: "YAH Orange", fg: "#ff6f00", bg: "#ffffff" },
    { name: "Dark", fg: "#262637", bg: "#ffffff" },
    { name: "Inverted", fg: "#ffffff", bg: "#262637" },
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

  const logoSvg = `<svg viewBox="0 0 3274 1534" xmlns="http://www.w3.org/2000/svg"><g transform="translate(0,1534) scale(0.1,-0.1)" stroke="none"><path d="M18398 15330 c-11 -6 -18 -23 -18 -40 0 -38 17 -46 110 -53 277 -20 524 -224 611 -507 35 -111 33 -283 -4 -395 -38 -114 -90 -198 -182 -291 -66 -66 -98 -89 -175 -128 -96 -47 -200 -76 -278 -76 -59 0 -82 -14 -82 -50 0 -46 25 -53 131 -40 354 43 626 290 695 634 20 96 14 278 -11 371 -86 317 -373 551 -710 580 -43 3 -77 1 -87 -5z M17950 14624 c-311 -45 -526 -148 -725 -348 -465 -468 -460 -1224 11 -1690 198 -196 441 -307 733 -336 107 -11 116 -11 140 8 33 24 40 73 13 100 -15 15 -39 20 -118 25 -511 32 -930 439 -983 954 -43 417 185 837 562 1034 139 73 311 119 442 119 76 0 115 24 115 71 0 49 -30 69 -102 68 -35 -1 -74 -3 -88 -5z M17608 13503 c-24 -26 -23 -66 2 -88 16 -15 45 -20 133 -26 337 -22 635 -157 878 -399 241 -240 380 -542 405 -877 l7 -93 -876 0 -877 0 -2 -659 -3 -659 -745 1224 c-410 673 -747 1224 -750 1224 -3 0 -1204 -1941 -2670 -4313 l-2666 -4312 603 -3 603 -2 0 -2250 0 -2250 4130 0 4130 0 0 2250 0 2250 561 0 c445 0 560 3 556 13 -2 6 -422 698 -933 1537 l-929 1525 -5 2315 -6 2315 -21 93 c-43 187 -104 340 -192 485 -253 417 -711 694 -1181 714 -125 5 -136 4 -152 -14z M22150 6020 l0 -6000 1690 0 1690 0 0 2060 0 2060 1125 0 1125 0 0 -2060 0 -2060 1690 0 1690 0 0 1475 0 1475 495 0 495 0 0 -180 c0 -179 0 -181 25 -205 24 -25 73 -33 110 -19 45 18 45 8 45 963 l0 900 186 3 c181 3 186 4 205 27 38 47 17 132 -36 145 l-25 6 0 660 0 660 25 6 c53 13 74 98 36 145 -19 23 -24 24 -205 27 l-186 3 0 850 0 849 183 0 c179 0 184 1 205 23 44 47 16 147 -41 147 -16 0 -17 48 -17 665 0 637 1 665 18 665 57 0 84 106 39 148 l-23 22 -767 0 -767 0 0 1270 0 1270 -1690 0 -1690 0 0 -2435 0 -2435 -1125 0 -1125 0 0 2435 0 2435 -1690 0 -1690 0 0 -6000z m9290 2625 l0 -665 -140 0 -140 0 0 665 0 665 140 0 140 0 0 -665z m380 0 l0 -665 -145 0 -145 0 0 665 0 665 145 0 145 0 0 -665z m370 0 l0 -665 -140 0 -140 0 0 665 0 665 140 0 140 0 0 -665z m380 0 l0 -665 -145 0 -145 0 0 665 0 665 145 0 145 0 0 -665z m-420 -955 l0 -120 -495 0 -495 0 0 120 0 120 495 0 495 0 0 -120z m0 -360 l0 -140 -495 0 -495 0 0 140 0 140 495 0 495 0 0 -140z m0 -370 l0 -140 -495 0 -495 0 0 140 0 140 495 0 495 0 0 -140z m0 -380 l0 -140 -495 0 -495 0 0 140 0 140 495 0 495 0 0 -140z m0 -350 l0 -120 -495 0 -495 0 0 120 0 120 495 0 495 0 0 -120z m-710 -960 l0 -660 -140 0 -140 0 0 660 0 660 140 0 140 0 0 -660z m380 0 l0 -660 -145 0 -145 0 0 660 0 660 145 0 145 0 0 -660z m370 0 l0 -660 -140 0 -140 0 0 660 0 660 140 0 140 0 0 -660z m380 0 l0 -660 -145 0 -145 0 0 660 0 660 145 0 145 0 0 -660z m-420 -960 l0 -120 -495 0 -495 0 0 120 0 120 495 0 495 0 0 -120z m0 -350 l0 -140 -495 0 -495 0 0 140 0 140 495 0 495 0 0 -140z m0 -380 l0 -140 -495 0 -495 0 0 140 0 140 495 0 495 0 0 -140z m0 -370 l0 -140 -495 0 -495 0 0 140 0 140 495 0 495 0 0 -140z M0 11983 c0 -5 1024 -1693 2275 -3753 l2275 -3745 0 -2242 0 -2243 1675 0 1675 0 0 2269 0 2270 2275 3720 c1251 2046 2275 3723 2275 3726 0 3 -838 5 -1862 5 l-1863 0 -1235 -2175 c-679 -1196 -1237 -2174 -1240 -2174 -3 0 -557 977 -1231 2172 l-1226 2172 -1897 3 c-1043 1 -1896 -1 -1896 -5z"/></g></svg>`;

  function getLogoUrl(color: string): string {
    const colored = logoSvg.replace("<g ", `<g fill="${color}" `);
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(colored);
  }

  let selectedPreset = $state(0);
  let selectedDotStyle = $state(0);
  let selectedCornerStyle = $state(0);
  let showLogo = $state(false);
  let qrContainer: HTMLDivElement;
  let QRCodeStyling: any;
  let qr: any;

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
      opts.image = getLogoUrl(preset.fg);
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
      <select
        class="picker-select"
        value={selectedDotStyle}
        onchange={(e) =>
          (selectedDotStyle = Number(
            (e.target as HTMLSelectElement).value,
          ))}
      >
        {#each dotStyles as style, i}
          <option value={i}>{style.name}</option>
        {/each}
      </select>
    </div>
    <div class="qr-picker">
      <span class="picker-label">Corners</span>
      <select
        class="picker-select"
        value={selectedCornerStyle}
        onchange={(e) =>
          (selectedCornerStyle = Number(
            (e.target as HTMLSelectElement).value,
          ))}
      >
        {#each cornerStyles as style, i}
          <option value={i}>{style.name}</option>
        {/each}
      </select>
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
    background: var(--color-border-light);
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

  .picker-select {
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-foreground);
    font-size: 0.8rem;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .picker-select:hover {
    border-color: var(--color-primary);
  }

  .picker-select:focus {
    outline: none;
    border-color: var(--color-primary);
  }
</style>
