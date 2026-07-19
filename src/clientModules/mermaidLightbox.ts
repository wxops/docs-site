let observer: MutationObserver | null = null;

// ── Shared overlay ──────────────────────────────────────────────────────────

function openLightbox(content: HTMLElement): void {
  const overlay = document.createElement("div");
  overlay.className = "mermaid-lightbox-overlay";

  const modal = document.createElement("div");
  modal.className = "mermaid-lightbox-modal";

  const close = document.createElement("button");
  close.className = "mermaid-lightbox-close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "✕";

  const hint = document.createElement("p");
  hint.className = "mermaid-lightbox-hint";
  hint.textContent = "Scroll or pinch to zoom · Click outside or press Esc to close";

  modal.appendChild(close);
  modal.appendChild(content);
  modal.appendChild(hint);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const dismiss = (): void => {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
      document.body.style.overflow = "";
    }
    document.removeEventListener("keydown", onKey);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") dismiss();
  };

  close.addEventListener("click", (e) => { e.stopPropagation(); dismiss(); });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) dismiss(); });
  document.addEventListener("keydown", onKey);

  requestAnimationFrame(() => overlay.classList.add("mermaid-lightbox-visible"));
}

// ── Mermaid ─────────────────────────────────────────────────────────────────

function openMermaidLightbox(container: Element): void {
  const svg = container.querySelector("svg");
  if (!svg) return;

  const wrap = document.createElement("div");
  wrap.className = "mermaid-lightbox-svg";

  const clone = svg.cloneNode(true) as SVGElement;
  clone.removeAttribute("width");
  clone.removeAttribute("height");
  clone.style.width = "100%";
  clone.style.height = "auto";
  wrap.appendChild(clone);

  openLightbox(wrap);
}

function attachMermaidLightbox(container: Element): void {
  if (container.getAttribute("data-lightbox-init")) return;
  if (!container.querySelector("svg")) return;
  container.setAttribute("data-lightbox-init", "true");
  container.addEventListener("click", () => openMermaidLightbox(container));
}

// ── Images ───────────────────────────────────────────────────────────────────

function openImageLightbox(img: HTMLImageElement): void {
  const wrap = document.createElement("div");
  wrap.className = "mermaid-lightbox-svg";

  const clone = document.createElement("img");
  clone.src = img.src;
  clone.alt = img.alt;
  clone.style.width = "100%";
  clone.style.height = "auto";
  clone.style.borderRadius = "6px";
  wrap.appendChild(clone);

  openLightbox(wrap);
}

function attachImageLightbox(img: HTMLImageElement): void {
  if (img.getAttribute("data-lightbox-init")) return;
  if (img.closest("a")) return; // already a link — don't intercept
  img.setAttribute("data-lightbox-init", "true");

  // Wrap in a div so ::after badge works (img is a void element)
  if (!img.parentElement?.classList.contains("img-zoomable-wrap")) {
    const wrap = document.createElement("div");
    wrap.className = "img-zoomable-wrap";
    img.parentNode?.insertBefore(wrap, img);
    wrap.appendChild(img);
  }

  img.addEventListener("click", () => openImageLightbox(img));
}

// ── Init ─────────────────────────────────────────────────────────────────────

function init(): void {
  document.querySelectorAll(".docusaurus-mermaid-container").forEach(attachMermaidLightbox);
  document.querySelectorAll<HTMLImageElement>(".markdown img").forEach(attachImageLightbox);

  observer?.disconnect();
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof Element)) continue;

        // Mermaid: SVG inserted inside a mermaid container
        const mermaidContainer = node.closest?.(".docusaurus-mermaid-container");
        if (mermaidContainer) {
          attachMermaidLightbox(mermaidContainer);
          continue;
        }
        node.querySelectorAll(".docusaurus-mermaid-container").forEach(attachMermaidLightbox);

        // Images inside doc content
        if (node instanceof HTMLImageElement && node.closest(".markdown")) {
          attachImageLightbox(node);
        }
        node.querySelectorAll<HTMLImageElement>(".markdown img").forEach(attachImageLightbox);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function onRouteDidUpdate(): void {
  init();
}
