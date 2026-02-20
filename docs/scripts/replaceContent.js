module.exports = function () {
  return function includeTag(content) {
    const replacedContent = content.replaceAll(
      "MLTL Annotate",
      "LSE"
    );

    return replacedContent;
  };
};
