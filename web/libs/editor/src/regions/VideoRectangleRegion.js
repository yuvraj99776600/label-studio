import { types } from "mobx-state-tree";

import NormalizationMixin from "../mixins/Normalization";
import RegionsMixin from "../mixins/Regions";
import Registry from "../core/Registry";
import { AreaMixin } from "../mixins/AreaMixin";
import { onlyProps, VideoRegion } from "./VideoRegion";
import { interpolateProp } from "../utils/props";
import { rotateBboxCoords } from "../utils/bboxCoords";

const Model = types
  .model("VideoRectangleRegionModel", {
    type: "videorectangleregion",
  })
  .volatile(() => ({
    props: ["x", "y", "width", "height", "rotation"],
  }))
  .views((self) => ({
    getShape(frame) {
      let prev;
      let next;

      for (const item of self.sequence) {
        if (item.frame === frame) {
          return onlyProps(self.props, item);
        }

        if (item.frame > frame) {
          next = item;
          break;
        }
        prev = item;
      }

      if (!prev) return null;
      if (!next) return onlyProps(self.props, prev);

      return Object.fromEntries(self.props.map((prop) => [prop, interpolateProp(prev, next, frame, prop)]));
    },

    get bboxCoords() {
      const currentFrame = self.parent?.frame || 1;
      const shape = self.getShape(currentFrame);

      if (!shape) return null;

      const bboxCoords = {
        left: shape.x,
        top: shape.y,
        right: shape.x + shape.width,
        bottom: shape.y + shape.height,
      };

      if (shape.rotation === 0 || !self.parent) return bboxCoords;

      return rotateBboxCoords(bboxCoords, shape.rotation, { x: shape.x, y: shape.y }, self.parent.whRatio);
    },

    get bboxCoordsCanvas() {
      const currentFrame = self.parent?.frame || 1;

      // Check if region is in lifespan for current frame
      if (!self.isInLifespan(currentFrame)) return null;

      const bbox = self.bboxCoords;
      if (!bbox || !self.parent?.workingAreaCoords) return null;

      // Video regions store coordinates as percentages (0-100)
      // Convert them to pixel coordinates using video dimensions (not scaled)
      const { realWidth, realHeight } = self.parent.workingAreaCoords;

      return {
        left: (bbox.left * realWidth) / 100,
        top: (bbox.top * realHeight) / 100,
        right: (bbox.right * realWidth) / 100,
        bottom: (bbox.bottom * realHeight) / 100,
      };
    },

    getVisibility() {
      return true;
    },
  }))
  .actions((self) => ({
    updateShape(data, frame) {
      const newItem = {
        ...data,
        frame,
        enabled: true,
      };

      const kp = self.closestKeypoint(frame);
      const index = self.sequence.findIndex((item) => item.frame >= frame);

      if (index < 0) {
        self.sequence = [...self.sequence, newItem];
      } else {
        const keypoint = {
          ...(self.sequence[index] ?? {}),
          ...data,
          enabled: kp?.enabled ?? true,
          frame,
        };

        self.sequence = [
          ...self.sequence.slice(0, index),
          keypoint,
          ...self.sequence.slice(index + (self.sequence[index].frame === frame)),
        ];
      }
    },
  }));

const VideoRectangleRegionModel = types.compose(
  "VideoRectangleRegionModel",
  RegionsMixin,
  VideoRegion,
  AreaMixin,
  NormalizationMixin,
  Model,
);

Registry.addRegionType(VideoRectangleRegionModel, "video");

export { VideoRectangleRegionModel };
