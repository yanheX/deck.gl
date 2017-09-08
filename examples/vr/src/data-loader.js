import {csv as requestCSV} from 'd3-request';
import vec3_normalize from 'gl-vec3/normalize';

const DATA_URL = 'https://raw.githubusercontent.com/astronexus/HYG-Database/master/hygdata_v3.csv';

export default function loadData(callback) {
  requestCSV(DATA_URL, (error, response) => {
    if (error) {
      console.log(error);
    }
    callback(response);
  });
}

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
