const fs = require("fs");
const path = require("path");

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function readJsonFolder(folderPath) {
  if (!fs.existsSync(folderPath)) return [];
  return fs
    .readdirSync(folderPath)
    .filter((file) => file.toLowerCase().endsWith(".json"))
    .map((file) => {
      const fullPath = path.join(folderPath, file);
      const parsed = readJson(fullPath, {});
      return {
        ...parsed,
        _source: fullPath
      };
    });
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function safeText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value, fallback = 9999) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sortByOrderThenTitle(items) {
  return [...items].sort((a, b) => {
    const orderDiff = asNumber(a.order) - asNumber(b.order);
    if (orderDiff !== 0) return orderDiff;
    return safeText(a.title).localeCompare(safeText(b.title), "el");
  });
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function toAbsoluteAssetPath(root, publicPath) {
  if (!publicPath || typeof publicPath !== "string" || !publicPath.startsWith("/")) {
    return "";
  }
  return path.join(root, publicPath.replace(/^\/+/, "").replace(/\//g, path.sep));
}

function normalizeMediaPath(root, publicPath, fallbackSlug = "asset") {
  const candidate = safeText(publicPath).trim();
  if (!candidate) return "";

  const baseName = path.posix.basename(candidate);
  const isDotfile = baseName.startsWith(".") && baseName.length > 1;
  if (!isDotfile) {
    return candidate;
  }

  const sourceAbsolute = toAbsoluteAssetPath(root, candidate);
  if (!sourceAbsolute || !fs.existsSync(sourceAbsolute)) {
    return candidate;
  }

  const sourceBaseName = path.basename(sourceAbsolute);
  let ext = path.extname(sourceAbsolute);
  if (!ext && sourceBaseName.startsWith(".") && sourceBaseName.length > 1) {
    ext = sourceBaseName;
  }
  const stats = fs.statSync(sourceAbsolute);
  const slugBase = normalizeSlug(fallbackSlug) || "asset";
  const fingerprint = `${stats.size}-${Math.floor(stats.mtimeMs)}`;
  const outputFileName = `${slugBase}-${fingerprint}${ext.toLowerCase()}`;
  const generatedDir = path.join(root, ".generated", "upload-fixes");
  const generatedFile = path.join(generatedDir, outputFileName);

  ensureDir(generatedDir);
  fs.copyFileSync(sourceAbsolute, generatedFile);

  return `/assets/generated/upload-fixes/${outputFileName}`;
}

function extractCoordinatesFromGoogleUrl(url) {
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/,
    /q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1] && match?.[2]) {
      // Pattern !2d{lng}!3d{lat} needs reversal.
      if (pattern.source.startsWith("!2d")) {
        return `${match[2]},${match[1]}`;
      }
      return `${match[1]},${match[2]}`;
    }
  }

  return "";
}

function extractUrlFromRawMapValue(rawValue) {
  const candidate = safeText(rawValue).trim();
  if (!candidate) return "";

  if (candidate.startsWith("<")) {
    const srcMatch = candidate.match(/src\s*=\s*["']([^"']+)["']/i);
    if (srcMatch?.[1]) {
      return srcMatch[1].trim();
    }

    const hrefMatch = candidate.match(/https?:\/\/[^\s"'<>]+/i);
    if (hrefMatch?.[0]) {
      return hrefMatch[0].trim();
    }
  }

  return candidate;
}

function isGenericGoogleMapsRoot(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const host = parsed.hostname.toLowerCase();
    if (!(host.includes("google.") && host.includes("maps"))) {
      return false;
    }

    const path = parsed.pathname.replace(/\/+$/, "");
    const hasQuery = [...parsed.searchParams.keys()].length > 0;
    return (path === "" || path === "/" || path === "/maps") && !hasQuery;
  } catch {
    return false;
  }
}

function normalizeMapEmbedUrl(rawMapEmbedUrl, rawGoogleMapsUrl) {
  const fallback = "https://www.google.com/maps?q=40.266012,22.453522&output=embed";
  const embedCandidate = extractUrlFromRawMapValue(rawMapEmbedUrl);
  const mapsCandidate = extractUrlFromRawMapValue(rawGoogleMapsUrl);
  const candidate = embedCandidate || mapsCandidate || fallback;

  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    const isGoogleMaps =
      host.includes("google.") && (host.includes("maps") || url.pathname.includes("/maps"));

    if (!isGoogleMaps) {
      return candidate;
    }

    if (url.pathname.includes("/maps/embed") || url.searchParams.has("output")) {
      return candidate;
    }

    const coordinates = extractCoordinatesFromGoogleUrl(candidate);
    if (coordinates) {
      return `https://www.google.com/maps?q=${encodeURIComponent(coordinates)}&output=embed`;
    }

    const q = url.searchParams.get("q");
    if (q) {
      return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    }

    const placeMatch = url.pathname.match(/\/place\/([^/]+)/);
    if (placeMatch?.[1]) {
      const placeLabel = decodeURIComponent(placeMatch[1]).replace(/\+/g, " ");
      return `https://www.google.com/maps?q=${encodeURIComponent(placeLabel)}&output=embed`;
    }

    return `https://www.google.com/maps?q=${encodeURIComponent(candidate)}&output=embed`;
  } catch {
    return fallback;
  }
}

