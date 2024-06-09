var serverIp = "localhost";
var geoserverPort = "localhost:8082";
var geoserverWorkspace = "GISLandSurvey";
var projectionName = "EPSG:3857";
var layerList = [];
var activeLayerName;
var editGeojson;
var modifiedFeatureList = [];
var editTask;
var modifiedFeature = false;
var modifyInteraction;
var featureAdd;
var snap_edit;

var mapView = new ol.View({
  center: ol.proj.fromLonLat([73.83367518602597, 18.53336461980136]),
  zoom: 18,
});

var map = new ol.Map({
  target: "map",
  view: mapView,
  //add none controls
  controls: [],
});

var osmTile = new ol.layer.Tile({
  title: "Open Streat Map",
  visible: true,
  source: new ol.source.OSM(),
  attribution:
    'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
});

var imgTile = new ol.layer.Tile({
  title: "World Imagery",
  source: new ol.source.TileWMS({
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  }),
  type: "base",
  visible: false,
});

var osmTile = new ol.layer.Tile({
  title: "Open Street Map",
  source: new ol.source.OSM(),
  type: "base",
  visible: true,
});
var esriWorldStreetTile = new ol.layer.Tile({
  title: "ESRI World Street Map",
  source: new ol.source.TileWMS({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  }),
  type: "base",
  visible: false,
});

var noneTile = new ol.layer.Tile({
  title: "None",
  source: new ol.source.OSM(),
  type: "base",
  visible: false,
});
var OpenTopoMap = new ol.layer.Tile({
  title: "Openlayer Topo Map",
  source: new ol.source.TileWMS({
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  }),
  type: "base",
  visible: false,
  attribution:
    'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
});
var baseGroup = new ol.layer.Group({
  title: "Base Maps",
  fold: "close",
  layers: [imgTile, osmTile, esriWorldStreetTile, OpenTopoMap, noneTile],
});

map.addLayer(baseGroup);

var buildingTile = new ol.layer.Tile({
  title: "Building",
  source: new ol.source.TileWMS({
    url:
      "http://" + geoserverPort + "/geoserver/" + geoserverWorkspace + "/wms",
    params: { LAYERS: "GISLandSurvey:Buildings", TILED: true },
    serverType: "geoserver",
    transition: 0,
  }),
});

var roadTile = new ol.layer.Tile({
  title: "Road",
  source: new ol.source.TileWMS({
    url:
      "http://" + geoserverPort + "/geoserver/" + geoserverWorkspace + "/wms",
    params: { LAYERS: "GISLandSurvey:Road", TILED: true },
    serverType: "geoserver",
    transition: 0,
  }),
});

var landMarkTile = new ol.layer.Tile({
  title: "Land Mark",
  source: new ol.source.TileWMS({
    url:
      "http://" + geoserverPort + "/geoserver/" + geoserverWorkspace + "/wms",
    params: { LAYERS: "GISLandSurvey:LandMark", TILED: true },
    serverType: "geoserver",
    transition: 0,
  }),
});

var landBaseGroup = new ol.layer.Group({
  title: "Land Base Maps",
  fold: "close",
  visible: false,
  layers: [buildingTile, roadTile, landMarkTile],
});

map.addLayer(landBaseGroup);

var layerSwitcher = new ol.control.LayerSwitcher({
  tipLabel: "Show Layers",
  collapsTipLabel: "Hide Layers",
  groupSelectStyle: "group",
});

map.addControl(layerSwitcher);

//open setting screem

function openSubScreen(screen) {
  $(".model").hide();
  $("#" + screen).show();
}

//convert the mapcoordinate to lonlat (get lat and Long from the map)
$("#spanLatLong").html(
  ol.proj.toLonLat(map.getView().getCenter())[1].toFixed(6) +
    "," +
    ol.proj.toLonLat(map.getView().getCenter())[0].toFixed(6)
);

$("#spanActiveLayer").html("Active layer : Not define");

//get map coordinate when the mouse moves over the map

