export const wrapperStyle = (
  outerWidth = 'calc(100vw / 3)',
  outerHeight = 'calc(23.33vw - 0.666rem)'
) => ({
  width: `${outerWidth}`,
  height: `${outerHeight}`,
});

export const finalHeaderStyle = (finalHeaderColor = 'lightcyan') => ({
  backgroundColor: `${finalHeaderColor}`,
  padding: '1.5rem',
  borderRadius: '5px 5px 0 0',
});

export const titleStyle = () => ({
  padding: '0.5rem',
  fontSize: '1.2rem',
});

export const excerptStyle = () => ({
  padding: '0.5rem',
  fontSize: '0.8rem',
  color: '#999',
  overflow: 'auto',
});

export const backdropStyle = isClick => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: `${!isClick ? 'none' : 'all'}`,
  backgroundColor: 'white',
  zIndex: 12,
  willChange: 'opacity',
});

export const contentStyle = ({
  isClick,
  initialWidth,
  initialHeight,
  initialColor,
  finalHeight,
  finalTop,
  finalLeft,
  finalRight,
  finalColor,
}) => {
  const sharedStyle = {
    transformOrigin: '0 0',
    position: 'relative',
    touchAction: 'manipulation',
  };

  const initialStyle = {
    width: `${initialWidth}`,
    height: `${initialHeight}`,
    backgroundColor: `${initialColor}`,
    borderRadius: '5px',
  };

  const finalStyle = {
    position: 'fixed',
    height: `${finalHeight}`,
    top: `${finalTop}`,
    left: `${finalLeft}`,
    right: `${finalRight}`,
    touchAction: 'none',
    zIndex: 15,
    backgroundColor: `${finalColor}`,
    borderRadius: '5px 5px 0 0',
  };

  if (isClick)
    return {
      ...sharedStyle,
      ...finalStyle,
    };

  return {
    ...sharedStyle,
    ...initialStyle,
  };
};
