/* global window */
import mat4 from 'gl-mat4';

const DEGREES_TO_RADIANS = Math.PI / 180;
const EYE_DISTANCE = 0.08;
const FOV_DEGREES_Y = 40;
const FOV_DEGREES_X_MIN = 35;
const FOV_DEGREES_X_MAX = 45;
const UP_VECTOR = [0, 1, 0];

export default class EmulatedVRDisplay {

  constructor() {
    this.depthFar = 1000;
    this.depthNear = 0.1;
    this.layers = [];
    this.isEmulated = true;

    this.leftEyeParameters = {
      offset: [-EYE_DISTANCE / 2, 0, 0],
      fieldOfView: {
        downDegrees: FOV_DEGREES_Y,
        leftDegrees: FOV_DEGREES_X_MAX,
        rightDegrees: FOV_DEGREES_X_MIN,
        upDegrees: FOV_DEGREES_Y
      }
    };
    this.rightEyeParameters = {
      offset: [EYE_DISTANCE / 2, 0, 0],
      fieldOfView: {
        downDegrees: FOV_DEGREES_Y,
        leftDegrees: FOV_DEGREES_X_MIN,
        rightDegrees: FOV_DEGREES_X_MAX,
        upDegrees: FOV_DEGREES_Y
      }
    };

    this.poseMatrix = mat4.create();

    this._leftEyeMatrix = this._getEyeMatrix(this.leftEyeParameters);
    this._rightEyeMatrix = this._getEyeMatrix(this.rightEyeParameters);
  }

  getEyeParameters(whichEye) {
    const viewport = this._getViewportSize();

    if (whichEye === 'right') {
      return {...this.rightEyeParameters, ...viewport};
    } else {
      return {...this.leftEyeParameters, ...viewport};
    }
  }

  getFrameData(vrFrameData) {
    if (!vrFrameData) {
      throw new Error('must supply a frameData object');
    }

    vrFrameData.pose = this.pose;
    vrFrameData.timestamp = Date.now();

    const viewport = this._getViewportSize();
    const projectionMatrix = mat4.perspective([],
      (FOV_DEGREES_X_MIN + FOV_DEGREES_X_MAX) * DEGREES_TO_RADIANS,
      viewport.renderWidth / viewport.renderHeight,
      this.depthNear,
      this.depthFar);

    vrFrameData.leftViewMatrix = mat4.multiply([], this.poseMatrix, this._leftEyeMatrix);
    vrFrameData.leftProjectionMatrix = mat4.multiply([], projectionMatrix, vrFrameData.leftViewMatrix);

    vrFrameData.rightViewMatrix = mat4.multiply([], this.poseMatrix, this._rightEyeMatrix);
    vrFrameData.rightProjectionMatrix = mat4.multiply([], projectionMatrix, vrFrameData.rightViewMatrix);

    return true;
  }

  requestPresent({source}) {
    this.layers.push(source);
    return Promise.resolve();
  }

  exitPresent() {
    this.layers.length = 0;
    return Promise.resolve();
  }

  submitFrame() {}

  _getViewportSize() {
    return {
      renderWidth: window.innerWidth / 2,
      renderHeight: window.innerHeight
    };
  }

  _getEyeMatrix({offset, fieldOfView}) {
    const matrix = mat4.create();
    // rotate
    const gazeDir = -(fieldOfView.leftDegrees - fieldOfView.rightDegrees) * DEGREES_TO_RADIANS;
    mat4.rotateY(matrix, matrix, gazeDir);
    // offset
    mat4.translate(matrix, matrix, offset);

    return matrix;
  }

}