var onPointermove = function (evt) {
  $("#spanLatLong").html(
    ol.proj.toLonLat(map.getView().getCenter())[1].toFixed(6) +
      "," +
      ol.proj.toLonLat(map.getView().getCenter())[0].toFixed(6)
  );
};
/*start geolocation*/
//based upon the serveyor location set the pan and zoom level
var geolocation = new ol.Geolocation({
  trackingOptions: {
    enableHighAccuracy: true,
  },
  tracking: true,
  projection: mapView.getProjection(),
});

var bufferdExtend;
geolocation.on("change:position", function (evt) {
  pointFeature = new ol.Feature({
    geometry: new ol.geom.Point(geolocation.getPosition()),
  });
  if (bufferdExtend) {
    if (
      ol.extent.containsXY(
        bufferdExtend,
        geolocation.getPosition()[0],
        geolocation.getPosition()[1]
      )
    ) {
      mapView.setCenter(geolocation.getPosition());
      mapView.setZoom(18);
    } else {
      bufferdExtend = new ol.extent.buffer(
        pointFeature.getGeometry().getExtent(),
        1000
      );
      map.srtView(
        new ol.View({
          center: geolocation.getPosition(),
          extent: bufferdExtend,
          zoom: 18,
        })
      );
    }
  }
});
/*end geolocation*/
//add draw interaction
//start length and area measure
var continuePolygonMsg = "Click to continue drawing the polygon";
var continueLineMsg = "Click to continue drawing the line";
var draw; // global so we can remove it later

var source = new ol.source.Vector();
var vector = new ol.layer.Vector({
  source: source,
  style: new ol.style.Style({
    fill: new ol.style.Fill({
      color: "rgba(255, 255, 255, 0.2)",
    }),
    stroke: new ol.style.Stroke({
      color: "#ffcc33",
      width: 2,
    }),
    image: new ol.style.Circle({
      radius: 7,
      fill: new ol.style.Fill({
        color: "#ffcc33",
      }),
    }),
  }),
});

map.addLayer(vector);

function addInteraction(intType) {
  draw = new ol.interaction.Draw({
    source: source,
    type: intType,
    style: new ol.style.Style({
      fill: new ol.style.Fill({
        color: "rgba(200, 200, 200, 0.6)",
      }),
      stroke: new ol.style.Stroke({
        color: "rgba(0, 0, 0, 0.5)",
        lineDash: [10, 10],
        width: 2,
      }),
      image: new ol.style.Circle({
        radius: 5,
        stroke: new ol.style.Stroke({
          color: "rgba(0, 0, 0, 0.7)",
        }),
        fill: new ol.style.Fill({
          color: "rgba(255, 255, 255, 0.2)",
        }),
      }),
    }),
  });
  map.addInteraction(draw);

  createMeasureTooltip();
  createHelpTooltip();

  /**
   * Currently drawn feature.
   * @type {import("../src/ol/Feature.js").default}
   */
  var sketch;

  /**
   * Handle pointer move.
   * @param {import("../src/ol/MapBrowserEvent").default} evt The event.
   */
  var pointerMoveHandler = function (evt) {
    if (evt.dragging) {
      return;
    }
    /** @type {string} */
    var helpMsg = "Click to start drawing";

    if (sketch) {
      var geom = sketch.getGeometry();
    }
  };

  map.on("pointermove", pointerMoveHandler);

  // var listener;
  draw.on("drawstart", function (evt) {
    // set sketch
    sketch = evt.feature;

    /** @type {import("../src/ol/coordinate.js").Coordinate|undefined} */
    var tooltipCoord = evt.coordinate;

    //listener = sketch.getGeometry().on('change', function (evt) {
    sketch.getGeometry().on("change", function (evt) {
      var geom = evt.target;
      var output;
      if (geom instanceof ol.geom.Polygon) {
        output = formatArea(geom);
        tooltipCoord = geom.getInteriorPoint().getCoordinates();
      } else if (geom instanceof ol.geom.LineString) {
        output = formatLength(geom);
        tooltipCoord = geom.getLastCoordinate();
      }
      measureTooltipElement.innerHTML = output;
      measureTooltip.setPosition(tooltipCoord);
    });
  });

  draw.on("drawend", function () {
    measureTooltipElement.className = "ol-tooltip ol-tooltip-static";
    measureTooltip.setOffset([0, -7]);
    // unset sketch
    sketch = null;
    // unset tooltip so that a new one can be created
    measureTooltipElement = null;
    createMeasureTooltip();
    //ol.Observable.unByKey(listener);
  });
}

