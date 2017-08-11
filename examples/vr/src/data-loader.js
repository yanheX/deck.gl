import {csv as requestCSV} from 'd3-request';

const DATA_URL = 'https://raw.githubusercontent.com/astronexus/HYG-Database/master/hygdata_v3.csv';

export default function loadData(callback) {
  requestCSV(DATA_URL, (error, response) => {
    if (error) {
      console.log(error);
    }
    callback(response);
  });
}