function normalizeGoogleMapsActionUrl(rawGoogleMapsUrl, rawMapEmbedUrl, rawAddress) {
  const defaultLatLng = "40.266012,22.453522";
  const mapsCandidate = extractUrlFromRawMapValue(rawGoogleMapsUrl);
  const embedCandidate = extractUrlFromRawMapValue(rawMapEmbedUrl);
  const preferred = mapsCandidate && !isGenericGoogleMapsRoot(mapsCandidate) ? mapsCandidate : embedCandidate;
  const fallbackAddress = safeText(rawAddress).trim();

  const makeSearchUrl = (query) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  if (!preferred) {
    return makeSearchUrl(fallbackAddress || defaultLatLng);
  }

  try {
    const url = new URL(preferred);
    const coordinates = extractCoordinatesFromGoogleUrl(preferred);
    if (coordinates) {
      return makeSearchUrl(coordinates);
    }

    const q = url.searchParams.get("q");
    if (q) {
      return makeSearchUrl(q);
    }

    const host = url.hostname.toLowerCase();
    const isGoogleMaps =
      host.includes("google.") && (host.includes("maps") || url.pathname.includes("/maps"));
    if (!isGoogleMaps) {
      return preferred;
    }

    if (!isGenericGoogleMapsRoot(preferred)) {
      return preferred;
    }

    return makeSearchUrl(fallbackAddress || defaultLatLng);
  } catch {
    return makeSearchUrl(fallbackAddress || defaultLatLng);
  }
}

function toPhoneHref(rawPhone) {
  const phone = safeText(rawPhone).trim();
  if (!phone) return "";
  const compact = phone.replace(/[^+\d]/g, "");
  if (!compact) return "";
  return `tel:${compact}`;
}

function toMailHref(rawEmail) {
  const email = safeText(rawEmail).trim();
  if (!email) return "";
  return `mailto:${email}`;
}

