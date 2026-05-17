export const DISPLAY_FONT_FAMILY = '"Bungee", cursive';
export const BODY_FONT_FAMILY = '"Barlow Semi Condensed", Arial, sans-serif';

function clampFontSize(fontSize, min = 1) {
  const numericSize = Number(fontSize);
  if (!Number.isFinite(numericSize)) return `${Math.max(1, min)}px`;
  return `${Math.max(min, Math.round(numericSize))}px`;
}

function applyStroke(style, stroke, strokeThickness) {
  const numericThickness = Number(strokeThickness);
  if (!stroke || !Number.isFinite(numericThickness) || numericThickness <= 0) {
    return style;
  }
  return {
    ...style,
    stroke,
    strokeThickness: numericThickness,
  };
}

export function createDisplayTextStyle({
  fontSize = 24,
  min = 18,
  color = "#ffffff",
  stroke = "#07111b",
  strokeThickness = 0,
  ...rest
} = {}) {
  return applyStroke(
    {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: clampFontSize(fontSize, min),
      color,
      ...rest,
    },
    stroke,
    strokeThickness,
  );
}

export function createBodyTextStyle({
  fontSize = 14,
  min = 12,
  color = "#ffffff",
  fontStyle,
  ...rest
} = {}) {
  const style = {
    fontFamily: BODY_FONT_FAMILY,
    fontSize: clampFontSize(fontSize, min),
    color,
    ...rest,
  };
  if (fontStyle) style.fontStyle = fontStyle;
  return style;
}

export function createLabelTextStyle({
  fontSize = 12,
  min = 11,
  color = "#ffffff",
  fontStyle = "bold",
  ...rest
} = {}) {
  return createBodyTextStyle({
    fontSize,
    min,
    color,
    fontStyle,
    ...rest,
  });
}
