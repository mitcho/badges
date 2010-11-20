var Panorama = require("panorama");

var badgeStyle = {position: "absolute",
                  right: 0,
                  bottom: 0,
                  padding: "6px",
                  borderRadius: "13px",
                  marginRight: "-7px",
                  marginBottom: "-7px",
                  minWidth: "12px",
                  textAlign: "center",
                  color: "white",
                  background: "-moz-linear-gradient(top left, rgba(255,0,0,255), rgba(200, 0, 0, 255))",
                  font: "bold 12px/12px Helvetica, Arial, sans-serif"};

var addBadge = function(tabItem, panoramaInstance) {
  let {iQ} = panoramaInstance;
  
  let label = null;
  let match = /\(\s*(\d+)\s*\)/.exec(tabItem.title);
  if (match && match[1])
    label = match[1];

//  console.log(tabItem.title, label);

  if (label) {
    if (tabItem.dom.find('.badge').length) {
      tabItem.dom.find('.badge').text(label);
    } else {
      let badge = iQ("<div>").addClass("badge")
                             .text(label)
                             .css(badgeStyle);
      tabItem.dom.append(badge);
    }
  } else {
    // in case we've already added a badge before, remove it
    if (tabItem.dom.find('.badge').length)
      tabItem.dom.find('.badge').remove();
  }
}

var onInit = function(panoramaInstance) {
  let {TabItems, iQ} = panoramaInstance;
  TabItems.on("load", addBadge);
  TabItems.on("modified", addBadge);
};

exports.main = function (options, callbacks) {
  Panorama.on("init", onInit);
};
exports.onUnload = function (reason) {
  Panorama.removeListener("init", onInit);
};