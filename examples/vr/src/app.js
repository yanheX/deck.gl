/* global document,navigator */
import React, {Component} from 'react';
import {render} from 'react-dom';
import {PointCloudLayer, COORDINATE_SYSTEM} from 'deck.gl';
import DeckGLVR from './deckgl-vr';
import EmulatedVRController from './emulated-vr-controller';
import EmulatedVRDisplay from './emulated-vr-display';

import loadData from './data-loader';
import vec3_normalize from 'gl-vec3/normalize';

const getPosition = ({x, y, z}) => [x, z, y];

const getNormal = ({vx, vy, vz}) => {
  const n = vec3_normalize([], [vx, vz, vy]);
  return n.length === 0 ? [0, 0, 1] : n;
};

const getColor = ({absmag, ci}) => {
  // absmag { max: 19.629, min: -16.68 }
  // ci { max: 5.46, min: -0.4 }

  const l = (absmag + 18) / 40 + 0.5;
  const b = (3 - ci) / 4;
  return [
    255 * (1 - b),
    255,
    255 * b,
    255 * l
  ];
};

class Root extends Component {

  constructor(props) {
    super(props);
    this.state = {
      // Fallback display parameters. Only used if no VR headset is present.
      vrDisplay: new EmulatedVRDisplay(),
      data: null
    };
    this._onHover = this._onHover.bind(this);
  }

  componentDidMount() {
    loadData(data => this.setState({data}));

    // Get VR displays
    if (navigator && navigator.getVRDisplays) {
      navigator.getVRDisplays()
      .then(displays => {
        const vrDisplay = displays.find(d => d.isConnected);
        if (vrDisplay) {
          this.setState({vrDisplay});
        }
      });
    }
  }

  _onHover(info) {
    const hoveredStarName = info && info.object.proper;
    if (this.state.hoveredStarName !== hoveredStarName) {
      this.setState({hoveredStarName});
    }
  }

  _renderHoveredItem({width, height}) {
    const {hoveredStarName} = this.state;

    if (!hoveredStarName) {
      return null;
    }

    return <div className="tooltip">{hoveredStarName}</div>
  }

  render() {
    const {vrDisplay, data} = this.state;

    if (!data) {
      return null;
    }
    const {renderWidth, renderHeight} = vrDisplay.getEyeParameters();
    const width = renderWidth * 2;
    const height = renderHeight;

    const pointCloudLayer = new PointCloudLayer({
      data,
      pickable: true,
      projectionMode: COORDINATE_SYSTEM.IDENTITY,
      getPosition,
      getNormal,
      getColor,
      opacity: 1,
      radiusPixels: 100
    });

    return (
      <EmulatedVRController vrDisplay={vrDisplay} width={width} height={height}>
        <DeckGLVR
          width={width}
          height={height}
          pickingRadius={50}
          vrDisplay={vrDisplay}
          layers={[ pointCloudLayer ]}
          onLayerHover={this._onHover} />
        { this._renderHoveredItem({width, height}) }
      </EmulatedVRController>
    );
  }
}

render(<Root />, document.body.appendChild(document.createElement('div')));