/**
 * The help tooltip element.
 * @type {HTMLElement}
 */
var helpTooltipElement;

/**
 * Overlay to show the help messages.
 * @type {Overlay}
 */
var helpTooltip;

/**
 * Creates a new help tooltip
 */
function createHelpTooltip() {
  if (helpTooltipElement) {
    helpTooltipElement.parentNode.removeChild(helpTooltipElement);
  }
  helpTooltipElement = document.createElement("div");
  helpTooltipElement.className = "ol-tooltip hidden";
  helpTooltip = new ol.Overlay({
    element: helpTooltipElement,
    offset: [15, 0],
    positioning: "center-left",
  });
  map.addOverlay(helpTooltip);
}

// map.getViewport().addEventListener('mouseout', function () {
//     helpTooltipElement.classList.add('hidden');
// });

/**
 * The measure tooltip element.
 * @type {HTMLElement}
 */
var measureTooltipElement;

/**
 * Overlay to show the measurement.
 * @type {Overlay}
 */
var measureTooltip;

/**
 * Creates a new measure tooltip
 */

function createMeasureTooltip() {
  if (measureTooltipElement) {
    measureTooltipElement.parentNode.removeChild(measureTooltipElement);
  }
  measureTooltipElement = document.createElement("div");
  measureTooltipElement.className = "ol-tooltip ol-tooltip-measure";
  measureTooltip = new ol.Overlay({
    element: measureTooltipElement,
    offset: [0, -15],
    positioning: "bottom-center",
  });
  map.addOverlay(measureTooltip);
}

/**
 * Format length output.
 * @param {LineString} line The line.
 * @return {string} The formatted length.
 */
var formatLength = function (line) {
  var length = ol.sphere.getLength(line);
  var output;
  if (length > 100) {
    output = Math.round((length / 1000) * 100) / 100 + " " + "km";
  } else {
    output = Math.round(length * 100) / 100 + " " + "m";
  }
  return output;
};

/**
 * Format area output.
 * @param {Polygon} polygon The polygon.
 * @return {string} Formatted area.
 */
var formatArea = function (polygon) {
  var area = ol.sphere.getArea(polygon);
  var output;
  if (area > 10000) {
    output = Math.round((area / 1000000) * 100) / 100 + " " + "km<sup>2</sup>";
  } else {
    output = Math.round(area * 100) / 100 + " " + "m<sup>2</sup>";
  }
  return output;
};

// end : Length and Area Measurement Control
//add measure lenght and area control
//call funtion by using jquert onload funtion

$(function () {
  map.on("pointerdrag", onPointermove);

  $("#btnMeasureLength").click(function () {
    $("#btnMeasureLength").toggleClass("clicked");
    if ($("#btnMeasureLength").hasClass("clicked")) {
      map.removeInteraction(draw);
      addInteraction("LineString");
    } else {
      map.removeInteraction(draw);
      source.clear();
      const element = document.getElementByClassName(
        "ol-tooltip ol-tooltip-static"
      );
      while (element.length > 0) element[0].remove();
    }
  });
  /*setting button for getting active layer name*/
  $("#btnSetting").click(function () {
    $("#btnSetting").toggleClass("clicked");
    openSubScreen("divSettings");
  });
});

$("#btnSettingClose").click(function () {
  closeSettingSubScreen("divSettings");
});

function closeSettingSubScreen(screen) {
  $(".model").hide();
  $("#" + screen).hide();
}