module.exports = () => {
  const root = process.cwd();
  const localeRoot = path.join(root, "content", "el");

  const settingsRaw = readJson(path.join(localeRoot, "site_settings.json"), {});
  const normalizedEmbedUrl = normalizeMapEmbedUrl(settingsRaw.map_embed_url, settingsRaw.google_maps_url);
  const settings = {
    ...settingsRaw,
    map_embed_url: normalizedEmbedUrl,
    google_maps_action_url: normalizeGoogleMapsActionUrl(
      settingsRaw.google_maps_url,
      settingsRaw.map_embed_url,
      settingsRaw.address
    ),
    primary_phone_href: toPhoneHref(settingsRaw.primary_phone),
    second_phone_href: toPhoneHref(settingsRaw.second_phone),
    email_href: toMailHref(settingsRaw.email)
  };

  const pages = readJsonFolder(path.join(localeRoot, "pages")).reduce((acc, item) => {
    const key = path.basename(item._source, ".json");
    acc[key] = { ...item };
    delete acc[key]._source;
    return acc;
  }, {});

  const categories = sortByOrderThenTitle(
    readJsonFolder(path.join(localeRoot, "categories")).map((item) => ({
      title: safeText(item.title, "Category"),
      slug: normalizeSlug(item.slug),
      intro: safeText(item.intro),
      card_image: normalizeMediaPath(root, safeText(item.card_image), `${item.slug || item.title}-card`),
      banner_image: normalizeMediaPath(
        root,
        safeText(item.banner_image),
        `${item.slug || item.title}-banner`
      ),
      order: asNumber(item.order),
      menu_title: safeText(item.menu_title || item.title),
      meta_description: safeText(item.meta_description),
      is_visible: item.is_visible !== false
    }))
  ).filter((category) => category.slug);

  const subcategories = sortByOrderThenTitle(
    readJsonFolder(path.join(localeRoot, "subcategories")).map((item) => ({
      title: safeText(item.title, "Subcategory"),
      slug: normalizeSlug(item.slug),
      category: normalizeSlug(item.category),
      intro: safeText(item.intro),
      banner_image: normalizeMediaPath(
        root,
        safeText(item.banner_image),
        `${item.slug || item.title}-banner`
      ),
      order: asNumber(item.order),
      meta_description: safeText(item.meta_description),
      is_visible: item.is_visible !== false
    }))
  ).filter((subcategory) => subcategory.slug && subcategory.category);

  const products = sortByOrderThenTitle(
    readJsonFolder(path.join(localeRoot, "products")).map((item) => ({
      title: safeText(item.title, "Product"),
      slug: normalizeSlug(item.slug || item.title),
      category: normalizeSlug(item.category),
      subcategory: normalizeSlug(item.subcategory),
      description: safeText(item.description),
      packaging: safeText(item.packaging),
      image: normalizeMediaPath(root, safeText(item.image), `${item.slug || item.title}-image`),
      order: asNumber(item.order),
      is_visible: item.is_visible !== false
    }))
  ).filter((product) => product.category);

  const leaflets = sortByOrderThenTitle(
    readJsonFolder(path.join(localeRoot, "leaflets")).map((item) => ({
      title: safeText(item.title, "Leaflet"),
      slug: normalizeSlug(item.slug || item.title),
      category: normalizeSlug(item.category),
      description: safeText(item.description),
      thumbnail: normalizeMediaPath(root, safeText(item.thumbnail), `${item.slug || item.title}-thumb`),
      file: normalizeMediaPath(root, safeText(item.file), `${item.slug || item.title}-file`),
      is_pdf: item.is_pdf !== false,
      order: asNumber(item.order),
      is_visible: item.is_visible !== false
    }))
  );

  const categoryBySlug = Object.fromEntries(categories.map((item) => [item.slug, item]));
  const subcategoriesByCategory = categories.reduce((acc, category) => {
    acc[category.slug] = subcategories.filter(
      (subcategory) => subcategory.category === category.slug && subcategory.is_visible
    );
    return acc;
  }, {});

  const productsByCategory = categories.reduce((acc, category) => {
    acc[category.slug] = products.filter(
      (product) => product.category === category.slug && !product.subcategory && product.is_visible
    );
    return acc;
  }, {});

  const productsBySubcategory = subcategories.reduce((acc, subcategory) => {
    const key = `${subcategory.category}/${subcategory.slug}`;
    acc[key] = products.filter(
      (product) =>
        product.category === subcategory.category &&
        product.subcategory === subcategory.slug &&
        product.is_visible
    );
    return acc;
  }, {});

  const navCategories = categories
    .filter((category) => category.is_visible)
    .map((category) => ({
      ...category,
      subcategories: subcategoriesByCategory[category.slug] || []
    }));

  return {
    locale: "el",
    settings,
    pages,
    categories,
    subcategories,
    products,
    leaflets,
    categoryBySlug,
    subcategoriesByCategory,
    productsByCategory,
    productsBySubcategory,
    navCategories
  };
};
