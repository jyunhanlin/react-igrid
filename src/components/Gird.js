/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { animated, useSpring, interpolate } from 'react-spring';
import { useDrag } from 'react-use-gesture';

import useVelocityTrackedSpring from './useVelocityTrackedSpring';
import useWindowSize from './useWindowSize';
import {
  rubberBandIfOutOfBounds,
  findNearestNumberInArray,
  projection,
  rangeMap,
  clampedRangeMap,
  resetTransform,
} from './utilities';

import * as styles from './styles';

const defaultSpringSettings = {
  y: 0,
  x: 0,
  scaleX: 1,
  scaleY: 1,
  config: {
    tension: 500,
    friction: 50,
  },
};

const bounceConfig = {
  tension: 500,
  friction: 30,
};

const threshold = 10;
const maxYTranslate = 150;
const yStops = [0, maxYTranslate];
const xStops = [-20, 20];
const scaleStops = [1, 0.75];

function Grid({
  initialWidth = 'calc(100vw / 3)',
  initialHeight = 'calc(23.33vw - 0.666rem)',
  initialColor = 'rgba(255, 255, 255, 0.8)',
  finalHeight = 'calc(100vh - 10%)',
  finalTop = '10%',
  finalLeft = 0,
  finalRight = 0,
  finalColor = 'lightblue',
  title = 'test',
  excerpt = '1234',
  image,
  children,
  lockContainerScroll = () => {},
  unlockContainerScroll = () => {},
}) {
  const { width } = useWindowSize();
  const [isClick, setIsClick] = useState(false);

  const [{ y }, setY] = useVelocityTrackedSpring(() => ({
    y: 0,
  }));

  const [{ x }, setX] = useSpring(() => ({
    x: 0,
  }));

  const [{ scaleX, scaleY }, setScale] = useSpring(() => ({
    scaleX: 1,
    scaleY: 1,
  }));

  const [backdropSpring, setBackdropSpring] = useSpring(() => ({
    opacity: 0,
  }));

  const set = useCallback(args => {
    if (args.y !== undefined) setY(args);
    if (args.x !== undefined) setX(args);
    if (args.scaleX !== undefined) setScale(args);
  }, []);

  const gridRef = useRef();

  const gridPositions = useRef({
    before: null,
    after: null,
  });

  const dragUnselected = ({ last, movement }) => {
    if (last && Math.abs(movement[0]) + Math.abs(movement[1]) < 2) {
      gridPositions.current.before = gridRef.current.getBoundingClientRect();
      lockContainerScroll();
      setIsClick(true);
    }
  };

  const dragSelected = ({ vxvy: [, velocityY], movement: [movementX, movementY], last, memo }) => {
    if (!memo) {
      const isIntentionalGesture = Math.abs(movementY) > threshold;
      if (!isIntentionalGesture) return;
      memo = {
        y: y.value - movementY,
        x: x.value - movementX,
      };
    }

    if (last) {
      const projectedEndpoint = y.value + projection(velocityY, 'fast');
      const point = findNearestNumberInArray(projectedEndpoint, yStops);
      if (point === yStops[1]) {
        return set({
          immediate: false,
          y: point,
          onFrame: () => {
            if (Math.abs(y.lastVelocity) < 1000) {
              gridPositions.current.after = gridPositions.current.before;
              gridPositions.current.before = gridRef.current.getBoundingClientRect();
              unlockContainerScroll();
              setIsClick(false);
              set({
                onFrame: null,
              });
            }
          },
        });
      }
      setBackdropSpring({
        opacity: 1,
      });
      return set({
        immediate: false,
        y: 0,
        x: 0,
        scaleY: 1,
        scaleX: 1,
      });
    }

    const newY = rubberBandIfOutOfBounds(...yStops, movementY + memo.y);
    const newX = rubberBandIfOutOfBounds(...xStops, movementX + memo.x);

    // allow for interruption of enter animation
    memo.immediate = memo.immediate || Math.abs(newY - y.value) < 1;

    const scale = clampedRangeMap(yStops, scaleStops, movementY + memo.y);

    set({
      y: newY,
      x: newX + ((1 - scale) / 2) * width,
      scaleY: scale,
      scaleX: scale,
      onFrame: null,
      immediate: memo.immediate,
    });

    setBackdropSpring({
      opacity: rangeMap(yStops, [1, 0.5], newY),
    });

    return memo;
  };

  const bindUnselect = useDrag(!isClick ? dragUnselected : null);

  const bindSelect = useDrag(isClick ? dragSelected : null);

  const onBackdropHandler = () => {
    gridPositions.current.after = gridPositions.current.before;
    gridPositions.current.before = gridRef.current.getBoundingClientRect();
    unlockContainerScroll();
    setIsClick(false);
  };

  useLayoutEffect(() => {
    if (gridPositions.current.before) {
      if (isClick) gridPositions.current.after = gridRef.current.getBoundingClientRect();
      const diff = resetTransform(gridRef.current, gridPositions.current);
      set({
        ...diff,
        immediate: true,
        onFrame: () => {},
      });

      window.requestAnimationFrame(() => {
        setBackdropSpring({
          opacity: isClick ? 1 : 0,
          config: !isClick ? bounceConfig : defaultSpringSettings.config,
        });
        const springSettings = {
          ...defaultSpringSettings,
          config: !isClick ? bounceConfig : defaultSpringSettings.config,
        };

        set(
          {
            ...springSettings,
            immediate: false,
          },
          { skipSetVelocity: true }
        );
      });
    }
  }, [isClick, set, setBackdropSpring]);

  return (
    <div style={styles.wrapperStyle()}>
      <animated.div
        ref={gridRef}
        onTouchStart={bindUnselect().onTouchStart}
        style={{
          ...styles.contentStyle({
            isClick,
            initialWidth,
            initialHeight,
            initialColor,
            finalHeight,
            finalTop,
            finalLeft,
            finalRight,
            finalColor,
          }),

          transform: interpolate(
            [x, y, scaleX, scaleY],
            (interX, interY, interScaleX, interScaleY) =>
              `translate3d(${interX}px, ${interY}px, 0) scaleX(${interScaleX}) scaleY(${interScaleY})`
          ),
        }}
      >
        {isClick ? (
          <div style={styles.finalHeaderStyle()} onTouchStart={bindSelect().onTouchStart}>
            {title}
          </div>
        ) : null}
        {image && <img src={image} alt="preview" />}
        {!isClick ? (
          <>
            <div style={styles.titleStyle()}>{title}</div>
            <div style={styles.excerptStyle()}>{excerpt}</div>
          </>
        ) : null}
        {isClick ? children : null}
      </animated.div>
      <animated.div
        style={{
          ...styles.backdropStyle(isClick),
          ...backdropSpring,
        }}
        onClick={onBackdropHandler}
      />
    </div>
  );
}

export default Grid;