/*create layer list for active layer start*/
for (var i = 0; i < map.getLayers().getLength(); i++) {
  var lyrl = map.getLayers().item(i);
  console.log(lyrl);
  if (lyrl.get("title") == "Base Maps") {
    // Do something for "Base Maps" layer if needed
  } else {
    if (
      typeof lyrl.getLayers === "function" &&
      lyrl.getLayers().getLength() > 0
    ) {
      for (var y = 0; y < lyrl.getLayers().getLength(); y++) {
        var layer1 = lyrl.getLayers().item(y);
        layerList.push(layer1.getSource().getParams().LAYERS);
      }
    } else {
      layerList.push(lyrl.get("title"));
    }
  }
}

console.log(layerList);

function addMapLayerList(selectElemetName) {
  var select = $("#" + selectElemetName);
  select.empty();
  select.append("<option class='ddindent value='' >--Select Layer--</option>");
  for (var i = 0; i < layerList.length; i++) {
    var value = layerList[i];
    var option =
      "<option class='ddindent' value='" + value + "'>" + value + "</option>";
    select.append(option);
  }
}

addMapLayerList("selLayer");
/*create layer list for active layer end*/

/*adding funtuinality to map button*/

$("#btnMap").click(function () {
  openMapScreen();
});

function openMapScreen() {
  $(".model").hide();
}

$("#selLayer").on("change", function () {
  activeLayerName = $("#selLayer").find(":selected").text();
  console.log(activeLayerName);
  if (activeLayerName == "--Select Layer--") {
    $("#spanActiveLayer").text("Active Layer :- No Active Layer");
  } else if (activeLayerName != "--Select Layer--" || activeLayerName != "") {
    $("#spanActiveLayer").text("Active Layer :- " + activeLayerName);
  }
  //enable all buttons
  $("#btnStartEditing").attr("disabled", false);
});

//diseble all buttons
$("#btnStartEditing").attr("disabled", true);
$("#btnAddFeature").attr("disabled", true);
$("#btnModifyFeature").attr("disabled", true);
$("#btnModifyAttribute").attr("disabled", true);
$("#btnDeleteFeature").attr("disabled", true);

//based on active layer highlight feature on map when editing start

$("#btnStartEditing").click(function () {
  openMapScreen();
  $("#btnStartEditing").toggleClass("clicked");
  if ($("#btnStartEditing").hasClass("clicked")) {
    var style = new ol.style.Style({
      fill: new ol.style.Fill({
        color: "rgba(0,0,0,0)",
      }),
      stroke: new ol.style.Stroke({
        color: "#00FFFF",
        width: 3,
      }),
      image: new ol.style.Circle({
        radius: 7,
        fill: new ol.style.Fill({
          color: "#00FFFF",
        }),
      }),
    });

    if (editGeojson) {
      editGeojson.getSource().clear();
      map.removeLayer(editGeojson);
    }
    editGeojson = new ol.layer.Vector({
      title: "Edit Layer",
      source: new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url:
          "http://" +
          geoserverPort +
          "/geoserver/" +
          geoserverWorkspace +
          "/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=" +
          activeLayerName +
          "&" +
          "outputFormat=application%2Fjson&srsname=EPSG:3857",
        strategy: ol.loadingstrategy.bbox,
      }),
      style: style,
    });
    map.addLayer(editGeojson);
  } else {
    if (modifiedFeatures.length > 0) {
      modifiedFeatures.forEach(function (feature) {
        var answer = confirm("Do you want to save changes?");
        if (answer) {
          saveEdits(editTask);
          modifiedFeatures = [];
        } else {
          modifiedFeatures = [];
        }
      });
    }
  }
  /*active all other buttons*/
  $("#btnAddFeature").attr("disabled", false);
  $("#btnModifyFeature").attr("disabled", false);
  $("#btnModifyAttribute").attr("disabled", false);
  $("#btnDeleteFeature").attr("disabled", false);
});

//based on active layer highlight feature on map start editing for that feature

