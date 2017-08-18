import React, {PureComponent} from 'react';
import mat4 from 'gl-mat4';

const DEGREES_TO_RADIANS = Math.PI / 180;
/**
 * This component allows desktop users to use mouse to rotate the viewport.
 */
export default class EmulatedVRController extends PureComponent {

  constructor(props) {
    super(props);
    this.state = {dragStartPos: null};

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);

    this._isDragging = false;
    this._rotationX = 0;
    this._rotationY = 0;
  }

  _onMouseDown(evt) {
    this._isDragging = true;
    this._lastX = evt.clientX;
    this._lastY = evt.clientY;
  }

  _onMouseMove(evt) {
    if (this._isDragging) {
      const {vrDisplay, width, height} = this.props;

      this._rotationY += (evt.clientX - this._lastX) / width * 180;
      this._rotationX += (evt.clientY - this._lastY) / height * 180;

      if (this._rotationX > 89) {
        this._rotationX = 89;
      }
      if (this._rotationX < -89) {
        this._rotationX = -89;
      }
      const poseMatrix = mat4.create();
      mat4.rotateY(poseMatrix, poseMatrix, this._rotationY * DEGREES_TO_RADIANS);
      mat4.rotateX(poseMatrix, poseMatrix, this._rotationX * DEGREES_TO_RADIANS);

      vrDisplay.poseMatrix = poseMatrix;

      this._lastX = evt.clientX;
      this._lastY = evt.clientY;
    }
  }

  _onMouseUp() {
    this._isDragging = false;
  }

  render() {
    if (this.props.vrDisplay.isEmulated) {
      return (
        <div onMouseDown={this._onMouseDown}
          onMouseMove={this._onMouseMove}
          onMouseUp={this._onMouseUp} >
          {this.props.children}
        </div>
      );
    }
    return <div>{this.props.children}</div>;
  }
}
