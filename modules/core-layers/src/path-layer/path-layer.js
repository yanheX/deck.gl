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

import {COORDINATE_SYSTEM, Layer, experimental} from '@deck.gl/core';
const {fillArray, fp64LowPart, enable64bitSupport} = experimental;
import {GL, Model, Geometry} from 'luma.gl';

import vs from './path-layer-vertex.glsl';
import vs64 from './path-layer-vertex-64.glsl';
import fs from './path-layer-fragment.glsl';

const DEFAULT_COLOR = [0, 0, 0, 255];

const defaultProps = {
  widthScale: 1, // stroke width in meters
  widthMinPixels: 0, //  min stroke width in pixels
  widthMaxPixels: Number.MAX_SAFE_INTEGER, // max stroke width in pixels
  rounded: false,
  miterLimit: 4,
  fp64: false,
  dashJustified: false,

  getPath: object => object.path,
  getColor: object => object.color || DEFAULT_COLOR,
  getWidth: object => object.width || 1,
  getDashArray: null
};

const isClosed = path => {
  const firstPoint = path[0];
  const lastPoint = path[path.length - 1];
  return (
    firstPoint[0] === lastPoint[0] &&
    firstPoint[1] === lastPoint[1] &&
    firstPoint[2] === lastPoint[2]
  );
};

export default class PathLayer extends Layer {
  getShaders() {
    return enable64bitSupport(this.props)
      ? {vs: vs64, fs, modules: ['project64', 'picking']}
      : {vs, fs, modules: ['picking']}; // 'project' module added by default.
  }

  initializeState() {
    const attributeManager = this.getAttributeManager();
    /* eslint-disable max-len */
    attributeManager.addInstanced({
      instancePositions: {size: 3, update: this.calculatePositions},
      instanceDiscardFlags: {size: 1, update: this.calculateDiscardFlags},
      instanceStrokeWidths: {size: 1, accessor: 'getWidth', update: this.calculateStrokeWidths},
      instanceDashArrays: {size: 2, accessor: 'getDashArray', update: this.calculateDashArrays},
      instanceColors: {
        size: 4,
        type: GL.UNSIGNED_BYTE,
        accessor: 'getColor',
        update: this.calculateColors,
        defaultValue: DEFAULT_COLOR
      },
      instancePickingColors: {size: 3, type: GL.UNSIGNED_BYTE, update: this.calculatePickingColors}
    });
    /* eslint-enable max-len */
  }

  updateAttribute({props, oldProps, changeFlags}) {
    if (props.fp64 !== oldProps.fp64) {
      const attributeManager = this.getAttributeManager();
      attributeManager.invalidateAll();

      if (props.fp64 && props.coordinateSystem === COORDINATE_SYSTEM.LNGLAT) {
        attributeManager.addInstanced({
          instancePositions64xyLow: {
            size: 2,
            update: this.calculatePositions64xyLow
          }
        });
      } else {
        attributeManager.remove(['instancePositions64xyLow']);
      }
    }
  }

  updateState({oldProps, props, changeFlags}) {
    super.updateState({props, oldProps, changeFlags});

    const {getPath} = this.props;
    const attributeManager = this.getAttributeManager();
    if (props.fp64 !== oldProps.fp64) {
      const {gl} = this.context;
      if (this.state.model) {
        this.state.model.delete();
      }
      this.setState({model: this._getModel(gl), needsUpdatePositions: true});
    }
    this.updateAttribute({props, oldProps, changeFlags});

    const geometryChanged =
      changeFlags.dataChanged ||
      (changeFlags.updateTriggersChanged &&
        (changeFlags.updateTriggersChanged.all || changeFlags.updateTriggersChanged.getPath));

    if (geometryChanged) {
      // this.state.paths only stores point positions in each path
      const paths = props.data.map(getPath);
      const numInstances = paths.reduce((count, path) => count + path.length + 1, 0);

      this.setState({paths, numInstances, needsUpdatePositions: true});
      attributeManager.invalidateAll();
    }
  }