// $("#btnAddFeature").click(function () {
//   $("#btnAddFeature").click(function () {
//     openMapScreen();
//     $("#btnAddFeature").toggleClass("clicked");
//     if ($("#btnAddFeature").hasClass("clicked") && activeLayerName == "GISLandSurvey:Buildings") {
//       map.removeInteraction(draw);
//       source.clear();
//       console.log(activeLayerName);
//       // addInteraction("Point");
//       // addInteraction("LineString");
//       addInteraction("Polygon");
//     } else if ($("#btnAddFeature").hasClass("clicked") && activeLayerName == "GISLandSurvey:Road") {
//       map.removeInteraction(draw);
//       source.clear();
//       console.log(activeLayerName);
//       addInteraction("LineString");
//     } else if ($("#btnAddFeature").hasClass("clicked") && activeLayerName == "GISLandSurvey:LandMark") {
//       map.removeInteraction(draw);
//       source.clear();
//       console.log(activeLayerName);
//       addInteraction("Point");
//     }
//     else {
//       map.removeInteraction(draw);
//       source.clear();
//       const element = document.getElementsByClassName(
//         "ol-tooltip ol-tooltip-static"
//       );
//       while (element.length > 0) element[0].remove();
//     }
//   });
// });

$("#btnAddFeature").click(function () {
  openMapScreen();
  $("#btnAddFeature").toggleClass("clicked");
  if ($("#btnAddFeature").hasClass("clicked")) {
    $("#btnModifyFeature").attr("disabled", true);
    $("#btnModifyAttribute").attr("disabled", true);
    $("#btnDeleteFeature").attr("disabled", true);

    if (modifiedFeatureList) {
      if (modifiedFeatureList.length > 0) {
        modifiedFeatureList.forEach(function (feature) {
          var answer = confirm("Do you want to save changes?");
          if (answer) {
            saveEdits(editTask);
            modifiedFeatureList = [];
          } else {
            modifiedFeatureList = [];
          }
        });
      }
      editTask = "insert";
      map.removeInteraction(drawInteraction);
      addFeature();
    } else {
      $("#btnModifyFeature").attr("disabled", false);
      $("#btnModifyAttribute").attr("disabled", false);
      $("#btnDeleteFeature").attr("disabled", false);
      map.removeInteraction(drawInteraction);
    }
  }
});

// function addFeature() {
//   if (activeLayerName == "GISLandSurvey:Buildings") {
//     addInteraction("Polygon");
//   } else if (activeLayerName == "GISLandSurvey:Road") {
//     addInteraction("LineString");
//   } else if (activeLayerName == "GISLandSurvey:LandMark") {
//     addInteraction("Point");
//   }
// }

var drawInteraction;
var clickSelectedFeatureOverlay = new ol.layer.Vector({
  source: new ol.source.Vector(),
  style: interactionStyle,
});
var interactionStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: "rgba(0,0,0,0)",
  }),
  stroke: new ol.style.Stroke({
    color: "#00FFFF",
    width: 3,
  }),
  image: new ol.style.Circle({
    radius: 7,
    fill: new ol.style.Fill({
      color: "#00FFFF",
    }),
  }),
});

function addFeature() {
  if (clickSelectedFeatureOverlay) {
    clickSelectedFeatureOverlay.getSource().clear();
    map.removeLayer(clickSelectedFeatureOverlay);
  }
  if (modifyInteraction) {
    map.removeInteraction(modifyInteraction);
  }
  if (snap_edit) {
    map.removeInteraction(snap_edit);
  }

  source_mod = editGeojson.getSource();
  drawInteraction = new ol.interaction.Draw({
    source: source_mod,
    type: editGeojson.getSource().getFeatures()[0].getGeometry().getType(),
    style: interactionStyle,
  });
  map.addInteraction(drawInteraction);

  snap_edit = new ol.interaction.Snap({
    source: source_mod,
  });
  map.addInteraction(snap_edit);

  drawInteraction.on("drawend", function (e) {
    var feature = e.feature;
    feature.set("geometry", feature.getGeometry());
    modifiedFeatureList.push(feature);

    var featureProperties = editGeojson
      .getSource()
      .getFeatures()[0]
      .getProperties();
    document.getElementById("attributeContainer").innerHTML = "";
    for (var key in featureProperties) {
      if (key != "geometry") {
        if (key != "id") {
          var div = document.createElement("div");
          div.className = "mb-3";
          var label = document.createElement("label");
          label.className = "form-label";
          label.innerHTML = key;
          var input = document.createElement("input");
          input.className = "form-control";
          input.type = "text";
          input.id = key;
          input.value = "";
          div.appendChild(label);
          div.appendChild(input);
          document.getElementById("attributeContainer").appendChild(div);
        }
      }
    }
    openSubScreen("attributeUpdate");
  });
}
var clones = [];
$('#btnSave').click(function saveEdits() {
  clones = [];
  var feature = modifiedFeatureList[0];
  var featureProperties = feature.getProperties();
  delete featureProperties.boundedBy;
  $('attributeContainer').children().each(function () {
    featureProperties[this.childern[1].id] = this.childern[1].value;
  });
  var clone = feature.clone();
  console.log(clone)
  clone.setProperties(featureProperties);
  clone.setId(feature.getId());
  clones.push(clone);
  console.log(editTask);
  if (editTask == "insert") {
    insertFeaturesWFS('insert',clone);
  }
  if (editTask == "update") {
    insertFeaturesWFS('update',clone);
  }
  if (editTask == "delete") {
    insertFeaturesWFS('delete',clone);
  }
  modifiedFeatureList = [];
  openMapScreen();
});

