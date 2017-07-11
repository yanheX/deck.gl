/* global window,document,fetch */
import React, {Component} from 'react';
import {render} from 'react-dom';
import {PointCloudLayer, COORDINATE_SYSTEM} from 'deck.gl';
import DeckGLVR from './deckgl-vr';
import {getPointCloud} from './data-samples';

// source: Natural Earth http://www.naturalearthdata.com/
// via geojson.xyz

class Root extends Component {

  constructor(props) {
    super(props);
    this.state = {
      viewport: {
        lookAt: [0.5, 0.5, 0.5],
        eye: [0, 1, 1],
        fovy: 30,
        far: 1000,
        near: 0.1,
        width: 0,
        height: 0
      },
      data: getPointCloud({radius: 1, resolution: 100}),
    };
  }

  componentDidMount() {
    window.addEventListener('resize', this._resize.bind(this));
    this._resize();
  }

  _resize() {
    this.setState({
      viewport: {
        ...this.state.viewport,
        width: window.innerWidth,
        height: window.innerHeight
      }
    });
  }

  render() {
    const {viewport, data} = this.state;
    const pointCloudLayer = new PointCloudLayer({
      data,
      projectionMode: COORDINATE_SYSTEM.IDENTITY,
      getPosition: d => d.position,
      getNormal: d => d.normal,
      getColor: d => d.color,
      opacity: 1,
      radiusPixels: 10
    });

    return viewport.width ? (
      <DeckGLVR {...viewport} layers={[ pointCloudLayer ]} />
    ) : null;
  }
}

render(<Root />, document.body.appendChild(document.createElement('div')));
