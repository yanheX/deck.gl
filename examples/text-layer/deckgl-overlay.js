/* global window */
import React, {Component} from 'react';
import DeckGL, {TextLayer} from 'deck.gl';

const SECONDS_PER_DAY = 24 * 60 * 60;
const TOTAL_SLICES = 24;
const SECONDS_PER_SLICE = SECONDS_PER_DAY / TOTAL_SLICES;
// visualize data within in the time window of [current - TIME_WINDOW, current]
const TIME_WINDOW = 200;
const INVISIBLE_COLOR = [0, 0, 0, 0];
const ANIMATION_SPEED = 40;
const MAX_OFFSET_RADIUS_PIXELS = 56;

function formatTime(timeOfDay) {
  const hours = Math.floor(timeOfDay / 3600);
  const minutes = Math.floor(timeOfDay / 60) % 60;
  const seconds = timeOfDay % 60;
  const pad = x => x.toFixed(0).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default class DeckGLOverlay extends Component {
  static get defaultViewport() {
    return {
      latitude: 39.1,
      longitude: -94.57,
      zoom: 3.8,
      maxZoom: 16,
      pitch: 0,
      bearing: 0
    };
  }

  constructor(props) {
    super(props);

    this.state = {
      dataSlices: this._sliceData(props.data),
      currentTime: props.time
    };

    this._animate = this._animate.bind(this);

    if (props.isPlaying) {
      this._startAnimation();
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.data !== this.props.data) {
      this.setState({
        dataSlices: this._sliceData(nextProps.data)
      });
    }

    if (nextProps.isPlaying !== this.props.isPlaying || nextProps.time !== this.props.time) {
      if (nextProps.isPlaying) {
        this._startAnimation();
      } else {
        this._stopAnimation();
      }
    }
  }

  componentWillUnmount() {
    this._stopAnimation();
  }

  _startAnimation() {
    this._stopAnimation();
    this._startTime = Date.now();
    this._animation = window.requestAnimationFrame(this._animate);
  }

  _animate() {
    const deltaTime = (Date.now() - this._startTime) / 1000 * ANIMATION_SPEED;
    const currentTime = (deltaTime + this.props.time) % SECONDS_PER_DAY;
    this.setState({currentTime});
    this._animation = window.requestAnimationFrame(this._animate);
  }

  _stopAnimation() {
    window.cancelAnimationFrame(this._animation);
  }

  /**
   * We don't want to render too many invisible objects
   * but we also don't want to re-calculating text layout every frame
   * Slice the input by time so that data array has a managable size yet only changes infrequently
   */
  _sliceData(data) {
    if (!data) {
      return null;
    }

    const dataSlices = Array.from({length: TOTAL_SLICES}, () => []);

    data.forEach(d => {
      const time = d.time % SECONDS_PER_DAY;

      const sliceIndex = Math.floor(time / SECONDS_PER_SLICE);
      dataSlices[sliceIndex].push(d);

      // Items that appear at the end of each hour are still visible
      // at the beginning of the next hour
      const nextSliceIndex = Math.floor((time + TIME_WINDOW) / SECONDS_PER_SLICE);
      if (nextSliceIndex !== sliceIndex && nextSliceIndex < TOTAL_SLICES) {
        dataSlices[nextSliceIndex].push(d);
      }
      d.timeOfDay = time;
    });

    return dataSlices;
  }

  _getSize(currentTime, d) {
    const r = 1 - (currentTime - d.timeOfDay) / TIME_WINDOW;
    if (r <= 0 || r > 1) {
      return 0;
    }
    return r * r;
  }

  _getColor(currentTime, d) {
    const r = 1 - (currentTime - d.timeOfDay) / TIME_WINDOW;
    if (r <= 0 || r > 1) {
      return INVISIBLE_COLOR;
    }
    return [255 * r, 200, (1 - r) * 255, 255 * r];
  }

  // tweets are concentrated by big cities
  // apply an arbitrary pixel offset to each tag to reduce overlap
  _getRandomOffset(d) {
    const {text} = d;
    const p = text.length * 47 +
      text.charCodeAt(0) * 53 +
      text.charCodeAt(text.length - 1) * 91;
    const p1 = (p % 107) / 107;
    const p2 = (p % 113) / 113;

    const a = p1 * Math.PI * 2;
    const r = (1 - p2 * p2) * MAX_OFFSET_RADIUS_PIXELS;

    return [r * Math.cos(a), r * Math.sin(a)];
  }

  render() {
    const {viewport} = this.props;
    const {dataSlices, currentTime} = this.state;

    if (!dataSlices) {
      return null;
    }

    const sliceIndex = Math.floor(currentTime / SECONDS_PER_SLICE);
    const data = dataSlices[sliceIndex];

    const layers = [
      new TextLayer({
        id: 'hashtag-layer',
        data,
        sizeScale: 48,
        getColor: this._getColor.bind(null, currentTime),
        getSize: this._getSize.bind(null, currentTime),
        getPosition: d => d.coordinates,
        getPixelOffset: this._getRandomOffset,
        updateTriggers: {
          // update color and size iff currentTime changes
          getColor: currentTime,
          getSize: currentTime
        }
      })
    ];

    return (<DeckGL {...viewport} layers={layers} >
        <h1>{formatTime(currentTime)}</h1>
      </DeckGL>);
  }
}