var formatWFS = new ol.format.WFS();

var insertFeaturesWFS = function (mode, f) {
  var node;
  if (mode == "insert") {
    node = formatWFS.writeTransaction([f], null, null, {
      featureType: activeLayerName,
      featureNS: geoserverWorkspace,
      service: "WFS",
      version: "1.1.0",
      srsName: "EPSG:3857",
      request : "GetFeature"
    });
  }
  if (mode == "update") {
    node = formatWFS.writeTransaction(null, [f], null, {
      featureType: activeLayerName,
      featureNS: geoserverWorkspace,
      service: "WFS",
      version: "1.1.0",
      srsName: "EPSG:3857",
      request : "GetFeature"
    });
  }
  if (mode == "delete") {
    node = formatWFS.writeTransaction(null, null, [f], {
      featureType: activeLayerName,
      featureNS: geoserverWorkspace,
      service: "WFS",
      version: "1.1.0",
      srsName: "EPSG:3857",
      request : "GetFeature"
    });
  }
  var s = new XMLSerializer();
  var payload = s.serializeToString(node);
  payload = payload.split('feature:' + activeLayerName).join(activeLayerName);
  if (mode == "insert") {payload = payload.split(geoserverWorkspace + ':geometry').join(geoserverWorkspace + ':geom')}
  if (mode == "update") {payload = payload.split("<Name>geometry</Name>").join("<Name>geom</Name>")}
  if (mode == "delete") {payload = payload.split("<Name>geometry</Name>").join("<Name>geom</Name>")}
  $.ajax("http://localhost:8082/geoserver/wfs", {
    type: "POST",
    dataType: "xml",
    processData: false,
    contentType: "text/xml",
    data: payload.trim(),
    success: function (data) {
      Toastify({
        text: "Feature Saved Successfully",
        duration: 5000,
        destination: "https://github.com/apvarun/toastify-js",
        newWindow: true,
        close: true,
        gravity: "top", // `top` or `bottom`
        position: "center", // `left`, `center` or `right`
        stopOnFocus: true, // Prevents dismissing of toast on hover
        style: {
          background: "linear-gradient(to right, #00b09b, #96c93d)",
        },
      }).showToast();
    },
    error: function (e) {
      var errorMsg = e ? (e.status ? e.status + " " : "") + e.statusText : "Unknown error";
      alert("Error" + errorMsg);
    }
  }).done(function () {
    editGeojson.getSource().refresh();
  });
};

//adding print option
$('#btnPrint').click(function () {
  $('#btnPrint').toggleClass("clicked")
  console.log('print');
  openSubScreen('printOptionsDiv');
  console.log(map.getViewport(),map.getLayers());
});

const scaleLine = new ol.control.ScaleLine({bar: true, text: true, minWidth: 125});
map.addControl(scaleLine);

const dims = {
  a0: [1189, 841],
  a1: [841, 594],
  a2: [594, 420],
  a3: [420, 297],
  a4: [297, 210],
  a5: [210, 148],
};

