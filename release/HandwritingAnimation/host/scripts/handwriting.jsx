/**
 * handwriting.jsx  —  ExtendScript for Adobe After Effects
 *
 * Receives serialized CompositionData from the CEP panel and
 * builds the full handwriting animation inside After Effects.
 *
 * Compatible with: After Effects CC 2019+
 */

// ─── Entry Point (called by CEP bridge) ──────────────────────────────────────

/**
 * Main entry point called from the panel via evalScript.
 * @param {string} jsonData - JSON-serialized CompositionData
 * @returns {string} JSON result string
 */
function createHandwritingAnimation(jsonData) {
  try {
    var data = JSON.parse(jsonData);
    var result = buildComposition(data);
    return JSON.stringify({ success: true, data: result });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.toString() });
  }
}

// ─── Composition Builder ──────────────────────────────────────────────────────

function buildComposition(data) {
  app.beginUndoGroup('Handwriting Animation');

  var project = app.project;

  // Create composition
  var comp = project.items.addComp(
    data.name,
    data.width,
    data.height,
    1,                   // pixel aspect ratio
    data.duration,
    data.frameRate
  );

  // Background
  if (data.backgroundColor && data.backgroundColor !== 'transparent') {
    var bgLayer = comp.layers.addSolid(
      hexToRgb(data.backgroundColor),
      'Background',
      data.width,
      data.height,
      1,
      data.duration
    );
    bgLayer.moveToEnd();
  }

  // Add texture overlay for paper styles
  // (would reference assets/textures/ in production)

  // Build shape layers from stroke data
  var shapeLayersGroup = buildShapeLayers(comp, data.shapeLayers, data.duration);

  // Add pen layer if present
  if (data.penLayer) {
    buildPenLayer(comp, data.penLayer, data.duration);
  }

  // Add camera for zoom effect
  if (data.hasCamera) {
    buildAnimatedCamera(comp, data.duration);
  }

  // Enable motion blur on comp
  comp.motionBlur = true;

  app.endUndoGroup();

  return {
    compName: comp.name,
    compId: comp.id,
    layerCount: comp.numLayers,
    duration: comp.duration
  };
}

// ─── Shape Layer Construction ─────────────────────────────────────────────────

function buildShapeLayers(comp, shapeLayers, totalDuration) {
  var group = [];

  for (var i = 0; i < shapeLayers.length; i++) {
    var layerData = shapeLayers[i];
    if (layerData.isLift) continue; // Skip invisible lift strokes

    var shapeLayer = comp.layers.addShape();
    shapeLayer.name = layerData.name;
    shapeLayer.motionBlur = true;

    var contents = shapeLayer.property('Contents');

    // Add path group
    var pathGroup = contents.addProperty('ADBE Vector Group');
    pathGroup.name = 'Stroke Path';

    var pathItems = pathGroup.property('Contents');

    // Add the path
    var pathProp = pathItems.addProperty('ADBE Vector Shape - Group');
    var shapeProp = pathProp.property('ADBE Vector Shape');

    // Convert SVG path string to AE shape
    setShapePath(shapeProp, layerData.pathData);

    // Add stroke
    var strokeProp = pathItems.addProperty('ADBE Vector Graphic - Stroke');
    strokeProp.property('ADBE Vector Stroke Color').setValue(hexToRgbArray(layerData.strokeColor));
    strokeProp.property('ADBE Vector Stroke Line Cap').setValue(2); // Round cap
    strokeProp.property('ADBE Vector Stroke Line Join').setValue(2); // Round join

    // Animate stroke width if keyframes exist
    var strokeWidthProp = strokeProp.property('ADBE Vector Stroke Width');
    applyKeyframes(strokeWidthProp, layerData.strokeWidth.keyframes, totalDuration);

    // Add Trim Paths
    var trimGroup = contents.addProperty('ADBE Vector Filter - Trim');
    var trimEnd = trimGroup.property('ADBE Vector Trim End');
    var trimStart = trimGroup.property('ADBE Vector Trim Start');

    applyKeyframes(trimEnd, layerData.trimPathEnd.keyframes, totalDuration);
    trimStart.setValue(0);

    // Animate opacity
    var opacityProp = shapeLayer.property('Transform').property('Opacity');
    applyKeyframes(opacityProp, layerData.opacity.keyframes, totalDuration);

    group.push(shapeLayer);
  }

  return group;
}

// ─── Pen Layer ────────────────────────────────────────────────────────────────

