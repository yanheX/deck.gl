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

import {experimental, Viewport} from 'deck.gl';
import {GL, setParameters} from 'luma.gl';

const {DeckGLMultiView} = experimental;

/* A flavor of the DeckGL component that renders VR using perspective viewports */
export default class DeckGLVR extends DeckGLMultiView {

  componentWillReceiveProps(nextProps, nextState) {
    super.componentWillReceiveProps(nextProps, nextState);

    if (this.props.vrDisplay !== nextProps.vrDisplay) {
      // We have a new VR display
      if (this.props.vrDisplay && this.state.isVRDisplayReady) {
        // Old VR display is presenting
        this.props.vrDisplay.exitPresent();
      }
      this._initializeVRDisplay(nextProps.vrDisplay, this.state);
    }
  }

  _onRendererInitialized(params) {
    super._onRendererInitialized(params);

    setParameters(params.gl, {
      depthTest: true,
      depthFunc: GL.LEQUAL
    });

    this._initializeVRDisplay(this.props.vrDisplay, params);
  }

  _updateLayers(nextProps) {
    super._updateLayers(nextProps);
  }

  _onRenderFrame(params) {
    super._onRenderFrame(params);
  }

  _initializeVRDisplay(display, {canvas}) {
    this.setState({isVRDisplayReady: false, canvas});

    if (display && canvas) {
      display.requestPresent([{
        source: canvas
      }]).then(() => {
        this.setState({isVRDisplayReady: true});
      }).catch(err => {
        console.error(err);
      });
    }
  }

  _getViewports() {
    const {vrDisplay, mapState, width, height} = this.props;
    const {isVRDisplayReady} = this.state;

    if (!isVRDisplayReady) {
      return [new Viewport(mapState)];
    }

    // Calculate viewports
    const frameData = vrDisplay.isEmulated ? {} : new window.VRFrameData();
    if (!vrDisplay.getFrameData(frameData)) {
      // Failed to get frame data
      return [new Viewport(mapState)];
    }

    return [
      // Left viewport
      new Viewport({
        ...mapState,
        x: 0,
        width: width / 2,
        height,
        zoom: null,
        viewMatrix: frameData.leftViewMatrix
      }),
      // Right viewport
      new Viewport({
        ...mapState,
        x: width / 2,
        width: width / 2,
        height,
        zoom: null,
        viewMatrix: frameData.rightViewMatrix
      })
    ];    
  }

}
