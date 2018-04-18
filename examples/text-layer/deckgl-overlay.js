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

  _animate() {
    const deltaTime = (Date.now() - this._startTime) / 1000 * ANIMATION_SPEED;
    const currentTime = (deltaTime + this.props.time) % SECONDS_PER_DAY;
    this.setState({currentTime});
    this._animation = window.requestAnimationFrame(this._animate);
  }

  _startAnimation() {
    this._stopAnimation();
    this._startTime = Date.now();
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

  /**
   * Get the data slice at the current timestamp
   */
  _getCurrentData(dataSlices, currentTime) {
    if (!dataSlices) {
      return null;
    }

    const sliceIndex = Math.floor(currentTime / SECONDS_PER_SLICE);
    const data = dataSlices[sliceIndex];

    const fromTime = currentTime - TIME_WINDOW;

    // pre-calculate the scaler inside the current time window
    data.forEach(d => {
      const time = d.timeOfDay;
      if (time <= fromTime || time >= currentTime) {
        d.r = 0;
      } else {
        d.r = Math.pow((time - fromTime) / TIME_WINDOW, 2);
      }
    });

    return data;
  }

  render() {
    const {viewport} = this.props;
    const {dataSlices, currentTime} = this.state;
    const data = this._getCurrentData(dataSlices, currentTime);

    const layers = [
      new TextLayer({
        id: 'hashtag-layer',
        data,
        sizeScale: 48,
        getColor: d => (d.r ? [255 * d.r, 200, (1 - d.r) * 255, 255 * d.r] : INVISIBLE_COLOR),
        getSize: d => d.r,
        getPosition: d => d.coordinates,
        updateTriggers: {
          // update color and size iff currentTime changes
          getColor: currentTime,
          getSize: currentTime
        }
      })
    ];

    return <DeckGL {...viewport} layers={layers} />;
  }
}
