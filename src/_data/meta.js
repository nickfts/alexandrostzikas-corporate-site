const fs = require("fs");
const path = require("path");

function normalizeSiteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const prefixed = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(prefixed);
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function readSiteSettings() {
  const settingsPath = path.join(process.cwd(), "content", "el", "site_settings.json");
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}

const settings = readSiteSettings();
const envSiteUrl = normalizeSiteUrl(process.env.SITE_URL);
const settingsSiteUrl = normalizeSiteUrl(settings.website_url);

module.exports = {
  siteUrl: envSiteUrl || settingsSiteUrl || "https://example.com",
  locale: "el_GR",
  currentYear: new Date().getFullYear(),
  defaultImage: "/assets/branding/logo-slogan.png",
  defaultDescription:
    "Επιλεγμένα προϊόντα τροφίμων με έμφαση στην ποιότητα, τη συνέπεια και την ανθρώπινη εξυπηρέτηση."
};
