import React, {PureComponent} from 'react';
import {Matrix4, experimental} from 'math.gl';
const {SphericalCoordinates} = experimental;

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

    this.pitch = 90;
    this.bearing = 0;
    this.eye = [0, 0, 0];
    this.up = [0, 0, 1];
    this.position = [0, 0, -150];

    this._updateVRDisplay(props.vrDisplay);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.vrDisplay !== this.props.vrDisplay) {
      this._updateVRDisplay(nextProps.vrDisplay);
    }
  }

  _updateVRDisplay(vrDisplay) {
    if (vrDisplay.isEmulated) {
      const spherical = new SphericalCoordinates({bearing: this.bearing, pitch: this.pitch});
      const direction = spherical.toVector3().normalize();

      const viewMatrix = new Matrix4()
        .lookAt({eye: this.eye, center: direction.negate(), up: this.up})
        .translate(this.position);

      vrDisplay.poseMatrix = viewMatrix;
    }
  }

  _onMouseDown(evt) {
    this._isDragging = true;
    this._lastX = evt.clientX;
    this._lastY = evt.clientY;
  }

  _onMouseMove(evt) {
    if (this._isDragging) {
      const {width, height} = this.props;

      this.bearing += (evt.clientX - this._lastX) / width * 180;
      this.pitch += (evt.clientY - this._lastY) / height * 180;

      if (this.pitch > 180) {
        this.pitch = 180;
      }
      if (this.pitch < 0) {
        this.pitch = 0;
      }

      this._updateVRDisplay(this.props.vrDisplay);

      this._lastX = evt.clientX;
      this._lastY = evt.clientY;
    }
  }

  _onMouseUp() {
    this._isDragging = false;
  }

  render() {
    return (
      <div onMouseDown={this._onMouseDown}
        onMouseMove={this._onMouseMove}
        onMouseUp={this._onMouseUp} >
        {this.props.children}
      </div>
    );
  }
}
