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

module.exports = () => {
  const root = process.cwd();
  const localeRoot = path.join(root, "content", "el");

  const settings = readJson(path.join(localeRoot, "site_settings.json"), {});
  const pages = readJsonFolder(path.join(localeRoot, "pages")).reduce((acc, item) => {
    const key = path.basename(item._source, ".json");
    acc[key] = { ...item };
    delete acc[key]._source;
    return acc;
  }, {});

  const categories = sortByOrderThenTitle(
    readJsonFolder(path.join(localeRoot, "categories")).map((item) => ({
      title: safeText(item.title, "Κατηγορία"),
      slug: normalizeSlug(item.slug),
      intro: safeText(item.intro),
      card_image: safeText(item.card_image),
      banner_image: safeText(item.banner_image),
      order: asNumber(item.order),
      menu_title: safeText(item.menu_title || item.title),
      meta_description: safeText(item.meta_description),
      is_visible: item.is_visible !== false
    }))
  ).filter((category) => category.slug);

  const subcategories = sortByOrderThenTitle(
    readJsonFolder(path.join(localeRoot, "subcategories")).map((item) => ({
      title: safeText(item.title, "Υποκατηγορία"),
      slug: normalizeSlug(item.slug),
      category: normalizeSlug(item.category),
      intro: safeText(item.intro),
      banner_image: safeText(item.banner_image),
      order: asNumber(item.order),
      meta_description: safeText(item.meta_description),
      is_visible: item.is_visible !== false
    }))
  ).filter((subcategory) => subcategory.slug && subcategory.category);

  const products = sortByOrderThenTitle(
    readJsonFolder(path.join(localeRoot, "products")).map((item) => ({
      title: safeText(item.title, "Προϊόν"),
      slug: normalizeSlug(item.slug || item.title),
      category: normalizeSlug(item.category),
      subcategory: normalizeSlug(item.subcategory),
      description: safeText(item.description),
      packaging: safeText(item.packaging),
      image: safeText(item.image),
      order: asNumber(item.order),
      is_visible: item.is_visible !== false
    }))
  ).filter((product) => product.category);

  const leaflets = sortByOrderThenTitle(
    readJsonFolder(path.join(localeRoot, "leaflets")).map((item) => ({
      title: safeText(item.title, "Φυλλάδιο"),
      slug: normalizeSlug(item.slug || item.title),
      category: normalizeSlug(item.category),
      description: safeText(item.description),
      thumbnail: safeText(item.thumbnail),
      file: safeText(item.file),
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
