(function () {
  const modal = document.getElementById("leaflet-modal");
  if (!modal) return;

  const titleEl = document.getElementById("leaflet-viewer-title");
  const canvas = modal.querySelector("[data-pdf-canvas]");
  const imageEl = modal.querySelector("[data-image-viewer]");
  const messageEl = modal.querySelector("[data-viewer-message]");
  const pageIndicator = modal.querySelector("[data-page-indicator]");
  const prevBtn = modal.querySelector("[data-prev-page]");
  const nextBtn = modal.querySelector("[data-next-page]");
  const zoomInBtn = modal.querySelector("[data-zoom-in]");
  const zoomOutBtn = modal.querySelector("[data-zoom-out]");
  const downloadLink = modal.querySelector("[data-download-leaflet]");
  const viewerContent = modal.querySelector("[data-viewer-content]");
  const closeButtons = modal.querySelectorAll("[data-close-viewer]");
  const openButtons = document.querySelectorAll(".leaflet-open");

  let pdfLibPromise = null;
  let pdfDocument = null;
  let currentPage = 1;
  let pageCount = 1;
  let zoom = 1;
  let activeType = null;
  let activeFile = null;
  let renderToken = 0;

  function setViewerMessage(text) {
    messageEl.textContent = text;
    messageEl.hidden = false;
  }

  function hideViewerMessage() {
    messageEl.hidden = true;
  }

  function updateControls() {
    const isPdf = activeType === "pdf";
    prevBtn.disabled = !isPdf || currentPage <= 1;
    nextBtn.disabled = !isPdf || currentPage >= pageCount;
    pageIndicator.textContent = `Σελίδα ${currentPage} / ${pageCount}`;
  }

  function clampZoom(value) {
    return Math.min(3, Math.max(0.6, value));
  }

  function getViewerInnerWidth() {
    const horizontalPadding = 24;
    return Math.max(220, viewerContent.clientWidth - horizontalPadding);
  }

  function renderImageZoom() {
    if (!imageEl.naturalWidth) return;

    const fitWidth = Math.min(imageEl.naturalWidth, getViewerInnerWidth());
    const zoomedWidth = Math.max(160, Math.floor(fitWidth * zoom));
    imageEl.style.maxWidth = "none";
    imageEl.style.width = `${zoomedWidth}px`;
    imageEl.style.height = "auto";
  }

  function adjustZoom(step) {
    zoom = clampZoom(zoom + step);
    if (activeType === "pdf") {
      renderPdfPage();
    } else if (activeType === "image") {
      renderImageZoom();
    }
  }

  function loadPdfLibrary() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfLibPromise) return pdfLibPromise;

    pdfLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        if (!window.pdfjsLib) {
          reject(new Error("Το PDF.js δεν φορτώθηκε."));
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error("Αποτυχία φόρτωσης PDF.js."));
      document.head.appendChild(script);
    });

    return pdfLibPromise;
  }

  function clearView() {
    pdfDocument = null;
    currentPage = 1;
    pageCount = 1;
    zoom = 1;
    renderToken += 1;
    canvas.hidden = true;
    imageEl.hidden = true;
    imageEl.style.width = "";
    imageEl.style.height = "";
    imageEl.style.maxWidth = "";
    imageEl.removeAttribute("src");
    hideViewerMessage();
    updateControls();
  }

  async function renderPdfPage() {
    if (!pdfDocument) return;
    const localToken = ++renderToken;
    const page = await pdfDocument.getPage(currentPage);
    if (localToken !== renderToken) return;

    const baseViewport = page.getViewport({ scale: 1 });
    const fitScale = getViewerInnerWidth() / baseViewport.width;
    const effectiveScale = Math.max(0.2, fitScale * zoom);
    const viewport = page.getViewport({ scale: effectiveScale });
    const scale = window.devicePixelRatio || 1;
    const context = canvas.getContext("2d");
    canvas.width = Math.floor(viewport.width * scale);
    canvas.height = Math.floor(viewport.height * scale);
    canvas.style.maxWidth = "none";
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = "auto";
    context.setTransform(scale, 0, 0, scale, 0, 0);

    await page.render({ canvasContext: context, viewport }).promise;
    if (localToken !== renderToken) return;

    canvas.hidden = false;
    imageEl.hidden = true;
    updateControls();
  }

  async function openPdf(file) {
    try {
      const pdfjsLib = await loadPdfLibrary();
      const loadingTask = pdfjsLib.getDocument(file);
      pdfDocument = await loadingTask.promise;
      currentPage = 1;
      pageCount = pdfDocument.numPages;
      hideViewerMessage();
      await renderPdfPage();
    } catch (error) {
      clearView();
      setViewerMessage("Δεν ήταν δυνατή η προβολή του PDF.");
      console.error(error);
    }
  }

  function openImage(file) {
    imageEl.onload = () => {
      hideViewerMessage();
      imageEl.hidden = false;
      canvas.hidden = true;
      renderImageZoom();
      updateControls();
    };
    imageEl.onerror = () => {
      clearView();
      setViewerMessage("Δεν ήταν δυνατή η προβολή της εικόνας.");
    };
    imageEl.src = file;
  }

  function openModal({ title, file, type }) {
    activeType = type;
    activeFile = file;
    titleEl.textContent = title || "Προβολή φυλλαδίου";
    downloadLink.href = file;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    clearView();

    if (type === "pdf") {
      openPdf(file);
    } else {
      openImage(file);
    }
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    clearView();
    activeType = null;
    activeFile = null;
  }

  openButtons.forEach((button) => {
    button.addEventListener("click", () => {
      openModal({
        title: button.dataset.title,
        file: button.dataset.file,
        type: button.dataset.type === "pdf" ? "pdf" : "image"
      });
    });
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  prevBtn.addEventListener("click", () => {
    if (!pdfDocument || currentPage <= 1) return;
    currentPage -= 1;
    renderPdfPage();
  });

  nextBtn.addEventListener("click", () => {
    if (!pdfDocument || currentPage >= pageCount) return;
    currentPage += 1;
    renderPdfPage();
  });

  zoomInBtn.addEventListener("click", () => adjustZoom(0.15));
  zoomOutBtn.addEventListener("click", () => adjustZoom(-0.15));

  viewerContent.addEventListener(
    "wheel",
    (event) => {
      if (!activeType) return;
      event.preventDefault();
      adjustZoom(event.deltaY < 0 ? 0.1 : -0.1);
    },
    { passive: false }
  );

  window.addEventListener("resize", () => {
    if (modal.hidden || !activeType) return;
    if (activeType === "pdf") {
      renderPdfPage();
    } else if (activeType === "image") {
      renderImageZoom();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (modal.hidden) return;
    if (event.key === "Escape") {
      closeModal();
      return;
    }
    if (activeType === "pdf") {
      if (event.key === "ArrowRight") {
        nextBtn.click();
      } else if (event.key === "ArrowLeft") {
        prevBtn.click();
      }
    }
  });
})();
