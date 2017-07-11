
export function getPointCloud({radius, resolution}) {
  const pointCloud = [];

  // x is longitude, from 0 to 360
  // y is latitude, from -90 to 90
  for (let yIndex = 0; yIndex <= resolution; yIndex++) {
    const y = (yIndex / resolution - 1 / 2) * Math.PI;
    const cosy = Math.cos(y);
    const siny = Math.sin(y);
    // need less samples at high latitude
    const xCount = Math.floor(cosy * resolution * 2) + 1;

    for (let xIndex = 0; xIndex < xCount; xIndex++) {
      const x = xIndex / xCount * Math.PI * 2;
      const cosx = Math.cos(x);
      const sinx = Math.sin(x);

      pointCloud.push({
        position: [cosx * radius * cosy, sinx * radius * cosy, siny * radius],
        normal: [cosx * cosy, sinx * cosy, siny],
        color: [(siny + 1) * 128, (cosy + 1) * 128, 0]
      });
    }
  }

  return pointCloud;
}