function buildPenLayer(comp, penData, totalDuration) {
  // In production: import the pen asset from assets/pens/
  // For now, create a solid as placeholder
  var penColors = {
    fountain: [0.1, 0.1, 0.15],
    pencil: [0.4, 0.4, 0.4],
    marker: [0.05, 0.05, 0.05],
    brush: [0.2, 0.15, 0.1]
  };

  var penColor = penColors[penData.penType] || penColors.fountain;

  var penLayer = comp.layers.addSolid(
    penColor,
    'Pen (' + penData.penType + ')',
    30,
    80,
    1,
    totalDuration
  );

  // Anchor point at pen tip
  penLayer.property('Transform').property('Anchor Point').setValue([15, 80]);

  // Animate position
  var posProp = penLayer.property('Transform').property('Position');
  var xKFs = penData.position.x.keyframes;
  var yKFs = penData.position.y.keyframes;

  for (var i = 0; i < xKFs.length; i++) {
    posProp.setValueAtTime(xKFs[i].time, [xKFs[i].value, yKFs[i] ? yKFs[i].value : 0]);
  }

  // Animate rotation
  var rotProp = penLayer.property('Transform').property('Rotation');
  applyKeyframes(rotProp, penData.rotation.keyframes, totalDuration);

  // Animate opacity
  var opProp = penLayer.property('Transform').property('Opacity');
  applyKeyframes(opProp, penData.opacity.keyframes, totalDuration);

  // Easy ease all keyframes
  easyEaseAllKeyframes(posProp);
  easyEaseAllKeyframes(rotProp);

  penLayer.moveToBeginning();
}

// ─── Camera ───────────────────────────────────────────────────────────────────

function buildAnimatedCamera(comp, totalDuration) {
  var camera = comp.layers.addCamera('Writing Camera', [comp.width / 2, comp.height / 2]);
  camera.property('Position').setValue([comp.width / 2, comp.height / 2, -1200]);

  // Subtle push-in
  var zoomProp = camera.property('Zoom');
  zoomProp.setValueAtTime(0, 1200);
  zoomProp.setValueAtTime(totalDuration * 0.5, 1000);
  zoomProp.setValueAtTime(totalDuration, 1100);

  easyEaseAllKeyframes(zoomProp);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function applyKeyframes(prop, keyframes, totalDuration) {
  if (!keyframes || keyframes.length === 0) return;

  for (var i = 0; i < keyframes.length; i++) {
    var kf = keyframes[i];
    prop.setValueAtTime(kf.time, kf.value);
  }

  easyEaseAllKeyframes(prop);
}

function easyEaseAllKeyframes(prop) {
  try {
    if (prop.numKeys > 0) {
      for (var i = 1; i <= prop.numKeys; i++) {
        prop.setTemporalEaseAtKey(
          i,
          [new KeyframeEase(0.5, 33)],
          [new KeyframeEase(0.5, 67)]
        );
      }
    }
  } catch (e) {
    // Some properties don't support temporal ease — skip silently
  }
}

/**
 * Set an AE shape path from an SVG path string.
 * Parses M, L, C, Q, Z commands.
 */
function setShapePath(shapeProp, svgPathString) {
  try {
    var vertices = [];
    var inTangents = [];
    var outTangents = [];
    var closed = false;

    var tokens = svgPathString.split(/(?=[MLCQZ])/);
    var lastX = 0, lastY = 0;

    for (var t = 0; t < tokens.length; t++) {
      var token = tokens[t].trim();
      if (!token) continue;

      var type = token[0];
      var nums = token.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter(function(n) { return !isNaN(n); });

      if (type === 'M') {
        lastX = nums[0]; lastY = nums[1];
        vertices.push([lastX, lastY]);
        inTangents.push([0, 0]);
        outTangents.push([0, 0]);
      } else if (type === 'L') {
        lastX = nums[0]; lastY = nums[1];
        vertices.push([lastX, lastY]);
        inTangents.push([0, 0]);
        outTangents.push([0, 0]);
      } else if (type === 'C') {
        // Cubic bezier: x1,y1 x2,y2 x,y
        var x1 = nums[0], y1 = nums[1];
        var x2 = nums[2], y2 = nums[3];
        var x  = nums[4], y  = nums[5];

        // AE tangents are relative to the vertex
        if (vertices.length > 0) {
          var prevIdx = vertices.length - 1;
          outTangents[prevIdx] = [x1 - lastX, y1 - lastY];
        }

        vertices.push([x, y]);
        inTangents.push([x2 - x, y2 - y]);
        outTangents.push([0, 0]);
        lastX = x; lastY = y;
      } else if (type === 'Q') {
        // Quadratic: x1,y1 x,y — approximate as cubic
        var qx1 = nums[0], qy1 = nums[1];
        var qx  = nums[2], qy  = nums[3];
        vertices.push([qx, qy]);
        inTangents.push([qx1 - qx, qy1 - qy]);
        outTangents.push([0, 0]);
        lastX = qx; lastY = qy;
      } else if (type === 'Z') {
        closed = true;
      }
    }

    if (vertices.length > 0) {
      var newShape = new Shape();
      newShape.vertices = vertices;
      newShape.inTangents = inTangents;
      newShape.outTangents = outTangents;
      newShape.closed = closed;
      shapeProp.setValue(newShape);
    }
  } catch (e) {
    $.writeln('setShapePath error: ' + e.toString());
  }
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ];
}

function hexToRgbArray(hex) {
  return hexToRgb(hex);
}

// ─── Export for CEP Bridge ────────────────────────────────────────────────────

// Make function available to evalScript calls
createHandwritingAnimation;