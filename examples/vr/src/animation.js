/* global window */
import TWEEN from '@tweenjs/tween.js';

const animate = () => {
  TWEEN.update();
  window.requestAnimationFrame(animate);
};

animate();

const TURN_SPEED = 100; // degrees per second
const CAR_SPEED = 5;

export function animateCamera(segments, callback) {
  const transitions = [];

  let prevSeg = null;
  let prevState = null;
  let state;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    const nextState = {
      longitude: seg[0],
      latitude: seg[1],
      heading : prevSeg ? Math.atan2(seg[1] - prevSeg[1], seg[0] - prevSeg[0]) / Math.PI * 180 : null
    };

    if (prevState) {
      if (Number.isFinite(prevState.heading)) {
        nextState.heading = adjustHeading(prevState.heading, nextState.heading);
      } else {
        prevState.heading = nextState.heading;
      }
      const intermediateState = {...prevState, heading: nextState.heading};
      // turn
      transitions.push(getTransition(
        state,
        intermediateState,
        Math.abs(nextState.heading - prevState.heading) / TURN_SPEED,
        callback
      ));
      // move
      transitions.push(getTransition(
        state,
        nextState,
        (seg[2] - prevSeg[2]) / CAR_SPEED,
        callback
      ));
    }
    if (!state) {
      state = nextState;
    }

    prevSeg = seg;
    prevState = nextState;
  }

  transitions.reduce((prev, tween) => {
    if (prev) {
      prev.chain(tween);
    }
    return tween;
  }, null);

  return transitions[0];
}

function adjustHeading(fromAngle, toAngle) {
  if (toAngle - fromAngle > 180) {
    return toAngle - 360;
  }
  if (toAngle - fromAngle < -180) {
    return toAngle + 360;
  }
  return toAngle;
}

function getTransition(fromState, toState, duration, callback) {
  return new TWEEN.Tween(fromState)
    .to(toState, duration * 1000)
    .onUpdate(callback);
}
