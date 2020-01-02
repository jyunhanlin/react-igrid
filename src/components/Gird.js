import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/core';
import { animated, useSpring, interpolate } from 'react-spring';
import { useDrag } from 'react-use-gesture';
import * as Rematrix from 'rematrix';

import useVelocityTrackedSpring from '../hooks/useVelocityTrackedSpring';
import useWindowSize from '../hooks/useWindowSize';

import {
  rubberBandIfOutOfBounds,
  findNearestNumberInArray,
  projection,
  rangeMap,
  clampedRangeMap,
} from '../utils/utilities';

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

const GridWrapper = styled.div`
  margin: 1rem 0;
  width: calc(100vw / 3);
  height: calc(23.33vw - 0.666rem);
`;

const GridContent = styled.div`
  transform-origin: 0 0;
  position: relative;
  touch-action: manipulation;
  ${props =>
    props.isSelected
      ? css`
          height: calc(100vh - calc(${props.height / 2}px - 75vw));
          position: fixed;
          top: calc(${props.height / 2}px - 75vw);
          left: 0;
          right: 0;
          touch-action: none;
          z-index: 15;
          background-color: lightblue;
          border-radius: 5px 5px 0 0;
        `
      : css`
          width: calc(100vw / 3);
          height: calc(23.33vw - 0.666rem);
          background-color: rgba(255, 255, 255, 0.8);
          border-radius: 5px;
        `}
`;

const GridHeader = styled.div`
  background-color: lightcyan;
  padding: 1.5rem;
  border-radius: 5px 5px 0 0;
`;

const GridTitle = styled.div`
  padding: 0.5rem;
  font-size: 1.2rem;
`;

const GridDescription = styled.div`
  padding: 0.5rem;
  font-size: 0.8rem;
  color: #999;
  overflow: auto;
`;

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  ${props => (props.backgroundPointerEvents ? 'pointer-events:none;' : 'pointer-events:all;')};
  background-color: white;
  z-index: 12;
  will-change: opacity;
`;

const resetTransform = (el, positions) => {
  // cache the current transform for interruptible animations
  const startTransform = Rematrix.fromString(el.style.transform);
  // we need to figure out what the "real" final state is without any residual transform from an interrupted animation
  el.style.transform = '';

  const { before, after } = positions;
  const scaleX = before.width / after.width;
  const scaleY = before.height / after.height;
  const x = before.left - after.left;
  const y = before.top - after.top;

  const transformsArray = [
    startTransform,
    Rematrix.translateX(x),
    Rematrix.translateY(y),
    Rematrix.scaleX(scaleX),
    Rematrix.scaleY(scaleY),
  ];

  const matrix = transformsArray.reduce(Rematrix.multiply);

  const diff = {
    x: matrix[12],
    y: matrix[13],
    scaleX: matrix[0],
    scaleY: matrix[5],
  };
  // immediately apply new styles before the next frame
  el.style.transform = `translate(${diff.x}px, ${diff.y}px) scaleX(${diff.scaleX}) scaleY(${diff.scaleY})`;
  return diff;
};

function Grid({ handleContainerScroll }) {
  const { width, height } = useWindowSize();
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
  });

  const gridRef = useRef();

  const gridPositions = useRef({
    before: null,
    after: null,
  });

  const dragUnselected = ({ last, movement }) => {
    if (last && Math.abs(movement[0]) + Math.abs(movement[1]) < 2) {
      gridPositions.current.before = gridRef.current.getBoundingClientRect();
      if (handleContainerScroll) handleContainerScroll(false);
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
              if (handleContainerScroll) handleContainerScroll(true);
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
    if (handleContainerScroll) handleContainerScroll(true);
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
    <GridWrapper>
      <GridContent
        as={animated.div}
        ref={gridRef}
        height={height}
        isSelected={isClick}
        onTouchStart={bindUnselect().onTouchStart}
        style={{
          transform: interpolate(
            [x, y, scaleX, scaleY],
            (interX, interY, interScaleX, interScaleY) =>
              `translate3d(${interX}px, ${interY}px, 0) scaleX(${interScaleX}) scaleY(${interScaleY})`
          ),
        }}
      >
        {isClick ? <GridHeader onTouchStart={bindSelect().onTouchStart} /> : null}
        <GridTitle>test</GridTitle>
        <GridDescription>1234</GridDescription>
      </GridContent>
      <Backdrop
        as={animated.div}
        backgroundPointerEvents={!isClick}
        style={backdropSpring}
        onClick={onBackdropHandler}
      />
    </GridWrapper>
  );
}

export default Grid;
