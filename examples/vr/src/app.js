/* global document,navigator */
import React, {Component} from 'react';
import {render} from 'react-dom';
import {json as requestJson} from 'd3-request';
import {PolygonLayer, GeoJsonLayer, ScatterplotLayer, IconLayer, Viewport} from 'deck.gl';

import {Matrix4} from 'math.gl';

import EmulatedVRController from './emulated-vr-controller';
import EmulatedVRDisplay from './emulated-vr-display';
import DeckGLVR from './deckgl-vr';
import {animateCamera} from './animation';

// Source data
/* eslint-disable max-len */
const DATA_URL = {
  buildings: 'https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/trips/buildings.json',
  trips: 'https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/trips/trips.json',
  roads: 'https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/trips/roads.json',
  pois: 'https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/trips/pois.json',
  iconMapping: 'data/icon-atlas.json'
};
/* eslint-enable max-len */

const LIGHT_SETTINGS = {
  lightsPosition: [-74.05, 40.7, 8000, -73.5, 41, 5000],
  ambientRatio: 0.05,
  diffuseRatio: 0.6,
  specularRatio: 0.8,
  lightsStrength: [10.0, 5.0, 0.0, 0.0],
  numberOfLights: 2
};

const ROAD_WIDTHS = {
  primary: 20,
  motorway: 16,
  secondary: 10,
  default: 6
};

class Root extends Component {

  constructor(props) {
    super(props);
    this.state = {
      mapState: {
        longitude: -74,
        latitude: 40.714,
        heading: 0,
        fovy: 75, // Field of view covered by camera
        focalDistance: 10,
        position: [0, 0, 1.5] // eye level from ground
      },
      // Fallback display parameters. Only used if no VR headset is present.
      vrDisplay: new EmulatedVRDisplay(),
      data: {},
      animation: null
    };

    this._updateMapState = this._updateMapState.bind(this);
  }

  componentDidMount() {
    const datasets = Object.keys(DATA_URL);
    
    datasets.forEach(key => {
      requestJson(DATA_URL[key], (error, response) => {
        if (!error) {
          const data = {...this.state.data, [key]: response};
          this.setState({data});

          if (datasets.every(k => data[k])) {
            // all loaded
            const animation = animateCamera(data.trips[207].segments, this._updateMapState);
            this.setState({animation});
            animation.start();
          }
        }
      });
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

  _updateMapState(newState) {
    const mapState = {
      ...this.state.mapState,
      ...newState
    };
    this.setState({mapState});
  }

  render() {
    const {vrDisplay, mapState, data} = this.state;

    const layers = [
      data.buildings && new PolygonLayer({
        id: 'buildings',
        data: data.buildings,
        extruded: true,
        wireframe: false,
        fp64: true,
        opacity: 0.7,
        getPolygon: f => f.polygon,
        getElevation: f => f.height,
        getFillColor: f => [74, 80, 87],
        lightSettings: LIGHT_SETTINGS
      }),
      data.roads && new GeoJsonLayer({
        id: 'map',
        data: data.roads,
        fp64: true,
        opacity: 1,
        lineJointRounded: true,
        getLineColor: f => [80, 80, 80],
        getLineWidth: f => ROAD_WIDTHS[f.properties.fclass] || ROAD_WIDTHS.default
      }),
      data.pois && data.iconMapping && new IconLayer({
        id: 'points-of-interest',
        data: data.pois,
        iconAtlas: 'data/icon-atlas.png',
        iconMapping: data.iconMapping,
        sizeScale: 10000,
        fp64: true,
        getPosition: d => d.coordinates,
        getColor: d => [0, 200, 255],
        getIcon: d => data.iconMapping[d.fclass] ? d.fclass : 'marker'
      })
    ].filter(Boolean);

    const {renderWidth, renderHeight} = vrDisplay.getEyeParameters();
    const width = renderWidth * 2;
    const height = renderHeight;

    return (
      <EmulatedVRController vrDisplay={vrDisplay} mapState={mapState} width={width} height={height}>
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
