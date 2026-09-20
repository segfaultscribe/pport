const pluginRssObj = require("@11ty/eleventy-plugin-rss");
const pluginRss = pluginRssObj.default || pluginRssObj;

module.exports = function(eleventyConfig) {
  eleventyConfig.addPlugin(pluginRss);

  // Pass-through folders
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/images");

  // Writings collection
  eleventyConfig.addCollection("writings", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/writings/**/*.md");
  });

  // Date formatter for your UI
  eleventyConfig.addFilter("dateDisplay", function(dateObj) {
    return new Date(dateObj).toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  });

  return {
    dir: {
      input: "src",
      output: "_site"
    }
  };
};