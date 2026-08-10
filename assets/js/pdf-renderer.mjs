import * as pdfjsLib from "../vendor/pdfjs/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "../vendor/pdfjs/pdf.worker.min.mjs",
  import.meta.url,
).href;

const pdfCache = new Map();
const renderTimers = new WeakMap();
const renderVersions = new WeakMap();

function loadPdf(url) {
  if (!pdfCache.has(url)) {
    pdfCache.set(url, pdfjsLib.getDocument(url).promise);
  }
  return pdfCache.get(url);
}

async function renderPdf(container) {
  const url = container.dataset.pdf;
  const canvas = container.querySelector(".pdf-canvas");
  const bounds = container.getBoundingClientRect();

  if (!url || !canvas || bounds.width < 1 || bounds.height < 1) return;

  const version = (renderVersions.get(container) || 0) + 1;
  renderVersions.set(container, version);

  const pdf = await loadPdf(url);
  const page = await pdf.getPage(1);
  if (renderVersions.get(container) !== version) return;

  const baseViewport = page.getViewport({ scale: 1 });
  const fit = container.dataset.pdfFit || "contain";
  const scaleX = bounds.width / baseViewport.width;
  const scaleY = bounds.height / baseViewport.height;
  const cssScale = fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: cssScale * pixelRatio });
  const cssWidth = viewport.width / pixelRatio;
  const cssHeight = viewport.height / pixelRatio;

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const context = canvas.getContext("2d", { alpha: false });
  context.save();
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();

  await page.render({
    canvasContext: context,
    viewport,
    background: "#ffffff",
  }).promise;

  if (renderVersions.get(container) === version) {
    container.classList.add("pdf-rendered");
  }
}

function scheduleRender(container) {
  window.clearTimeout(renderTimers.get(container));
  renderTimers.set(
    container,
    window.setTimeout(() => {
      renderPdf(container).catch((error) => {
        console.error(`Unable to render ${container.dataset.pdf}`, error);
      });
    }, 80),
  );
}

const pdfSources = [...document.querySelectorAll(".pdf-source[data-pdf]")];
const resizeObserver = new ResizeObserver((entries) => {
  entries.forEach(({ target }) => scheduleRender(target));
});

pdfSources.forEach((container) => {
  resizeObserver.observe(container);
  scheduleRender(container);
});
