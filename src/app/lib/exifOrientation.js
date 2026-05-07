// Apply an EXIF orientation tag (1-8) to a 2D canvas context.
// Standard EXIF orientation values:
// 1 = normal, 2 = flip-h, 3 = 180, 4 = flip-v,
// 5 = transpose, 6 = 90 CW, 7 = transverse, 8 = 270 CW (90 CCW)
export const applyExifOrientation = (ctx, orientation, w, h) => {
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, h, w); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
    default: break;
  }
};

export const orientationSwapsAxes = (orientation) =>
  orientation >= 5 && orientation <= 8;
