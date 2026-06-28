const markdownIt = require("markdown-it");
const fs = require("fs");

module.exports = function (eleventyConfig) {
  const md = markdownIt({
    html: false,
    breaks: true,
    linkify: true
  });

  eleventyConfig.addFilter("markdown", (value) => md.render(value || ""));
  eleventyConfig.addFilter("where", (arr, key, value) =>
    (arr || []).filter((item) => item && item[key] === value)
  );
  eleventyConfig.addFilter("whereEmpty", (arr, key) =>
    (arr || []).filter((item) => !item || !item[key])
  );
  eleventyConfig.addFilter("sortBy", (arr, key) =>
    [...(arr || [])].sort((a, b) => {
      const av = a?.[key];
      const bv = b?.[key];
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      return av > bv ? 1 : -1;
    })
  );
  eleventyConfig.addFilter("findBy", (arr, key, value) =>
    (arr || []).find((item) => item && item[key] === value)
  );
  eleventyConfig.addFilter("slugPath", (value) => String(value || "").trim().toLowerCase());
  eleventyConfig.addFilter("json", (value) => JSON.stringify(value));

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ assets: "assets" });
  eleventyConfig.addPassthroughCopy({
    "node_modules/pdfjs-dist/build/pdf.min.mjs": "assets/vendor/pdfjs/pdf.min.mjs",
    "node_modules/pdfjs-dist/build/pdf.worker.min.mjs":
      "assets/vendor/pdfjs/pdf.worker.min.mjs",
    "node_modules/pdfjs-dist/LICENSE": "assets/vendor/pdfjs/LICENSE.txt",
    "node_modules/@fontsource/manrope/LICENSE": "assets/fonts/Manrope-LICENSE.txt"
  });
  for (const weight of [400, 500, 600, 700]) {
    for (const subset of ["greek", "latin"]) {
      const filename = `manrope-${subset}-${weight}-normal.woff2`;
      eleventyConfig.addPassthroughCopy({
        [`node_modules/@fontsource/manrope/files/${filename}`]: `assets/fonts/${filename}`
      });
    }
  }
  if (fs.existsSync(".generated")) {
    eleventyConfig.addPassthroughCopy({ ".generated": "assets/generated" });
  }
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy({ "src/favicon.svg": "favicon.svg" });
  eleventyConfig.addPassthroughCopy({ "src/site.webmanifest": "site.webmanifest" });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "dist"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    dataTemplateEngine: "njk"
  };
};