  updateAttributes(props) {
    const attributeManager = this.getAttributeManager();
    if (!attributeManager) {
      return;
    }
    super.updateAttributes(props);

    if (this.state.needsUpdatePositions) {
      const {instancePositions, instancePositions64xyLow} = attributeManager.getAttributes();

      // See comment below on positions and offsets
      const positionAttributes = {
        // offset is 1 vertex * 3 floats * 4 bytes per float
        instanceLeftPositions: instancePositions,
        instanceStartPositions: Object.assign({}, instancePositions, {offset: 12}),
        instanceEndPositions: Object.assign({}, instancePositions, {offset: 12 * 2}),
        instanceRightPositions: Object.assign({}, instancePositions, {offset: 12 * 3})
      };

      if (instancePositions64xyLow) {
        Object.assign(positionAttributes, {
          // offset is 1 vertex * 2 floats * 4 bytes per float
          instanceLeftPositions64xyLow: instancePositions64xyLow,
          instanceStartPositions64xyLow: Object.assign({}, instancePositions64xyLow, {offset: 8}),
          instanceEndPositions64xyLow: Object.assign({}, instancePositions64xyLow, {offset: 8 * 2}),
          instanceRightPositions64xyLow: Object.assign({}, instancePositions64xyLow, {
            offset: 8 * 3
          })
        });
      }

      this.state.model.setAttributes(positionAttributes);
      this.setState({needsUpdatePositions: false});
    }
  }

  draw({uniforms}) {
    const {
      rounded,
      miterLimit,
      widthScale,
      widthMinPixels,
      widthMaxPixels,
      dashJustified
    } = this.props;

    const {model} = this.state;

    model.setInstanceCount(this.state.numInstances - 3);

    model.render(
      Object.assign({}, uniforms, {
        jointType: Number(rounded),
        alignMode: Number(dashJustified),
        widthScale,
        miterLimit,
        widthMinPixels,
        widthMaxPixels
      })
    );
  }

  _getModel(gl) {
    /*
     *       _
     *        "-_ 1                   3                       5
     *     _     "o---------------------o-------------------_-o
     *       -   / ""--..__              '.             _.-' /
     *   _     "@- - - - - ""--..__- - - - x - - - -_.@'    /
     *    "-_  /                   ""--..__ '.  _,-` :     /
     *       "o----------------------------""-o'    :     /
     *      0,2                            4 / '.  :     /
     *                                      /   '.:     /
     *                                     /     :'.   /
     *                                    /     :  ', /
     *                                   /     :     o
     */

    const SEGMENT_INDICES = [
      // start corner
      0,
      2,
      1,
      // body
      1,
      2,
      4,
      1,
      4,
      3,
      // end corner
      3,
      4,
      5
    ];

    // [0] position on segment - 0: start, 1: end
    // [1] side of path - -1: left, 0: center, 1: right
    // [2] role - 0: offset point 1: joint point
    const SEGMENT_POSITIONS = [
      // bevel start corner
      0,
      0,
      1,
      // start inner corner
      0,
      -1,
      0,
      // start outer corner
      0,
      1,
      0,
      // end inner corner
      1,
      -1,
      0,
      // end outer corner
      1,
      1,
      0,
      // bevel end corner
      1,
      0,
      1
    ];

    return new Model(
      gl,
      Object.assign({}, this.getShaders(), {
        id: this.props.id,
        geometry: new Geometry({
          drawMode: GL.TRIANGLES,
          attributes: {
            indices: new Uint16Array(SEGMENT_INDICES),
            positions: new Float32Array(SEGMENT_POSITIONS)
          }
        }),
        isInstanced: true,
        shaderCache: this.context.shaderCache
      })
    );
  }

