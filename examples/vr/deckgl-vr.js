// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import DeckGL from 'deck.gl';
import {GL, setParameters} from 'luma.gl';
import {PerspectiveViewport} from 'deck.gl';
import vec3 from 'gl-vec3';

function noop() {}
const EYE_DIST = 0.1;

function getEyePositions({
  eye,
  lookAt = [0, 0, 0],
  up = [0, 1, 0]
}, distance) {
  const v = vec3.subtract([], eye, lookAt);
  const perp = vec3.cross([], v, up);
  vec3.normalize(perp, perp);
  const leftEyeOffset = vec3.scale([], perp, distance / 2);
  return {
    left: vec3.add([], eye, leftEyeOffset),
    right: vec3.subtract([], eye, leftEyeOffset)
  }
}

function getPerspectiveViewport({
  width,
  height,
  eye,
  lookAt = [0, 0, 0],
  up = [0, 1, 0],
  fovy = 75,
  near = 1,
  far = 100
}) {
  return new PerspectiveViewport({
    width: width / 2,
    height,
    eye,
    lookAt,
    fovy,
    near,
    far
  }); 
}

/* A flavor of the DeckGL component that renders VR using perspective viewports */
export default class DeckGLVR extends DeckGL {

  _updateLayers(nextProps) {
    // If Viewport is not supplied, create one from mercator props
    const viewport = nextProps.leftViewport || getPerspectiveViewport(nextProps);
    super._updateLayers(Object.assign({}, nextProps, {viewport}));
  }

  _onRendererInitialized(params) {
    super._onRendererInitialized(params);

    setParameters(params.gl, {
      depthTest: true,
      depthFunc: GL.LEQUAL
    });
  }

  _onRenderFrame({gl}) {
    const redraw = this.layerManager.needsRedraw({clearRedrawFlags: true});
    if (!redraw) {
      return;
    }

    const props = this.props;
    let {leftViewport, rightViewport} = props;

    if (!leftViewport || !rightViewport) {
      const eyes = getEyePositions(props, EYE_DIST);
      leftViewport = getPerspectiveViewport({...props, eye: eyes.left});
      rightViewport = getPerspectiveViewport({...props, eye: eyes.right});
    }

    // clear depth and color buffers
    gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

    this.effectManager.preDraw();

    // render left viewport
    const {width, height} = gl.canvas;
    setParameters(gl, {
      viewport: [0, 0, width / 2, height]
    });
    this.layerManager.setViewport(leftViewport).drawLayers({pass: 'left viewport'});

    // render right viewport
    setParameters(gl, {
      viewport: [width / 2, 0, width / 2, height]
    });
    this.layerManager.setViewport(rightViewport).drawLayers({pass: 'right viewport'});

    this.effectManager.draw();
  }

}
