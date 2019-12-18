/**
 * Returns measurements in pixels for a given text
 * 
 * @param {string} text The text to measure the width, height and subline height of.
 * @param {string} font The font to measure the size in.
 * @return {{width: Number, height: Number, sublineHeight: Number}} The sizes of the text.
 */
export function getTextSize(text, font) {
  // re-use canvas object for better performance
  let canvas = document.createElement("canvas");
  let context = canvas.getContext("2d");
  context.font = font;
  let width = context.measureText(text).width;
  let height = context.measureText("W").width;
  let sublineHeight = context.measureText("H").width;
  return { width, height, sublineHeight };
}

/**
 * Converts an rgb color into an string representing a hex color
 * 
 * @param {Array} rgbArray [r, g, b] where 0 <= {r,g,b} <= 255
 */
export function rgbToHex(rgbArray) {
  return "#" + ((1 << 24) + (rgbArray[0] << 16) + (rgbArray[1] << 8) + rgbArray[2]).toString(16).slice(1);
}

/**
 * Turns an rgb color array to its string representation.
 * 
 * @param {string[]} colorArray - Array containing color as rgb values (0-255).
 */
export function colorToString(colorArray){
  return 'rgb(' + colorArray[0] + ',' + colorArray[1] + ',' + colorArray[2] + ')'; 
}

/*
  *  The method is used to calculate a 35 percent 
  *  darker color of an Object3D's material
  */
 export function calculateDarkerColor(object) {
  let actualColor = null;

  if (object.material.length) {
    actualColor = object.material[0].color;
  }
  else {
    actualColor = object.material.color;
  }

  let r = Math.floor(actualColor.r * 0.625 * 255);
  let g = Math.floor(actualColor.g * 0.625 * 255);
  let b = Math.floor(actualColor.b * 0.625 * 255);

  return "rgb(" + r + ", " + g + ", " + b + ")";
}

/*
* The method is used to reverse the effect of
* calculateDarkerColor()
*/
export function calculateLighterColor(object) {
  let actualColor = null;

  if (object.material.length) {
    actualColor = object.material[0].color;
  }
  else {
    actualColor = object.material.color;
  }

  let r = Math.floor(actualColor.r * 1.6 * 255);
  let g = Math.floor(actualColor.g * 1.6 * 255);
  let b = Math.floor(actualColor.b * 1.6 * 255);

  return "rgb(" + r + ", " + g + ", " + b + ")";
}