// export options for html2canvase.
// See: https://html2canvas.hertzen.com/configuration
const exportOptions = {
  useCORS: true,
  pixelRatio: 3,
  ignoreElements: function (element) {
    const className = element.className || '';
  },
};
//export pdf function
const exportButton = document.getElementById('export-pdf');

exportButton.addEventListener(
  'click',
  function () {
    exportButton.disabled = true;
    document.body.style.cursor = 'progress';

    const format = document.getElementById('format').value;
    const resolution = document.getElementById('resolution').value;
    const scale = document.getElementById('scale').value;
    const dim = dims[format];
    const width = Math.round((dim[0] * resolution) / 85.4);
    const height = Math.round((dim[1] * resolution) / 85.4);
    const viewResolution = map.getView().getResolution();
    const scaleResolution =
      scale /
      ol.proj.getPointResolution(
        map.getView().getProjection(),
        resolution / 5.4,
        map.getView().getCenter()
      );

    map.once('rendercomplete', function () {
      exportOptions.width = width;
      exportOptions.height = height;

      html2canvas(map.getViewport(), exportOptions).then(function (canvas) {
        const pdf = new jspdf.jsPDF('landscape', undefined, format);
        pdf.addImage(
          canvas.toDataURL('image/jpeg'),
          'JPEG',
          0,
          0,
          dim[0],
          dim[1]
        );
        pdf.save('map.pdf');
        // Reset original map size
        scaleLine.setDpi();
        map.getTargetElement().style.width = '';
        map.getTargetElement().style.height = '';
        map.updateSize();
        map.getView().setResolution(viewResolution);
        exportButton.disabled = false;
        document.body.style.cursor = 'auto';
      });
    });

    // Set print size
    // scaleLine.setDpi(resolution);
    map.getTargetElement().style.width = width + 'px';
    map.getTargetElement().style.height = height + 'px';
    map.updateSize();
    map.getView().setResolution(scaleResolution);
  },
  false
);

//create an div element
var featureInfoButton =$("#btnFratureInfo")
var featureInfoFlag = false;

featureInfoButton.click( () => {
  featureInfoButton.toggleClass("clicked");
  featureInfoFlag = !featureInfoFlag;
});

var popupcontainer = document.getElementById("popup");
var popupcontent = document.getElementById("popup-content");
var popupcloser = document.getElementById("popup-closer");
//var closer = document.getElementById('popup-closer');

var popup = new ol.Overlay({
  element: popupcontainer,
  autoPan: true,
  autoPanAnimation: {
    duration: 250,
  },
});

map.addOverlay(popup);

//adding onclick event in popup

popupcloser.onclick = function () {
  popup.setPosition(undefined);
  popupcloser.blur();
  return false;
};

//adding onclick event in popup
var sourceLayer = [buildingTile,roadTile,landMarkTile];
map.on("singleclick", function (evt) {
  //get layer which present bellow the clicked point
  // var layer = map.forEachLayerAtPixel(evt.pixel, function (layer) {
  //   return layer;
  // }
  // );
  //console.log(layer);
  if (featureInfoFlag) {
    console.log("feature info getting....");
    var viewResolution = map.getView().getResolution();
    for (var i = 0; i < sourceLayer.length; i++) {
    var url = sourceLayer[i].getSource().getFeatureInfoUrl(
      evt.coordinate,
      viewResolution,
      "EPSG:3857",
      { INFO_FORMAT: "application/json" }
    );
    if (url) {
      fetch(url)
        .then(function (response) {
          return response.text();
        })
        .then(function (json) {
          var features = new ol.format.GeoJSON().readFeatures(json);
          if (features.length > 0) {
            var info = [];
            for (var i = 0, ii = features.length; i < ii; ++i) {
              info.push(features[i].get("Name"));
            }
            if (info.length > 0) {
              popupcontent.innerHTML = "</p> <h5> Name: </h5> <p>" + info.join(", ");
              popup.setPosition(evt.coordinate);
            }else {
              popup.setPosition(undefined);
              popupcloser.blur();
            }
          } 
        });
    }
  }
}
}
);



