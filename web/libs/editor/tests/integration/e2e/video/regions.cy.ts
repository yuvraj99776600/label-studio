import { Labels, LabelStudio, Sidebar, VideoView } from "@humansignal/frontend-test/helpers/LSF/index";
import { simpleVideoConfig, simpleVideoData, simpleVideoResult } from "../../data/video_segmentation/regions";

describe("Video segmentation", () => {
  it("Should be able to draw a simple rectangle", () => {
    LabelStudio.params().config(simpleVideoConfig).data(simpleVideoData).withResult([]).init();

    LabelStudio.waitForObjectsReady();
    VideoView.waitForStableState();
    Sidebar.hasNoRegions();

    Labels.select("Label 1");

    VideoView.drawRectRelative(0.2, 0.2, 0.6, 0.6);

    Sidebar.hasRegions(1);
  });

  it("Should have changes in canvas", () => {
    LabelStudio.params().config(simpleVideoConfig).data(simpleVideoData).withResult([]).init();
    LabelStudio.waitForObjectsReady();

    // Wait for video to be fully loaded and stable
    VideoView.waitForStableState();
    Sidebar.hasNoRegions();

    // Capture initial canvas state
    VideoView.captureCanvas("canvas");

    Labels.select("Label 2");
    VideoView.drawRectRelative(0.2, 0.2, 0.6, 0.6);

    // Wait for the region to be rendered in Konva
    VideoView.waitForRegionInKonvaByIndex(0);
    VideoView.waitForStableState();

    Sidebar.hasRegions(1);

    VideoView.canvasShouldChange("canvas", 0);
  });

  it("Should be invisible out of the lifespan (rectangle)", () => {
    LabelStudio.params().config(simpleVideoConfig).data(simpleVideoData).withResult(simpleVideoResult).init();
    LabelStudio.waitForObjectsReady();

    // Wait for video and regions to be fully loaded
    VideoView.waitForRegionInKonvaByIndex(0);
    VideoView.waitForStableState();

    Sidebar.hasRegions(1);

    VideoView.captureCanvas("canvas");

    VideoView.clickAtFrame(4);
    VideoView.waitForFrame(4);
    VideoView.waitForRegionNotInKonvaByIndex(0);
    VideoView.waitForStableState();

    VideoView.canvasShouldChange("canvas", 0);
  });

  it("Should be invisible out of the lifespan (transformer)", () => {
    LabelStudio.params().config(simpleVideoConfig).data(simpleVideoData).withResult(simpleVideoResult).init();
    LabelStudio.waitForObjectsReady();

    // Wait for frame change to be fully processed
    VideoView.waitForRegionInKonvaByIndex(0);
    VideoView.waitForStableState();
    Sidebar.hasRegions(1);

    cy.log("Remember an empty canvas state");
    VideoView.clickAtFrame(4);
    VideoView.waitForFrame(4);
    VideoView.waitForRegionNotInKonvaByIndex(0);
    VideoView.waitForStableState();
    VideoView.captureCanvas("canvas");

    VideoView.clickAtFrame(3);
    VideoView.waitForFrame(3);
    VideoView.waitForRegionInKonvaByIndex(0);
    VideoView.waitForStableState();

    cy.log("Select region");
    VideoView.clickAtRelative(0.5, 0.5);
    Sidebar.hasSelectedRegions(1);

    VideoView.clickAtFrame(4);
    VideoView.waitForFrame(4);
    VideoView.waitForRegionNotInKonvaByIndex(0);
    VideoView.waitForStableState();

    Sidebar.hasSelectedRegions(1);

    VideoView.canvasShouldNotChange("canvas", 0);
  });
});
