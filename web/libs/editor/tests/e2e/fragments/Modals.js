const { I } = inject();

module.exports = {
  async seeWarning(text) {
    I.seeElement(".ant-modal");
    I.see("Warning");
    // Wait for modal content to be fully rendered
    await I.wait(0.5);
    I.see(text);
    I.see("OK");
  },
  dontSeeWarning(text) {
    I.dontSeeElement(".ant-modal");
    I.dontSee("Warning");
    I.dontSee(text);
  },
  closeWarning() {
    I.click("OK");
    I.waitToHide(".ant-modal");
  },
};