  /**
   * Positions and discardFlags
   *
   * For each path, the positions array is constructed as such:
   * (vertex to the left of v0) v0 v1 v2 ... vn (vertex to the right of vn)
   * We reuse the some positions buffer for all position attributes by offsetting:
      instanceLeftPosition  (+0)
      instanceStartPosition (+1)
      instanceEndPosition   (+2)
      instanceRightPosition (+3)
   *
   * `discardFlags` is used to mark the end of each path where vertices from the previous
   * path overlap with vertices from the next path. We shouldn't draw these segments:
   *
      instanceLeftPosition    A0 A0 A1 A2 A3 A4 A4 B0 B0 B1 B2 B2 C0 ...
      instanceStartPosition   A0 A1 A2 A3 A4 A4 B0 B0 B1 B2 B2 C0 C0...
      instanceEndPosition     A1 A2 A3 A4 A4 B0 B0 B1 B2 B2 C0 C0 C1...
      instanceRightPosition   A2 A3 A4 A4 B0 B0 B1 B2 B2 C0 C0 C1 C2...
      discardFlags            0  0  0  0  1  1  1  1  0  1  1  1  0...
   */

  _forEachVertex(visitor) {
    this.state.paths.forEach(path => {
      const len = path.length;
      const closed = isClosed(path);

      for (let ptIndex = -1; ptIndex <= len; ptIndex++) {
        let point;
        if (ptIndex === -1) {
          // point to the left of the first vertex
          point = closed ? path[len - 2] : path[0];
        } else if (ptIndex === len) {
          // point to the right of the last vertex
          point = closed ? path[1] : path[len - 1];
        } else {
          point = path[ptIndex];
        }

        visitor(point);
      }
    });
  }

  calculateDiscardFlags(attribute) {
    const {paths} = this.state;
    const {value} = attribute;

    let i = 0;
    paths.forEach((path, index) => {
      // Each path has `length - 1` segments and 3 invalid segments due to offsetting
      i += path.length + 2;
      value[i - 3] = 1;
      value[i - 2] = 1;
      value[i - 1] = 1;
    });
  }

  calculatePositions(attribute) {
    const {value} = attribute;

    let i = 0;
    this._forEachVertex(point => {
      value[i++] = point[0];
      value[i++] = point[1];
      value[i++] = point[2] || 0;
    });
  }

  calculatePositions64xyLow(attribute) {
    const {value} = attribute;

    let i = 0;
    this._forEachVertex(point => {
      value[i++] = fp64LowPart(point[0]);
      value[i++] = fp64LowPart(point[1]);
    });
  }

  calculateStrokeWidths(attribute) {
    const {data, getWidth} = this.props;
    const {paths} = this.state;
    const {value, size} = attribute;

    let i = 0;
    paths.forEach((path, index) => {
      const width = getWidth(data[index], index);
      const count = path.length + 2;
      fillArray({target: value, source: [width], start: i, count});
      i += count * size;
    });
  }

  calculateDashArrays(attribute) {
    const {data, getDashArray} = this.props;
    if (!getDashArray) {
      return;
    }

    const {paths} = this.state;
    const {value, size} = attribute;
    let i = 0;
    paths.forEach((path, index) => {
      const dashArray = getDashArray(data[index], index);
      const count = path.length + 2;
      fillArray({target: value, source: dashArray, start: i, count});
      i += count * size;
    });
  }

  calculateColors(attribute) {
    const {data, getColor} = this.props;
    const {paths} = this.state;
    const {value, size} = attribute;

    let i = 0;
    paths.forEach((path, index) => {
      const pointColor = getColor(data[index], index);
      if (isNaN(pointColor[3])) {
        pointColor[3] = 255;
      }
      const count = path.length + 2;
      fillArray({target: value, source: pointColor, start: i, count});
      i += count * size;
    });
  }

  // Override the default picking colors calculation
  calculatePickingColors(attribute) {
    const {paths} = this.state;
    const {value, size} = attribute;

    let i = 0;
    paths.forEach((path, index) => {
      const pickingColor = this.encodePickingColor(index);
      const count = path.length + 2;
      fillArray({target: value, source: pickingColor, start: i, count});
      i += count * size;
    });
  }
}

PathLayer.layerName = 'PathLayer';
PathLayer.defaultProps = defaultProps;
