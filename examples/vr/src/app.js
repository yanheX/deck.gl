/* global document,navigator */
import React, {Component} from 'react';
import {render} from 'react-dom';
import {PolygonLayer, Viewport} from 'deck.gl';
import EmulatedVRController from './emulated-vr-controller';
import EmulatedVRDisplay from './emulated-vr-display';

import DeckGLVR from './deckgl-vr';

import {json as requestJson} from 'd3-request';


// Source data CSV
const DATA_URL = {
  BUILDINGS: 'https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/trips/buildings.json',  // eslint-disable-line
  TRIPS: 'https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/trips/trips.json'  // eslint-disable-line
};

const LIGHT_SETTINGS = {
  lightsPosition: [-74.05, 40.7, 8000, -73.5, 41, 5000],
  ambientRatio: 0.05,
  diffuseRatio: 0.6,
  specularRatio: 0.8,
  lightsStrength: [10.0, 5.0, 0.0, 0.0],
  numberOfLights: 2
};

class Root extends Component {

  constructor(props) {
    super(props);
    this.state = {
      mapState: {
        longitude: -74,
        latitude: 40.714,
        fovy: 75, // Field of view covered by camera
        focalDistance: 10
      },
      // Fallback display parameters. Only used if no VR headset is present.
      vrDisplay: new EmulatedVRDisplay(),
      buildings: null
    };
  }

  componentDidMount() {
    
    requestJson(DATA_URL.BUILDINGS, (error, response) => {
      if (!error) {
        this.setState({buildings: response});
      }
    });

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

  render() {
    const {vrDisplay, mapState, buildings, trips} = this.state;

    const layers = [
      buildings && new PolygonLayer({
        id: 'buildings',
        data: buildings,
        extruded: true,
        wireframe: false,
        fp64: true,
        opacity: 0.7,
        getPolygon: f => f.polygon,
        getElevation: f => f.height,
        getFillColor: f => [74, 80, 87],
        lightSettings: LIGHT_SETTINGS
      })
    ];

    const {renderWidth, renderHeight} = vrDisplay.getEyeParameters();
    const width = renderWidth * 2;
    const height = renderHeight;

    return (
      <EmulatedVRController vrDisplay={vrDisplay} width={width} height={height}>
        <DeckGLVR
          width={width}
          height={height}
          mapState={mapState}
          vrDisplay={vrDisplay}
          layers={layers} />
      </EmulatedVRController>
    );
  }
}

render(<Root />, document.body.appendChild(document.createElement('div')));
