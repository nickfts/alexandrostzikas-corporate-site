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
  if (fs.existsSync(".generated")) {
    eleventyConfig.addPassthroughCopy({ ".generated": "assets/generated" });
  }
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });
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
