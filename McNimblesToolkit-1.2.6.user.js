// ==UserScript==
// @name        McNimble's Toolkit
// @author      Kero van Gelder
// @copyright   Kero van Gelder, 2015 - 2021
// @license     All rights reserved
// @downloadURL https://chmeee.org/ext/planets.nu/McNimblesToolkit.user.js
// @description For planets.nu -- toolkit to enable McNimble's other scripts
// @namespace   kero/planets.nu
// @include     http://planets.nu/*
// @include     https://planets.nu/*
// @include     http://*.planets.nu/*
// @include     https://*.planets.nu/*
// @version     1.2.6
// @grant       none
// ==/UserScript==

(() => {

var name = "McNimble's Toolkit"
var version = "1.2.6";

// Version

McNTkVersion = function(version) {
    var parts = version.split(/\./);
    this.major = parseInt(parts[0] || "0");
    this.minor = parseInt(parts[1] || "0");
    this.step = parseInt(parts[2] || "0");
};

McNTkVersion.prototype.isAtLeast = function(version) {
    var other = new McNTkVersion(version);
    return (this.major > other.major) ||
        (this.major == other.major && this.minor > other.minor) ||
        (this.major == other.major && this.minor == other.minor && this.step >= other.step);
};

// Settings

McNTkSettings = function() {
    var settings = function(noteType) {
        this.noteType = noteType;
        this.cache = {};
    };

    var p = settings.prototype;

    p.createBrowserSetting = function(variable, defaultValue) {
        this[variable] = function() {
            return this.getSetting(variable, defaultValue);
        };
        var capitalizedVariable = variable[0].toUpperCase() + variable.substr(1);
        this["set"+capitalizedVariable] = function(value) {
            this.setSetting(variable, value);
        }
    };

    p.createBooleanBrowserSetting = function(variable, defaultValue) {
        this[variable] = function() {
            var value = this.getSetting(variable, defaultValue ? "true" : "false");
            return (value == "true");
        };
        var capitalizedVariable = variable[0].toUpperCase() + variable.substr(1);
        this["set"+capitalizedVariable] = function(value) {
            this.setSetting(variable, (value ? "true" : "false"));
        }
    };

    p.createFloatBrowserSetting = function(variable, defaultValue) {
        this[variable] = function() {
            var value = this.getSetting(variable, ""+defaultValue);
            return parseFloat(value);
        };
        var capitalizedVariable = variable[0].toUpperCase() + variable.substr(1);
        this["set"+capitalizedVariable] = function(value) {
            this.setSetting(variable, ""+value);
        }
    };

    // browser local settings

    p.getSetting = function(variable, defaultSetting) {
        if (this.haveAccountSettings()) {
            var name = this.settingName(variable);
            return this.getCachedSetting(name, defaultSetting);
        } else {
            return defaultSetting;
        }
    };

    p.setSetting = function(variable, stringValue) {
        if (this.haveAccountSettings()) {
            var name = this.settingName(variable);
            this.setCachedSetting(name, stringValue);
        } else {
            // no sensible place to cache/store
            // fail silently as player is not logged in
        }
    };

    p.haveAccountSettings = function() {
        return (nu.data != null) && (nu.data.account != null);
    };

    p.settingName = function(variable) {
        return "ForNetbooks_"+nu.data.account.id+"_"+variable;
    };

    // cached settings (because it is possible local storage is disabled and we still want to remember the setting as long as we can)

    p.getCachedSetting = function(name, defaultSetting) {
        if (typeof(this.cache[name]) == "undefined") {
            return this.getSettingFromLocalStorage(name, defaultSetting);
        } else {
            return this.cache[name];
        }
    };

    p.setCachedSetting = function(name, stringValue) {
        this.cache[name] = stringValue;
        this.setSettingInLocalStorage(name, stringValue);
    };

    // stored settings

    p.mayUseLocalStorage = function() {
        var weMay = false;
        try {
            localStorage.getItem("x");
            weMay = true;
        } catch(e) {
            if (e.toString().match(/^SecurityError/)) {
                // silently fail, use result of this method to tell the user
            } else {
                throw e;
            }
        }
        return weMay;
    };

    p.getSettingFromLocalStorage = function(name, defaultSetting) {
        var result;
        try {
            result = localStorage.getItem(name);  // In Firefox, this is SLOW
            if (result == null) result = defaultSetting;
        } catch(e) {
            if (e.toString().match(/^SecurityError/)) {
                result = defaultSetting;
            } else {
                throw e;
            }
        }
        this.cache[name] = result;
        return result;
    };

    p.setSettingInLocalStorage = function(name, value) {
        try {
            localStorage.setItem(name, value);
        } catch(e) {
            if (e.toString().match(/^SecurityError/)) {
                // silent failure; use mayUseLocalStorage somewhere to warn user of this
            } else {
                throw e;
            }
        }
    };

    // Game settings

    // Note that for one plug-in the type should be the same for all settings,
    // but the ids should be different

    p.createGameSetting = function(variable, defaultValue) {
        this[variable] = function() {
            return this.getGameSetting(variable, defaultValue);
        };
        var capitalizedVariable = variable[0].toUpperCase() + variable.substr(1);
        this["set"+capitalizedVariable] = function(value) {
            this.setGameSetting(variable, value);
        }
    };

    p.createBooleanGameSetting = function(variable, defaultValue) {
        this[variable] = function() {
            var value = this.getGameSetting(variable, defaultValue ? "true" : "false");
            return (value == "true");
        };
        var capitalizedVariable = variable[0].toUpperCase() + variable.substr(1);
        this["set"+capitalizedVariable] = function(value) {
            this.setGameSetting(variable, value ? "true" : "false");
        }
    };

    p.createIntGameSetting = function(variable, defaultValue) {
        this[variable] = function() {
            var value = this.getGameSetting(variable, defaultValue ? ""+defaultValue : "0");
            return parseInt(value);
        };
        var capitalizedVariable = variable[0].toUpperCase() + variable.substr(1);
        this["set"+capitalizedVariable] = function(value) {
            this.setGameSetting(variable, "" + value);
        }
    };

    p.getGameSetting = function(variable, defaultValue) {
        var note = vgap.getNote(0, this.noteType);
        var settings = this.decodeSettings(note.body);
        return settings[variable] || defaultValue;
    };

    p.setGameSetting = function(variable, value) {
        var note = vgap.getNote(0, this.noteType);
        var settings = this.decodeSettings(note.body);
        if (value != settings[variable]) {
            console.log("Saving", variable, value);
            settings[variable] = value;
            note.body = this.encodeSettings(settings);
            note.changed = 1;
            vgap.save();
        }
    };

    p.decodeSettings = function(string) {
        return string == "" ? {} : JSON.parse(string);
    };

    p.encodeSettings = function(settings) {
        return JSON.stringify(settings);
    };

    return settings;
}();

//

var alreadyInstalledMcNTk = vgap.plugins[name];
if (alreadyInstalledMcNTk) {
    if (alreadyInstalledMcNTk.version.isAtLeast(version)) {
        console.log(name, alreadyInstalledMcNTk.version, "already installed, not loading", version);
        return;  // Drop out of the wrapping function (Meta.js and Tail.js), i.e. only override if this is the newer version
    } else {
        console.log(name, alreadyInstalledMcNTk.version, "installed, upgrading to", version);
    }
} else {
    console.log("McN Tk not yet installed, proceeding!");
}

var noteType = function (name) {
    // as computed by bigintHash in https://greasyfork.org/en/scripts/6685-planets-nu-plugin-toolkit/code
    return -parseInt(name.replace(/[_\W]/g, ""), 36) % 2147483648;
}

var McNimblesToolkit = function() {
    var plugin = function(name, version) {
        this.noteType = noteType(name);
        this.McNimblesToolkit = McNimblesToolkit;
        this.version = new McNTkVersion(version);
        this.settings = new McNTkSettings(this.noteType);
    };

    return plugin;
}();

var mcntk;
if (alreadyInstalledMcNTk) {
    alreadyInstalledMcNTk.McNimblesToolkit = McNimblesToolkit;
    alreadyInstalledMcNTk.version = new McNTkVersion(version);
    mcntk = alreadyInstalledMcNTk;
} else {
    mcntk = new McNimblesToolkit(name, version);
    vgap.registerPlugin(mcntk, name);
}

mcntk.computeNoteType = noteType;  // exported for testing only

mcntk.onMobile = function() {
    return vgap.version >= 4;
}

// Checks for plugins that use this toolkit

mcntk.haveRedrawAndFilter = function() {
    return vgap.plugins["Redraw and Filter"];
};

mcntk.haveShowNotes = function() {
    return vgap.plugins["Show Notes"];
};

mcntk.haveShowMessages = function() {
    return vgap.plugins["Show Messages"];
};

mcntk.haveSphereDuplication = function() {
    return vgap.plugins["Sphere Duplication"];
};

// Bounding Rectangles of groups of circles

mcntk.BoundingRectangles = function(circles) {
    this.computedRectangles = [];

    var doOverlap = function(sq1, sq2) {
        return sq1.minX <= sq2.maxX &&
            sq2.minX <= sq1.maxX &&
            sq1.minY <= sq2.maxY &&
            sq2.minY <= sq1.maxY;
    }

    var combine = function(sq1, sq2) {
        return {
            minX: Math.min(sq1.minX, sq2.minX),
            minY: Math.min(sq1.minY, sq2.minY),
            maxX: Math.max(sq1.maxX, sq2.maxX),
            maxY: Math.max(sq1.maxY, sq2.maxY),
            circles: sq1.circles.concat(sq2.circles)
        }
    }

    this.addCircle = function(circle) {
        var newRectangle = {
            minX: circle.x - circle.radius,
            minY: circle.y - circle.radius,
            maxX: circle.x + circle.radius,
            maxY: circle.y + circle.radius,
            circles: [circle]
        }

        // check all existing rectangles, enlarging the new rectangle, deleting the old rectangle
        for (var i=0; i<this.computedRectangles.length;) {
            if (doOverlap(this.computedRectangles[i], newRectangle)) {
                newRectangle = combine(this.computedRectangles[i], newRectangle);
                this.computedRectangles.splice(i, 1);
            } else {
                i++;
            }
        }

        // That way, we can always add the new rectangle
        this.computedRectangles.push(newRectangle);
    }

    // some sort of canonical order would be nice for comparison
    this.rectangles = function() {
        return this.computedRectangles;
    }

    if (circles) {
        var self = this;
        circles.forEach(function(c) {
            self.addCircle(c);
        });
    }
}

// Drawing

function spheroidForRectangles(fun) {
    return function(x1, y1, x2, y2, ...arg) {
        if (mcntk.doSphereDuplication()) {
            forAllSphereRectangles(x1, y1, x2, y2, function(sx1, sy1, sx2, sy2) {
                fun(sx1, sy1, sx2, sy2, ...arg);
            });
        } else {
            if (isRectangleVisible(x1, y1, x2, y2)) fun(x1, y1, x2, y2, ...arg);
        }
    };
}

var isRectangleVisible = function(x1, y1, x2, y2) {
    var r = Math.dist(x1, y1, x2, y2) / 2;
    return vgap.map.isVisible((x1+x2)/2, (y1+y2)/2, r)
}

mcntk.drawSingleMapLine = function(x1, y1, x2, y2, strokeStyle) {
    mcntk.drawScreenLine(vgap.map.screenX(x1), vgap.map.screenY(y1),
                   vgap.map.screenX(x2), vgap.map.screenY(y2), strokeStyle);
}

mcntk.drawScreenLine = function(x1, y1, x2, y2, strokeStyle) {
    var ctx = vgap.map.ctx;
    ctx.lineWidth = 1;
    ctx.strokeStyle = strokeStyle;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
};

mcntk.drawMapLine = spheroidForRectangles(mcntk.drawSingleMapLine);

mcntk.drawMapDisc = function(x, y, r, color) {
    if (mcntk.doSphereDuplication()) {
        forAllSphereRectangles(x-r, y-r, x+r, y+r, function(sx1, sy1, sx2, sy2) {
            mcntk.drawSingleMapDisc((sx1+sx2)/2, (sy1+sy2)/2, r, color);
        });
    } else {
        if (vgap.map.isVisible(x, y, r)) mcntk.drawSingleMapDisc(x, y, r, color);
    }
}

mcntk.drawSingleMapDisc = function(x, y, r, color) {
    drawScreenDisc(vgap.map.screenX(x), vgap.map.screenY(y), r*vgap.map.zoom, color);
}

var drawScreenDisc = function(screenX, screenY, screenR, color) {
    var ctx = vgap.map.ctx;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, screenR, 0, Math.PI * 2, false);
    ctx.closePath();
    ctx.fill();
}

mcntk.drawMapCircle = function(x, y, r, strokeStyle, width) {
    if (mcntk.doSphereDuplication()) {
        forAllSphereRectangles(x-r, y-r, x+r, y+r, function(sx1, sy1, sx2, sy2) {
            mcntk.drawSingleMapCircle((sx1+sx2)/2, (sy1+sy2)/2, r, strokeStyle, width);
        });
    } else {
        if (vgap.map.isVisible(x, y, r)) mcntk.drawSingleMapCircle(x, y, r, strokeStyle, width);
    }
}

mcntk.drawSingleMapCircle = function(x, y, r, strokeStyle, width) {
    mcntk.drawScreenCircle(vgap.map.screenX(x), vgap.map.screenY(y), r * vgap.map.zoom, strokeStyle, width);
}

mcntk.drawSingleMapBand = function(x, y, r, strokeStyle, width) {
    mcntk.drawScreenCircle(vgap.map.screenX(x), vgap.map.screenY(y), r * vgap.map.zoom, strokeStyle, width * vgap.map.zoom);
}

mcntk.drawScreenCircle = function(x, y, r, strokeStyle, width) {
    var ctx = vgap.map.ctx;
    ctx.strokeStyle = strokeStyle;
    if (!width) width = 1;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2, false);
    ctx.closePath();
    ctx.stroke();

    ctx.lineWidth = 1;  // be nice
};

// tenths is used for dashing: at 1 you get a dot every 10 pixels, at 9 you have an almost solid circle
// vaules below 1 are set to 1
// values above 9 are set to 9, except for 10, which will give you a solid circle
mcntk.drawMapDashedCircle = function(x, y, r, strokeStyle, tenths, width) {
    if (mcntk.doSphereDuplication()) {
        forAllSphereLocations(x, y, function(sphereX, sphereY) {
            mcntk.drawSingleMapDashedCircle(sphereX, sphereY, r, strokeStyle, tenths, width);
        });
    } else {
        if (vgap.map.isVisible(x, y, r)) mcntk.drawSingleMapDashedCircle(x, y, r, strokeStyle, tenths, width);
    }
}

mcntk.drawSingleMapDashedCircle = function(x, y, r, strokeStyle, tenths, width) {
    mcntk.drawScreenDashedCircle(vgap.map.screenX(x), vgap.map.screenY(y), r * vgap.map.zoom, strokeStyle, tenths, width);
}

mcntk.drawScreenDashedCircle = function(x, y, r, strokeStyle, tenths, width) {
    if (!width) width = 2;

    var ctx = vgap.map.ctx;
    var oldLineDash = ctx.getLineDash();

    var normalized = typeof(tenths) === "number" ? normalizeTenths(tenths) : tenths;
    ctx.setLineDash([normalized, 10.0-normalized]);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2, false);
    ctx.closePath();
    ctx.stroke();

    // be nice
    ctx.lineWidth = 1;
    ctx.setLineDash(oldLineDash);
};

var normalizeTenths = function(tenths) {
    if (tenths < 1) tenths = 1;
    if (tenths > 10) tenths = 10;
    if ((tenths > 9) && (tenths < 10)) tenths = 9;
    return tenths;
};

mcntk.drawMapArc = function(x, y, r, angFrom, angTo, strokeStyle) {
    if (mcntk.doSphereDuplication()) {
        forAllSphereLocations(x, y, function(sphereX, sphereY) {
            mcntk.drawSingleMapArc(sphereX, sphereY, r, angFrom, angTo, strokeStyle);
        });
    } else {
        if (vgap.map.isVisible(x, y, r)) mcntk.drawSingleMapArc(x, y, r, angFrom, angTo, strokeStyle);
    }
}

mcntk.drawSingleMapArc = function(x, y, r, angFrom, angTo, strokeStyle) {
    mcntk.drawScreenArc(vgap.map.screenX(x), vgap.map.screenY(y), r*vgap.map.zoom, angFrom, angTo, strokeStyle);
}

mcntk.drawScreenArc = function(x, y, r, angFrom, angTo, strokeStyle) {
    var ctx = vgap.map.ctx;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, angFrom, angTo, false);
    ctx.stroke();
};

mcntk.drawFilledArc = function(x, y, r, angFrom, angTo, style) {
    if (mcntk.doSphereDuplication()) {
        forAllSphereLocations(x, y, function(sphereX, sphereY) {
            doDrawFilledArc(sphereX, sphereY, r, angFrom, angTo, style);
        });
    } else {
        if (vgap.map.isVisible(x, y, r)) doDrawFilledArc(x, y, r, angFrom, angTo, style);
    }
}

function doDrawFilledArc(x, y, r, angFrom, angTo, style) {
    var screenX = vgap.map.screenX(x);
    var screenY = vgap.map.screenY(y);
    var screenR = vgap.map.zoom * r
    var ctx = vgap.map.ctx;
    var gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, screenR);
    gradient.addColorStop(0, "black");
    gradient.addColorStop(1, style);
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.arc(screenX, screenY, screenR, angFrom, angTo, false);
    ctx.closePath();
    ctx.fill();
};

mcntk.drawMapCrosshair = function(x, y, r, strokeStyle, dashArray) {
    if (mcntk.doSphereDuplication()) {
        forAllSphereLocations(x, y, function(sphereX, sphereY) {
            drawSingleMapCrosshair(sphereX, sphereY, r, strokeStyle, dashArray);
        });
    } else {
        if (vgap.map.isVisible(x, y, r)) drawSingleMapCrosshair(x, y, r, strokeStyle, dashArray);
    }
};

function drawSingleMapCrosshair (x, y, r, strokeStyle, dashArray) {
    drawScreenCrosshair(vgap.map.screenX(x), vgap.map.screenY(y), r * vgap.map.zoom, strokeStyle, dashArray);
}

function drawScreenCrosshair(x, y, r, strokeStyle, dashArray) {
    var ctx = vgap.map.ctx;

    ctx.strokeStyle = strokeStyle;
    var oldLineDash;
    if (dashArray) {
        oldLineDash = ctx.getLineDash();
        ctx.setLineDash(dashArray);
    }
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y-r);
    ctx.lineTo(x, y+r);
    ctx.stroke();
    ctx.moveTo(x-r, y);
    ctx.lineTo(x+r, y);
    ctx.stroke();
    if (dashArray) ctx.setLineDash(oldLineDash);
}

// Echo Cluster, fast lookup of nearby objects

mcntk.EchoCluster = function (objects) {
    var map = {};
    var binDim = 60;
    var binX = function(x) {
        return Math.floor(x / binDim);
    };
    var binY = function(y) {
        return Math.floor(y / binDim);
    };
    var binKey = function(bx, by) {
        return bx+","+by;
    };

    objects.forEach(function (o) {
        var key = binKey(binX(o.x), binX(o.y));
        if (!map[key]) map[key] = [];
        map[key].push(o);
    });

    var iterateOverObjectsWithinRange = function(x, y, r, fun) {
        var bx = binX(x);
        var by = binY(y);
        var r2 = r * r;
        var queue = [[bx, by]];
        while (queue.length > 0) {
            var xAndY = queue.shift();
            var keyX = xAndY[0];
            var keyY = xAndY[1];
            var key = binKey(keyX, keyY);

            var bin = map[key];
            if (bin) {
                bin.forEach(fun);
            }

            var leftX = keyX * binDim;
            var rightX = leftX + binDim - 1;
            var bottomY = keyY * binDim;
            var topY = bottomY + binDim - 1;

            if (keyX >= bx && keyY == by && dist2(x, y, rightX, y) < r2) queue.push([keyX+1, keyY]);
            if (keyX <= bx && keyY == by && dist2(x, y, leftX, y) < r2) queue.push([keyX-1, keyY]);
            if (keyX == bx && keyY >= by && dist2(x, y, x, topY) < r2) queue.push([keyX, keyY+1]);
            if (keyX == bx && keyY <= by && dist2(x, y, x, bottomY) < r2) queue.push([keyX, keyY-1]);

            if (keyX >= bx && keyY >= by && dist2(x, y, rightX, topY) < r2) queue.push([keyX+1, keyY+1]);
            if (keyX >= bx && keyY <= by && dist2(x, y, rightX, bottomY) < r2) queue.push([keyX+1, keyY-1]);
            if (keyX <= bx && keyY >= by && dist2(x, y, leftX, topY) < r2) queue.push([keyX-1, keyY+1]);
            if (keyX <= bx && keyY <= by && dist2(x, y, leftX, bottomY) < r2) queue.push([keyX-1, keyY-1]);
        }
    };

    var dist2 = function (x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        return (dx * dx) + (dy * dy);
    };

    this.findObjects = function(x, y, r) {
        var result = [];
        var r2 = r * r;
        iterateOverObjectsWithinRange(x, y, r, function (o) {
            if (dist2(x, y, o.x, o.y) <= r2) result.push(o);
        });
        return result;
    }

    this.findNearestSphereObjects = function(x, y, r) {
        var pt = mcntk.insideSphereMap(x, y);
        return this.findNearestObjects(pt.x, pt.y, r);
    }

    this.findNearestObjects = function(x, y, r) {
        var result = [];
        var r2 = r * r;
        iterateOverObjectsWithinRange(x, y, r, function (o) {
            if (result[0]) {
                if (o.x == result[0].x && o.y == result[0].y) result.push(o);
                else if (dist2(x, y, o.x, o.y) < dist2(x, y, result[0].x, result[0].y)) result = [o];
            } else {
                if (dist2(x, y, o.x, o.y) <= r2) result = [o];
            }
        });
        return result;
    };

    this.findNearestSphereObjectsInRectangle = function(x, y, dx, dy) {
        var pt = mcntk.insideSphereMap(x, y);
        return this.findNearestObjectsInRectangle(pt.x, pt.y, dx, dy);
    };

    this.findNearestObjectsInRectangle = function(x, y, dx, dy) {
        var nearestDistSq = 1234567890, nearestLoc = { x: 12345, y: 12345 };
        var result = [];
        var minX = x - dx,
            minY = y - dy,
            maxX = x + dx,
            maxY = y + dy;
        for (var i=binX(minX); i<=binX(maxX); i++) {
            for (var j=binY(minY); j<=binY(maxY); j++) {
                var found = map[binKey(i, j)];
                if (found) {
                    found.forEach(function(o) {
                        var dx = o.x - x,
                            dy = o.y - y;
                        var distSq = dx * dx + dy * dy;
                        if (o.x >= minX && o.x <= maxX && o.y >= minY && o.y <= maxY) {
                            if (o.x == nearestLoc.x && o.y == nearestLoc.y) {
                                result.push(o);
                            } else if (distSq < nearestDistSq) {
                                nearestDistSq = distSq;
                                nearestLoc = { x: o.x, y: o.y };
                                result = [o];
                            }
                        }
                    });
                }
            }
        }
        return result;
    };
}
var evasionDeltas = [
    [],
    [], // no special points for Warp 1
    [], // no special points for Warp 2
    // Warp 3
    [
        [[ 13, 14 ], [ 7, 7 ], [ 6, 6 ]] // 9.899494936611665
    ],
    // Warp 4
    [
        [[ 7, 16 ], [ 7, 15 ], [ 7, 14 ]], // 16.55294535724685
        [[ 10, 16 ], [ 9, 14 ], [ 8, 13 ]], // 16.64331697709324
        [[ 23, 24 ], [ 12, 12 ], [ 11, 11 ]] // 16.97056274847714
    ],
    // Warp 5
    [
        [[ 16, 20 ]], // 25.612496949731394 reached exactly
        [[ 13, 22 ]], // 25.553864678361276 reached exactly
        [[ 16, 23 ], [ 15, 21 ], [ 14, 20 ]], // 25.80697580112788
        [[ 9, 25 ], [ 9, 24 ], [ 9, 23 ]] // 25.632011235952593
    ],
    // Warp 6
    [
        [[ 22, 32 ], [ 21, 30 ], [ 20, 29 ]], // 36.61966684720111
        [[ 27, 32 ], [ 24, 28 ], [ 23, 27 ]], // 36.87817782917155
        [[ 30, 33 ], [ 25, 27 ], [ 24, 26 ]], // 36.796738985948195
        [[ 16, 34 ], [ 16, 33 ], [ 16, 32 ]], // 36.6742416417845
        [[ 21, 38 ], [ 18, 32 ], [ 17, 31 ]], // 36.71511950137164
        [[ 51, 52 ], [ 26, 26 ], [ 25, 25 ]] // 36.76955262170047
    ],
    // Warp 7
    [
        [[ 34, 36 ]], // 49.51767361255979 reached exactly
        [[ 33, 37 ]], // 49.57822102496216 reached exactly
        [[ 34, 41 ], [ 32, 38 ], [ 31, 37 ]], // 49.678969393496885
        [[ 33, 42 ], [ 31, 39 ], [ 30, 38 ]], // 49.8196748283246
        [[ 29, 43 ], [ 28, 41 ], [ 27, 40 ]], // 49.64876634922564
        [[ 21, 46 ], [ 21, 45 ], [ 21, 44 ]], // 49.658836071740545
        [[ 28, 49 ], [ 25, 43 ], [ 24, 42 ]], // 49.73932046178355
        [[ 29, 56 ], [ 23, 44 ], [ 22, 43 ]], // 49.64876634922564
        [[ 31, 94 ], [ 16, 47 ], [ 16, 46 ]] // 49.64876634922564
    ],
    // Warp 8
    [
        [[ 42, 49 ]], // 64.53681120105021 reached exactly
        [[ 43, 53 ], [ 41, 50 ], [ 40, 49 ]], // 64.66065264130884
        [[ 42, 54 ], [ 40, 51 ], [ 39, 50 ]], // 64.81512169239521
        [[ 38, 55 ], [ 37, 53 ], [ 36, 52 ]], // 64.63745044476924
        [[ 35, 57 ], [ 34, 55 ], [ 33, 54 ]], // 64.66065264130884
        [[ 21, 61 ]], // 64.51356446515724 reached exactly
        [[ 24, 61 ], [ 24, 60 ], [ 24, 59 ]], // 64.62197768561404
        [[ 18, 63 ], [ 18, 62 ], [ 18, 61 ]], // 64.5600495662759
        [[ 14, 64 ], [ 14, 63 ], [ 14, 62 ]], // 64.53681120105021
        [[ 91, 92 ], [ 46, 46 ], [ 45, 45 ]] // 65.05382386916237
    ],
    // Warp 9
    [
        [[ 16, 82 ], [ 16, 80 ], [ 16, 79 ]], // 81.58431221748455
        [[ 24, 79 ], [ 24, 78 ], [ 24, 77 ]], // 81.60882305241266
        [[ 27, 78 ], [ 27, 77 ], [ 27, 76 ]], // 81.59656855530139
        [[ 32, 75 ]], // 81.54140052758476 reached exactly
        [[ 33, 85 ], [ 30, 76 ], [ 30, 75 ]], // 81.70679286326198
        [[ 43, 72 ], [ 42, 70 ], [ 41, 69 ]], // 81.6333265278342
        [[ 45, 68 ]], // 81.54140052758476 reached exactly
        [[ 48, 66 ]], // 81.60882305241266 reached exactly
        [[ 50, 72 ], [ 47, 67 ], [ 46, 66 ]], // 81.8413098624405
        [[ 53, 62 ]], // 81.5659242576212 reached exactly
        [[ 53, 67 ], [ 51, 64 ], [ 50, 63 ]], // 81.83520025025906
        [[ 53, 84 ], [ 44, 69 ], [ 43, 68 ]], // 81.83520025025906
        [[ 54, 66 ], [ 52, 63 ], [ 51, 62 ]], // 81.68843247363729
        [[113,118 ], [ 57, 59 ], [ 56, 58 ]], // 82.03657720797473
        [[115,116 ], [ 58, 58 ], [ 57, 57 ]] // 82.02438661763951
    ]
];

var gravitonicEvasionDeltas = [
    [],
    [],  // no special points for gravitonic Warp 1
    [],  // no special points for gravitonic Warp 2
    // Warp  3
    [
        [[ 11 , 15 ]], // 18.601075237738275 reached exactly
    ],
    // Warp  4
    [
        [[ 23 , 23 ]], // 32.526911934581186 reached exactly
        [[ 22 , 24 ]], // 32.55764119219941 reached exactly
        [[ 21 , 25 ]], // 32.64965543462902 reached exactly
        [[ 21 , 28 ], [ 20 , 26 ], [ 19 , 25 ]], // 32.802438933713454
        [[ 15 , 30 ], [ 15 , 29 ], [ 14 , 28 ]], // 32.64965543462902
        [[ 13 , 31 ], [ 13 , 30 ], [ 13 , 29 ]], // 32.69556544854363
        [[ 10 , 32 ], [ 10 , 31 ], [ 10 , 30 ]], // 32.57299494980466
        [[ 19 , 32 ], [ 17 , 28 ], [ 16 , 27 ]], // 32.7566787083184
        [[ 6 , 34 ], [ 6 , 32 ], [ 6 , 31 ]], // 32.55764119219941
    ],
    // Warp  5
    [
        [[ 31 , 40 ]], // 50.60632371551998 reached exactly
        [[ 31 , 43 ], [ 30 , 41 ], [ 29 , 40 ]], // 50.80354318352215
        [[ 23 , 45 ]], // 50.53711507397311 reached exactly
        [[ 42 , 45 ], [ 35 , 37 ], [ 34 , 36 ]], // 50.93132631298737
        [[ 26 , 46 ], [ 25 , 44 ], [ 24 , 43 ]], // 50.60632371551998
        [[ 21 , 47 ], [ 21 , 46 ], [ 21 , 45 ]], // 50.566787519082126
        [[ 29 , 47 ], [ 27 , 43 ], [ 26 , 42 ]], // 50.774009099144415
        [[ 16 , 49 ], [ 16 , 48 ], [ 16 , 47 ]], // 50.59644256269407
        [[ 26 , 66 ], [ 19 , 47 ], [ 19 , 46 ]], // 50.695167422546305
        [[ 71 , 72 ], [ 36 , 36 ], [ 35 , 35 ]], // 50.91168824543142
        [[ 67 , 76 ], [ 34 , 38 ], [ 33 , 37 ]], // 50.99019513592785
    ],
    // Warp  6
    [
        [[ 45 , 57 ]], // 72.62231062146122 reached exactly
        [[ 53 , 59 ], [ 49 , 54 ], [ 48 , 53 ]], // 72.91776189653656
        [[ 45 , 60 ], [ 44 , 58 ], [ 43 , 57 ]], // 72.80109889280519
        [[ 57 , 61 ], [ 50 , 53 ], [ 49 , 52 ]], // 72.86288492778748
        [[ 42 , 62 ], [ 41 , 60 ], [ 40 , 59 ]], // 72.67048919609665
        [[ 36 , 63 ]], // 72.56031973468694 reached exactly
        [[ 40 , 66 ], [ 38 , 62 ], [ 37 , 61 ]], // 72.71863585079137
        [[ 28 , 68 ], [ 28 , 67 ], [ 28 , 66 ]], // 72.61542535852834
        [[ 68 , 70 ], [ 51 , 52 ], [ 50 , 51 ]], // 72.83543093852057
        [[ 19 , 71 ], [ 19 , 70 ], [ 19 , 69 ]], // 72.53275122315436
        [[ 15 , 73 ], [ 15 , 71 ], [ 15 , 70 ]], // 72.56721022610694
        [[ 9 , 76 ], [ 9 , 72 ], [ 9 , 71 ]], // 72.56031973468694
    ],
    // Warp  7
    [
        [[ 64 , 75 ]], // 98.59513172565875 reached exactly
        [[ 59 , 79 ]], // 98.60020283954795 reached exactly
        [[ 65 , 79 ], [ 63 , 76 ], [ 62 , 75 ]], // 98.71676655968832
        [[ 64 , 80 ], [ 62 , 77 ], [ 61 , 76 ]], // 98.85848471426213
        [[ 59 , 82 ], [ 58 , 80 ], [ 57 , 79 ]], // 98.812954616285
        [[ 56 , 84 ], [ 55 , 82 ], [ 54 , 81 ]], // 98.73702446397704
        [[ 83 , 86 ], [ 69 , 71 ], [ 68 , 70 ]], // 99.00505037623081
        [[ 51 , 87 ], [ 50 , 85 ], [ 49 , 84 ]], // 98.6154146165801
        [[ 54 , 88 ], [ 52 , 84 ], [ 51 , 83 ]], // 98.79271228182775
        [[ 38 , 92 ], [ 38 , 91 ], [ 38 , 90 ]], // 98.6154146165801
        [[ 10 , 99 ], [ 10 , 98 ], [ 10 , 97 ]], // 98.50888284819801
        [[ 36 , 103 ], [ 33 , 93 ], [ 33 , 92 ]], // 98.68130522039117
        [[ 43 , 137 ], [ 30 , 94 ], [ 30 , 93 ]], // 98.67117106835208
        [[ 139 , 140 ], [ 70 , 70 ], [ 69 , 69 ]], // 98.99494936611666
    ],
    // Warp  8
    [
        [[ 91 , 91 ]], // 128.69343417595164 reached exactly
        [[ 82 , 99 ]], // 128.5496013218244 reached exactly
        [[ 88 , 101 ], [ 85 , 97 ], [ 84 , 96 ]], // 128.9728653632228
        [[ 90 , 101 ], [ 86 , 96 ], [ 85 , 95 ]], // 128.8875478857442
        [[ 92 , 101 ], [ 87 , 95 ], [ 86 , 94 ]], // 128.81770064707723
        [[ 95 , 102 ], [ 88 , 94 ], [ 87 , 93 ]], // 128.76334882255898
        [[ 77 , 103 ]], // 128.6001555209013 reached exactly
        [[ 83 , 103 ], [ 81 , 100 ], [ 80 , 99 ]], // 128.68954891520912
        [[ 82 , 104 ], [ 80 , 101 ], [ 79 , 100 ]], // 128.84486796143648
        [[ 99 , 104 ], [ 89 , 93 ], [ 88 , 92 ]], // 128.7245120402482
        [[ 77 , 106 ], [ 76 , 104 ], [ 75 , 103 ]], // 128.80993750483694
        [[ 74 , 108 ], [ 73 , 106 ], [ 72 , 105 ]], // 128.70508925446578
        [[ 71 , 110 ], [ 70 , 108 ], [ 69 , 107 ]], // 128.70120434556935
        [[ 108 , 111 ], [ 90 , 92 ], [ 89 , 91 ]], // 128.70120434556935
        [[ 63 , 112 ]], // 128.50291825480073 reached exactly
        [[ 66 , 113 ], [ 65 , 111 ], [ 64 , 110 ]], // 128.63125592172378
        [[ 69 , 114 ], [ 67 , 110 ], [ 66 , 109 ]], // 128.79829191413992
        [[ 51 , 119 ], [ 51 , 118 ], [ 51 , 117 ]], // 128.5496013218244
        [[ 46 , 120 ]], // 128.51459061133875 reached exactly
        [[ 49 , 120 ], [ 49 , 119 ], [ 49 , 118 ]], // 128.69343417595164
        [[ 34 , 125 ], [ 34 , 124 ], [ 34 , 123 ]], // 128.57682528356344
        [[ 30 , 126 ], [ 30 , 125 ], [ 30 , 124 ]], // 128.5496013218244
        [[ 20 , 130 ], [ 20 , 127 ], [ 20 , 126 ]], // 128.56515857727553
    ],
    // Warp  9
    [
        [[ 115 , 115 ]], // 162.63455967290594 reached exactly
        [[ 114 , 116 ]], // 162.64070831129578 reached exactly
        [[ 113 , 117 ]], // 162.65915283192643 reached exactly
        [[ 104 , 125 ]], // 162.60688792299052 reached exactly
        [[ 113 , 126 ], [ 109 , 121 ], [ 108 , 120 ]], // 162.85576440519384
        [[ 115 , 126 ], [ 110 , 120 ], [ 109 , 119 ]], // 162.78820596099706
        [[ 117 , 126 ], [ 111 , 119 ], [ 110 , 118 ]], // 162.73291000900832
        [[ 112 , 127 ], [ 108 , 122 ], [ 107 , 121 ]], // 162.9355700883021
        [[ 121 , 128 ], [ 112 , 118 ], [ 111 , 117 ]], // 162.68988905276197
        [[ 99 , 129 ]], // 162.60996279441184 reached exactly
        [[ 105 , 129 ], [ 103 , 126 ], [ 102 , 125 ]], // 162.74212730574712
        [[ 104 , 130 ], [ 102 , 127 ], [ 101 , 126 ]], // 162.88953311984167
        [[ 99 , 132 ], [ 98 , 130 ], [ 97 , 129 ]], // 162.80049139974977
        [[ 92 , 134 ]], // 162.5423021862309 reached exactly
        [[ 96 , 134 ], [ 95 , 132 ], [ 94 , 131 ]], // 162.63148526653748
        [[ 89 , 136 ]], // 162.53307355735325 reached exactly
        [[ 87 , 140 ], [ 86 , 138 ], [ 85 , 137 ]], // 162.60381299342276
        [[ 82 , 143 ], [ 81 , 141 ], [ 80 , 140 ]], // 162.60996279441184
        [[ 96 , 143 ], [ 91 , 135 ], [ 90 , 134 ]], // 162.8066337714775
        [[ 85 , 144 ], [ 83 , 140 ], [ 82 , 139 ]], // 162.75441622272496
        [[ 92 , 144 ], [ 88 , 137 ], [ 87 , 136 ]], // 162.82813024781683
        [[ 102 , 145 ], [ 94 , 133 ], [ 93 , 132 ]], // 162.8649747490233
        [[ 65 , 150 ], [ 65 , 149 ], [ 65 , 148 ]], // 162.5607578722491
        [[ 63 , 151 ], [ 63 , 150 ], [ 63 , 149 ]], // 162.69296235547498
        [[ 55 , 154 ], [ 55 , 153 ], [ 55 , 152 ]], // 162.58536219475602
        [[ 52 , 155 ], [ 52 , 154 ], [ 52 , 153 ]], // 162.5423021862309
        [[ 49 , 156 ], [ 49 , 155 ], [ 49 , 154 ]], // 162.5607578722491
        [[ 38 , 158 ]], // 162.50538452617502 reached exactly
        [[ 42 , 158 ], [ 42 , 157 ], [ 42 , 156 ]], // 162.5207679036744
        [[ 34 , 161 ], [ 34 , 159 ], [ 34 , 158 ]], // 162.5945878558078
        [[ 47 , 161 ], [ 46 , 156 ], [ 46 , 155 ]], // 162.64070831129578
        [[ 13 , 166 ], [ 13 , 162 ], [ 13 , 161 ]], // 162.5207679036744
        [[ 64 , 169 ], [ 58 , 152 ], [ 58 , 151 ]], // 162.68988905276197
    ],
];

mcntk.forAllEvasionDeltas = function(ship, center, fun) {
    var allDeltas = mcntk.isGravitonic(ship) ? gravitonicEvasionDeltas : evasionDeltas;
    var deltas = allDeltas[ship.warp];
    [false, true].forEach(function(mirrorDiag) {
        [false, true].forEach(function(mirrorVert) {
            [false, true].forEach(function(mirrorHor) {
                deltas.forEach(function(delta) {
                    var aimDelta = evasionDxDy(delta[0], mirrorDiag, mirrorVert, mirrorHor);
                    var aimLoc = evasionLocation(center, aimDelta);
                    var arriveDelta = delta[1] ? evasionDxDy(delta[1], mirrorDiag, mirrorVert, mirrorHor) : null;
                    var arriveLoc = delta[1] ? evasionLocation(center, arriveDelta) : null;
                    var interceptorDelta = delta[2] ? evasionDxDy(delta[2], mirrorDiag, mirrorVert, mirrorHor) : null;
                    var interceptorLoc = delta[2] ? evasionLocation(center, interceptorDelta) : null;
                    fun(aimLoc, arriveLoc, interceptorLoc);
                });
            });
        });
    });
};

var evasionDxDy = function(delta, mirrorDiag, mirrorVert, mirrorHor) {
    var dx = delta[0],
        dy = delta[1];
    if (mirrorDiag) {
        var e = dx;
        dx = dy;
        dy = e;
    }
    if (mirrorVert) dy = -dy;
    if (mirrorHor) dx = -dx;
    return { dx: dx, dy: dy };
};

var evasionLocation = function(location, dxDy) {
    return { x: location.x + dxDy.dx, y: location.y + dxDy.dy };
};

// Hostrun

var cloneObject = function(object) {
    return { ...object };  // this is faster than Object.assign({}, object);
};

var overrideLoadNowForHostRun = () => {
    var loadNow_wrappedByMcNTk = vgaPlanets.prototype.loadNow;
    vgaPlanets.prototype.loadNow = function() {
        for (var i=vgap.nowTurn+1; ; i++) {  // infinite loop!
            var key = vgap.getCacheKey(i);
            if (vgap.rst[key]) {
                delete vgap.rst[key];
            } else {
                // There cannot be gaps, so no more future RSTs
                // Do what we need to do...
                loadNow_wrappedByMcNTk.apply(this, []);
                // ...and exit infinite loop
                return;
            }
        }
    }
};

mcntk.host = {
    simulateAndShowInClient: function() {
        // We're not going to show any reports, so pass a function that ignores them
        var nextTurnRst = mcntk.host.simulate(vgap, function(report) {});

        // add things that NU needs
        nextTurnRst.settings = cloneObject(vgap.settings);
        nextTurnRst.settings.turn += 1;
        nextTurnRst.player = vgap.player;
        nextTurnRst.players = vgap.players;
        nextTurnRst.races = vgap.races;
        nextTurnRst.ionstorms = vgap.ionstorms;  // Will be provided by simulated host at some point!
        nextTurnRst.stars = vgap.stars;
        nextTurnRst.nebulas = vgap.nebulas;
        nextTurnRst.wormholes = vgap.wormholes;
        nextTurnRst.artifacts = vgap.artifacts;
        nextTurnRst.engines = vgap.engines;
        nextTurnRst.hulls = vgap.hulls;
        nextTurnRst.beams = vgap.beams;
        nextTurnRst.torpedos = vgap.torpedos;
        nextTurnRst.notes = vgap.notes;
        nextTurnRst.game = cloneObject(vgap.game);
        nextTurnRst.game.turn += 1;  // I hate duplication; settings.turn is *wrong*
        nextTurnRst.relations = vgap.relations;
        nextTurnRst.messages = [];
        nextTurnRst.mymessages = [];
        nextTurnRst.maps = [];  // No idea what these are...
        nextTurnRst.vcrs = [];
        nextTurnRst.scores = vgap.scores;
        nextTurnRst.advantages = vgap.advantages;
        nextTurnRst.racehulls = vgap.racehulls;
        nextTurnRst.activebadges = vgap.activebadges;
        nextTurnRst.badgechange = vgap.badgechange;
        nextTurnRst.cutscenes = vgap.cutscenes;

        // wrap in a 'server result' to fool the NU client code
        var result = { success: true, rst: nextTurnRst, accountsettings: vgap.accountsettings, ispremium: vgap.player.isregistered };  // no savekey
        vgap.cacheRST(nextTurnRst.settings.turn, result);
        vgap.loadHistory(nextTurnRst.settings.turn);
    },

    simulate: function(rst, reporter) {
        console.log("Simulating T", rst.game.turn+1, "from T", rst.game.turn);

        var planets = rst.planets.filter(pl => pl.id > 0).map(cloneObject);
        planets.forEach(pl => pl.infoturn += 1);

        var planetsById = [];
        planets.forEach(pl => planetsById[pl.id] = pl);

        var starbases = rst.starbases.map(cloneObject);
        // No need to look up starbases by id (or planetid), for now

        var ships = rst.ships.filter(sh => sh.id > 0).map(cloneObject);
        ships.forEach(sh => {
            sh.waypoints = sh.waypoints.map(cloneObject);
            sh.history = sh.history.map(cloneObject);
        });
        var shipsById = [];
        ships.forEach(sh => shipsById[sh.id] = sh);

        var stock = rst.stock.map(cloneObject);
        var stockById = [];
        stockById.maxStockId = 0;
        stock.forEach(function(item) {
            var sb = stockById[item.starbaseid];
            if (!sb) stockById[item.starbaseid] = sb = [];
            var type = sb[item.stocktype];
            if (!type) sb[item.stocktype] = type = []
            type[item.stockid] = item;
        });

        var minefields = vgap.minefields.filter(mf => mf.id > 0).map(cloneObject);
        minefields.forEach(mf => mf.infoturn += 1);

        var nextTurnRst = {
            planets: planets,
            planetsById: planetsById,
            starbases: starbases,
            planetsEchoCluster: new mcntk.EchoCluster(planets),
            ships: ships,
            shipsById: shipsById,
            stock: stock,
            stockById: stockById,
            minefields: minefields
        };
        mcntk.host.steps.forEach(step => mcntk.host[step](nextTurnRst, reporter));
        return nextTurnRst;
    },

    steps: [
        "preHost",  // decloak all ships
        // client side actions (includes jettison! which does require fuel)
        "buildStarbases",
        // Lock tow beam [uninteresting]
        "cloak",  // Cloak and Chameleon (is this when fuel is spent?)
        // Meteor Showers [unpredictable]
        // Sensor sweep [unpredictable]
        // Loki Decloak
        // Cloak fail (nebulas and such)
        // Super Spy [unpredictable]
        // minefield FCs established [uninteresting]
        "gamblingShips",  // Lady Royale
        // Most missions 9 (incl LFM)
        "dropCargo",  // ship to foreign planet, includes ground combat and IA
        // Transfer (ship to foreign ship)
        // Beam transfer codes (BTT, BTF, includes GSX)
        // Planets BUM
        // Beam up Missions
        "alchemy",
        // Command ships
        // Selenites push/pull webs
        // Lay (web) mines
        // Ion storms move, then act (changes unpredictable; otherwise interesting)
        // Mine sweep
        "mineDecay",
        // Mines destroy mines
        // minefield FCs established
        // web drain
        // SB fix and recycle
        "firstShipBuild",  // advanced cloning, priority builds, normal builds, cloning
        "superRefit",
        // Force Surrender
        "repairAndMKT",  // apparently the first run 'includes' imperial fighter transfer
        "movement", // tow, normal (incl HYP), Tantrum, intercept
        // NU replay code has additional Nebula decloak here
        // star cluster kills for non moving ships, order says capture of ghost ships happens here, last, but I suppose that simply means crew death happens before tow capture check (tow has to complete? no running out of fuel, mine hits or such?)
        // wormholes
        // Glory Devices
        // Chunnel
        // Loki Decloak
        // Lorean Temporal Lance
        // Starbase Primary orders
        "freeFighters",  // EE
        // SB 'dmp'
        // "repairAndMKT",
        // new natives
        // Land and Disassemble
        // Loki decloak
        // Glory Devices
        // "repairAndMKT",  // this makes sense after GDs are simulated!
        // Ship vs Ship Combat [unpredictable]
        // Borg gather debris [unpredictable]
        // Gorbie destroy planet [unpredictable]
        // "repairAndMKT",
        // Ship vs Planet Combat [unpredictable]
        // minefield FC codes established [uninteresting]

        // Terraforming
        // Structure Decay
        // Pillage
        // RGA
        // happiness changes
        "produceSupplies",
        "levyingTaxes",
        // assimilate
        // Population grows
        // Overpop dies
        // Amorphous feast
        // Riots
        // Civil Wars
        "condenseOre",
        "produceMinerals",
        // Trans-uranium mutation
        // 2nd ShipBuild [unpredictable] - priority builds for classic queue, normal builds for all queues (but PLS?)
        // "repairAndMKT"
        // auto build to targets
        // Scan incl Super Spy, Empire Dark Detetction [unpredictable]
        // end-of-hostrun [uninteresting]
        "cleanUpClientStuff"  // various cached fields from the client that are not set in vgap.processLoad
    ],


    ////
    // Host steps
    ////

    preHost: function(rst) {
        rst.ships.forEach(mcntk.host.preHostShip);
    },

    buildStarbases: function(rst) {
        rst.planets.forEach(function(planet) {
            mcntk.host.buildStarbase(planet, rst.starbases);
        });
    },

    cloak: function(rst) {
        rst.ships.forEach(mcntk.host.cloakShip);
    },

    gamblingShips: function(rst) {
        rst.ships.forEach(function(ship) {
            mcntk.host.gamblingShip(ship)
        });
    },

    dropCargo: function(rst) {
        rst.ships.forEach(function(ship) {
            mcntk.host.dropCargoShip(ship, rst.planetsEchoCluster)
        });
    },

    alchemy: function(rst) {
        rst.ships.forEach(mcntk.host.alchemyShip);
    },

    mineDecay: function(rst) {
        rst.minefields.forEach(mcntk.host.minefieldDecay);
    },

    firstShipBuild: function(rst) {
        rst.starbases.forEach(function(sb) {
            mcntk.host.buildShip(sb, rst.ships, rst.shipsById, rst.planetsById, rst.stockById);
        });
    },

    superRefit: function(rst, reporter) {
        rst.ships.forEach(function(ship) {
            mcntk.host.superRefitShip(ship, rst.starbases, rst.stockById, rst.planetsEchoCluster, reporter);
        });
    },

    // Preceded by a 'mass check', but what does that mean for this emulation?
    repairAndMKT: function(rst) {
        // repair uses supplies, mkt uses DTM and MC - steps are independent
        rst.ships.forEach(mcntk.host.repairShip);
        rst.ships.forEach(mcntk.host.mkt);
    },

    movement: function(rst) {
        rst.ships.forEach(function(ship) {
            mcntk.host.tow(ship, rst.shipsById, rst.planetsEchoCluster);
        });
        rst.ships.forEach(function(ship) {
            mcntk.host.normalMovement(ship, rst.shipsById, rst.planetsEchoCluster);
        });
        rst.ships.forEach(function(ship) {
            mcntk.host.intercept(ship, rst.shipsById, rst.planetsEchoCluster);
        });
    },

    freeFighters: function(rst) {
        rst.starbases.forEach(function(sb) {
            mcntk.host.produceFreeFighters(sb, rst.planetsById);
        });
    },

    produceSupplies: function(rst) {
        rst.planets.forEach(mcntk.host.produceSuppliesAtPlanet);
    },

    levyingTaxes: function(rst) {
        rst.planets.forEach(mcntk.host.tax);
    },

    condenseOre: function(rst) {
        rst.ships.forEach(function(ship) {
            mcntk.host.condenseOreShip(ship, rst.planetsEchoCluster);
        })
    },

    produceMinerals: function(rst) {
        rst.planets.forEach(mcntk.host.produceMineralsAt);
    },

    cleanUpClientStuff: function(rst) {
        rst.planets.forEach(mcntk.host.cleanUpPlanet);
        rst.starbases.forEach(mcntk.host.cleanUpStarbase);
        rst.ships.forEach(mcntk.host.cleanUpShip);
    },

    ////
    // Implementation
    ////

    preHostShip: (ship) => {
        ship.iscloaked = false;
        ship.isNewlyBuilt = false;
    },

    buildStarbase: function(planet, starbases) {
        if (planet.buildingstarbase) {
            var ids = starbases.map(function(sb) { return sb.id; })
            var maxId = Math.max.apply(0, ids);
            var starbase = {
                id: maxId + 1,
                starbasetype: 0,
                ownerid: planet.ownerid,
                planetid: planet.id,

                hulltechlevel: planet.nativeclans > 0 && planet.nativetype == 1 ? 10 : 1,
                hulltechup: 0,
                enginetechlevel: planet.nativeclans > 0 && planet.nativetype == 8 ? 10 : 1,
                enginetechup: 0,
                beamtechlevel: planet.nativeclans > 0 && planet.nativetype == 7 ? 10 : 1,
                beamtechup: 0,
                torptechlevel: planet.nativeclans > 0 && planet.nativetype == 9 ? 10 : 1,
                torptechup: 0,

                isbuilding: false,
                buildhullid: 0,
                buildengineid: 0,
                buildbeamid: 0,
                buildbeamcount: 0,
                buildtorpedoid: 0,
                buildtorpcount: 0,

                damage: 0,
                defense: 0,
                builtdefense: 0,
                fighters: 0,
                builtfighters: 0,

                mission: 0,  // primary orders

                shipmission: 0,  // fix/rec
                targetshipid: 0
            };
            starbases.push(starbase);

            planet.buildingstarbase = false;
            planet.hasbase = true;

            // the client will create all stock entries that we need for the next host simulation
        }
    },

    cloakShip: (ship) => {
        // note: RecloakIntercept cloaks later, without fuel cost
        if (!(mcntk.attemptsToCloak(ship) || mcntk.doesCloakAndIntercept(ship))) return;
        if (ship.damage > 0) return;

        if (mcntk.canAdvancedCloak(ship)) {
            if (ship.neutronium == 0) return;
        } else {
            var hull = vgap.getHull(ship.hullid);
            var needsNeutronium = Math.max(5, Math.floor(hull.mass / 20));
            if (ship.neutronium < needsNeutronium) return;

            ship.neutronium -= needsNeutronium;
        }
        ship.iscloaked = true;
    },

    gamblingShip: function(ship) {
        if (ship.hullid == 42 && ship.neutronium > 0) ship.megacredits += ship.clans;
    },

    dropCargoShip: function(ship, planetsEchoCluster) {
        if (ship.transfertargettype == 1 && ship.transfertargetid > 0) {
            var planets = planetsEchoCluster.findNearestObjects(ship.x, ship.y, 0);
            if (planets.length > 1) {
                console.log("dropCargoShip: more than 1 planet!", ship, planets);
                return;
            }
            if (planets.length < 1) {
                console.log("dropCargoShip: No planets, probably during replay", ship, planets);
                return;
            }
            var planet = planets[0];
            // for a planet, the ship.transfertargetid is irrelevant

            var drop = function(what) {
                planet[what] = planet[what] >= 0 ? planet[what] + ship["transfer"+what] : ship["transfer"+what];
                ship["transfer"+what] = 0;
            }

            if (ship.transferclans > 0) {
                if (planet.ownerid == 0) {
                    drop("clans");
                    planet.ownerid = ship.ownerid;
                    planet.colonisthappypoints = 100;
                    if (planet.mines == -1) planet.mines = 0;
                    if (planet.factories == -1) planet.factories = 0;
                    if (planet.defense == -1) planet.defense = 0;
                    if (planet.neutronium == -1) planet.neutronium = 0;
                    if (planet.duranium == -1) planet.duranium = 0;
                    if (planet.tritanium == -1) planet.tritanium = 0;
                    if (planet.molybdenum == -1) planet.molybdenum = 0;
                    if (planet.densityneutronium == -1) planet.densityneutronium = 0;
                    if (planet.densityduranium == -1) planet.densityduranium = 0;
                    if (planet.densitytritanium == -1) planet.densitytritanium = 0;
                    if (planet.densitymolybdenum == -1) planet.densitymolybdenum = 0;
                    if (planet.groundneutronium == -1) planet.groundneutronium = 0;
                    if (planet.groundduranium == -1) planet.groundduranium = 0;
                    if (planet.groundtritanium == -1) planet.groundtritanium = 0;
                    if (planet.groundmolybdenum == -1) planet.groundmolybdenum = 0;
                    if (planet.supplies == -1) planet.supplies = 0;
                    if (planet.clans == -1) planet.clans = 0;
                } else {
                    // Ground combat!
                }
            }

            drop("neutronium");
            drop("duranium");
            drop("tritanium");
            drop("molybdenum");
            drop("supplies");

            if (vgap.settings.directtransfermc) {
                drop("megacredits");
            } else {
                ship.megacredits += ship.transfermegacredits;
                ship.transfermegacredits = 0;
            }

            if (!vgap.settings.directtransferammo) ship.ammo += ship.transferammo;  // lost!
            ship.transferammo = 0;

            ship.transfertargettype = 0;  // or the subsequent hostrun may fail when the ship is in deep space!
        }
    },

    alchemyShip: function(ship) {
        var fc = ship.friendlycode.toLowerCase();

        if (fc == 'nal') return;

        switch (ship.hullid) {
        case 104: // Neutronic Refinery
            var fuelTank = vgap.getHull(104).fueltank;
            var convert = function(mineral) {
                var converted = Math.min(fuelTank-ship.neutronium, ship.supplies, ship[mineral]);
                ship.neutronium += converted;
                ship[mineral] -= converted;
                ship.supplies -= converted;
            }

            convert("duranium");
            convert("molybdenum");
            convert("tritanium");

            break;

        case 105: // Merlin
            if (vgap.settings.fcodesextraalchemy) {
                var convertEachMineral = Math.floor(ship.supplies / 6);
                if (fc == 'nad') {
                    ship.supplies -= convertEachMineral * 6;
                    ship.tritanium += convertEachMineral;
                    ship.molybdenum += convertEachMineral;
                    break;
                } else if (fc == 'nat') {
                    ship.supplies -= convertEachMineral * 6;
                    ship.duranium += convertEachMineral;
                    ship.molybdenum += convertEachMineral;
                    break;
                } else if (fc == 'nam') {
                    ship.supplies -= convertEachMineral * 6;
                    ship.duranium += convertEachMineral;
                    ship.tritanium += convertEachMineral;
                    break;
                }
            }

            var convertEachMineral = Math.floor(ship.supplies / 9);
            ship.supplies -= convertEachMineral * 9;
            if (fc == 'ald') {
                ship.duranium += convertEachMineral * 3;
            } else if (fc == 'alt') {
                ship.tritanium += convertEachMineral * 3;
            } else if (fc == 'alm') {
                ship.molybdenum += convertEachMineral * 3;
            } else {
                ship.duranium += convertEachMineral;
                ship.tritanium += convertEachMineral;
                ship.molybdenum += convertEachMineral;
            }
            break;

        default:
            // Most ships cannot perform this feat
            break;
        }
    },

    minefieldDecay: function(minefield) {

    },

    buildShip: function(sb, ships, shipsById, planetsById, stockById) {
        // iff ship limit not reached (switch between systems and crap like that)
        if (sb.isbuilding) {
            var hull = vgap.getHull(sb.buildhullid);
            var planet = planetsById[sb.planetid];
            var ship = {
                id: shipsById.length,
                name: hull.name,
                ownerid: planetsById[sb.planetid].ownerid,
                isNewlyBuilt: true,

                hullid: sb.buildhullid,
                engineid: sb.buildengineid,
                beamid: sb.buildbeamid,
                beams: sb.buildbeamid > 0 ? sb.buildbeamcount : 0,
                torpedoid: sb.buildtorpedoid,
                torps: sb.buildtorpedoid > 0 ? sb.buildtorpcount : 0,
                bays: hull.fighterbays,
                crew: hull.crew,
                mass: hull.mass,

                neutronium: 0,
                duranium: 0,
                tritanium: 0,
                molybdenum: 0,
                clans: 0,
                supplies: 0,
                megacredits: 0,
                ammo: 0,

                transferammo: 0,
                transferclans: 0,
                transferduranium: 0,
                transfermegacredits: 0,
                transfermolybdenum: 0,
                transferneutronium: 0,
                transfersupplies: 0,
                transfertargetid: 0,
                transfertargettype: 0,
                transfertritanium: 0,

                mission: 0,  mission1target: 0,  mission2target: 0,
                enemy: 0,
                damage: 0,
                experience: 0,
                friendlycode: "new", // random...

                iscloaked: false,
                readystatus: 0,

                x: planet.x,  y: planet.y,
                targetx: planet.x,  targety: planet.y,
                waypoints: [],
                history: [],
                warp: 0,
                heading: 0
            }

            shipsById.push(ship);
            ships.push(ship);

            sb.isbuilding = false;
            var hullStock = mcntk.host.getStock(stockById, sb.id, 1, sb.buildhullid);
            hullStock.amount -= 1;
            hullStock.builtamount = 0;
            sb.buildhullid = 0;
            var engineStock = mcntk.host.getStock(stockById, sb.id, 2, sb.buildengineid);
            engineStock.amount -= hull.engines;
            engineStock.builtamount = 0;
            sb.buildengineid = 0;
            if (sb.buildbeamid > 0) {
                var beamStock = mcntk.host.getStock(stockById, sb.id, 3, sb.buildbeamid);
                beamStock.amount -= sb.buildbeamcount;
                beamStock.builtamount = 0;
                sb.buildbeamid = 0;
                sb.buildbeamcount = 0;
            }
            if (sb.buildtorpedoid > 0) {
                var torpStock = mcntk.host.getStock(stockById, sb.id, 4, sb.buildtorpedoid);
                torpStock.amount -= sb.buildtorpcount;
                torpStock.builtamount = 0;
                sb.buildtorpedoid = 0;
                sb.buildtorpcount = 0;
            }
        }
    },

    superRefitShip: function(ship, starbases, stockById, planetsEchoCluster, reporter) {
        if (ship.ownerid == 0) return;
        if (!mcntk.ownedByFeds(ship)) return;
        if (ship.mission != 8) return;

        var planets = planetsEchoCluster.findNearestObjects(ship.x, ship.y, 0);
        if (planets.length != 1) {
            reporter({object: ship, type: "superrefit", nothingrefitted: true});
            return;
        }

        var planet = planets[0];
        if (planet.ownerid != ship.ownerid) {
            reporter({object: ship, type: "superrefit", nothingrefitted: true});
            return;
        }

        var getStarbase = function(planetId) {
            return starbases.filter(function(base) { return base.planetid == planetId; })[0];
        }
        var starbase = getStarbase(planet.id);
        if (!starbase) {
            reporter({object: ship, type: "superrefit", nothingrefitted: true});
            return;
        }

        var hull = vgap.getHull(ship.hullid);

        var EngineStockType = 2;
        var BeamStockType = 3;
        var LauncherStockType = 4;
        var TorpedoStockType = 5;

        var upgraded = { object: ship };

        var enginesToTakeOut = mcntk.host.getStock(stockById, starbase.id, EngineStockType, ship.engineid);
        var engineId = 9;
        while (engineId > ship.engineid) {
            var enginesToFit = mcntk.host.getStock(stockById, starbase.id, EngineStockType, engineId);
            var enginesAvailable = enginesToFit.amount;
            if (starbase.isbuilding && starbase.buildengineid == engineId) {
                var buildHull = vgap.getHull(starbase.buildhullid);
                enginesAvailable -= buildHull.engines;
            }
            if (enginesAvailable >= hull.engines) {
                enginesToTakeOut.amount += hull.engines;
                ship.engineid = engineId;
                enginesToFit.amount -= hull.engines;
                upgraded.engines = true;
                upgraded.engineId = engineId;
            }
            engineId--;
        }

        var beamsForHull = hull.beams;
        if (beamsForHull > 0) {
            var oldBeamId = ship.beamid;
            var oldBeams = ship.beams;
            var beamsToTakeOut = mcntk.host.getStock(stockById, starbase.id, BeamStockType, ship.beamid);
            beamsToTakeOut.amount += ship.beams;
            ship.beams = 0;
            ship.beamid = 0;

            var beamId = 10;
            while (beamId > ship.beamid) {
                var beamsToFit = mcntk.host.getStock(stockById, starbase.id, BeamStockType, beamId);
                var beamsAvailable = beamsToFit.amount;
                if (starbase.isbuilding && starbase.buildbeamid == beamId) beamsAvailable -= starbase.buildbeamcount;
                if (beamsAvailable >= beamsForHull) {
                    ship.beamid = beamId;
                    ship.beams = beamsForHull;
                    beamsToFit.amount -= beamsForHull;
                }
                beamId--;
            }

            if (ship.beamid != oldBeamId || ship.beams != oldBeams) {
                upgraded.beams = true;
                upgraded.beamId = ship.beamid;
            }
        }

        var launchersForHull = hull.launchers;
        if (launchersForHull > 0) {
            var oldLauncherId = ship.torpedoid;
            var oldLaunchers = ship.torps;
            var oldAmmo = ship.ammo;
            var launchersToTakeOut = mcntk.host.getStock(stockById, starbase.id, LauncherStockType, ship.torpedoid)
            var torpsToTakeOut = mcntk.host.getStock(stockById, starbase.id, TorpedoStockType, ship.torpedoid)
            launchersToTakeOut.amount += ship.torps;
            ship.torpedoid = 0;
            ship.torps = 0;
            torpsToTakeOut.amount += ship.ammo;
            ship.ammo = 0;

            var launcherId = vgap.settings.quantumtorpedoes ? 11 : 10;
            while (launcherId > ship.torpedoid) {
                var launchersToFit = mcntk.host.getStock(stockById, starbase.id, LauncherStockType, launcherId);
                var availableLaunchers = launchersToFit.amount;
                if (starbase.isbuilding && starbase.buildtorpedoid == launcherId) availableLaunchers -= starbase.buildtorpcount;
                if (availableLaunchers >= launchersForHull) {
                    ship.torpedoid = launcherId;
                    ship.torps = launchersForHull;
                    launchersToFit.amount -= launchersForHull;

                    var torpStock = mcntk.host.getStock(stockById, starbase.id, TorpedoStockType, launchersToFit.stockid)
                    var availableCargo = hull.cargo - ship.duranium - ship.tritanium - ship.molybdenum - ship.clans - ship.supplies;
                    var torpsToLoad = Math.min(availableCargo, torpStock.amount);
                    torpStock.amount -= torpsToLoad;
                    ship.ammo = torpsToLoad;
                }
                launcherId--;
            }

            if (ship.torpedoid != oldLauncherId || ship.torps != oldLaunchers || ship.ammo != oldAmmo)  {
                upgraded.launchers = true;
                upgraded.launcherId = ship.torpedoid;
                if (ship.ammo > 0) upgraded.ammo = ship.ammo;
            }
        }

        if (reporter) {
            if (upgraded.engines || upgraded.beams || upgraded.launchers) {
                reporter(Object.assign({object: ship, type: "superrefit"}, upgraded));
            } else {
                reporter({object: ship, type: "superrefit", nothingrefitted: true});
            }
        }
    },

    getStock: function(stockById, starbaseId, stockType, stockId) {
        var result;
        var sbStock = stockById[starbaseId]
        if (sbStock) {
            var typeStock = sbStock[stockType];
            if (typeStock) {
                result = typeStock[stockId];
            }
        }
        if (!result) result = { amount: 0};
        return result;
    },

    repairShip: function(ship) {
        if (ship.damage == -1) return;
        var canRepair = Math.floor(ship.supplies / 5);
        var willRepair = ship.damage >= canRepair ? canRepair : ship.damage;
        ship.damage -= willRepair;
        ship.supplies -= willRepair * 5;
    },

    mkt: function(ship) {
        if (ship.torpedoid == 0) return;
        if (ship.friendlycode.toLowerCase() != "mkt") return;
        var torp = vgap.getTorpedo(ship.torpedoid);
        var amount = Math.min(ship.duranium, ship.tritanium, ship.molybdenum, Math.floor(ship.megacredits / torp.torpedocost));
        ship.duranium -= amount;
        ship.tritanium -= amount;
        ship.molybdenum -= amount;
        ship.megacredits -= amount * torp.torpedocost;
        ship.ammo += amount;
    },

    tow: function(ship, shipsById, planetsEchoCluster) {
        if (mcntk.host.isValidTowMission(ship, shipsById)) {
            var towee = shipsById[ship.mission1target];
            mcntk.host.moveShip(ship, planetsEchoCluster, towee);
            towee.warp = 0;
            towee.x = ship.x;
            towee.y = ship.y;
            towee.targetx = ship.x;
            towee.targety = ship.y;
            towee.waypoints = [];
        }
    },

    // Can methods like this be moved to the toolkit plugin itself? Or even better, are there methods from NU on the vgap object?
    isValidTowMission: function(ship, shipsById) {
        if (ship.mission == 6) {
            var towee = shipsById[ship.mission1target];
            return towee && towee.x == ship.x && towee.y == ship.y;
        } else {
            return false;
        }
    },

    normalMovement: function(ship, shipsById, planetsEchoCluster) {
        if (!mcntk.host.isValidTowMission(ship, shipsById) && !mcntk.host.isValidInterceptMission(ship, shipsById)) {
            if (vgap.isHyping(ship)) {
                mcntk.host.hyperjump(ship, planetsEchoCluster);
            } else {
                mcntk.host.moveShip(ship, planetsEchoCluster);
            }
        }
    },

    intercept: function(ship, shipsById, planetsEchoCluster) {
        // shis.filter(ship.mission == intercept && target visible)
        // sortBy(chain?) or plain old ID
        // for each ship, move towards intercept target

        // for now, simplistic...
        if (mcntk.host.isValidInterceptMission(ship, shipsById)) {
            var interceptee = shipsById[ship.mission1target];
            ship.targetx = interceptee.x;
            ship.targety = interceptee.y;
            ship.waypoints = [];
            mcntk.host.moveShip(ship, planetsEchoCluster);
        }
    },

    isValidInterceptMission: function(ship, shipsById) {
        return (ship.mission == 7 || ship.mission == 20) && shipsById[ship.mission1target];
    },

    hyperjump: function(ship, planetsEchoCluster) {
        var targetx = ship.targetx,
            targety = ship.targety,
            dx = targetx - ship.x,
            dy = targety - ship.y,
            sqDist = dx*dx + dy*dy;

        if (sqDist < 340*340 || sqDist > 360*360) {
            var delta = mcntk.host.movementDelta(dx, dy, 350);
            targetx = ship.x + delta.x;
            targety = ship.y + delta.y;
        }

        ship.neutronium -= 50;  // 50 fuel guaranteed by positive result from vgap.isHyping()

        mcntk.host.doMoveShip(ship, targetx, targety);
        mcntk.host.fallToPlanet(ship, planetsEchoCluster.findNearestObjectsInRectangle(ship.x, ship.y, 2, 2));

        ship.warp = 0;
    },

    moveShip: function(ship, planetsEchoCluster, towee) {
        if (ship.warp == 0) return;

        ship.warp = Math.min(mcntk.maxWarp(ship), ship.warp);

        var targetx = ship.targetx,
            targety = ship.targety,
            dx = targetx - ship.x,
            dy = targety - ship.y;

        if (dx == 0 && dy == 0) return;

        var distance = Math.sqrt(dx*dx + dy*dy);

        var maxTravel = ship.warp * ship.warp;
        if (mcntk.isGravitonic(ship)) maxTravel *= 2;

        var engine = vgap.getEngine(ship.engineid > 0 ? ship.engineid : 9);
        var mass = mcntk.totalMass(ship);
        if (towee) mass += mcntk.totalMass(towee);
        var fuelRequired = mcntk.fuelForOneTurn(engine, ship.warp, mcntk.isGravitonic(ship), distance, mass);

        if (ship.neutronium < fuelRequired) {
            var fuelReqMaxTravel = mcntk.fuelForFullDistance(engine, ship.warp, mcntk.isGravitonic(ship), maxTravel, mass);
            var maxTravelProRatedDist = maxTravel * ship.neutronium / fuelReqMaxTravel;
            if (distance > maxTravel) distance = maxTravel;
            var fuelReqProRated = mcntk.fuelForFullDistance(engine, ship.warp, mcntk.isGravitonic(ship), distance, mass);
            var proRatedDist = distance * ship.neutronium / fuelReqProRated;
            var delta = mcntk.host.movementDelta(dx, dy, proRatedDist);
            targetx = ship.x + delta.x;
            targety = ship.y + delta.y;

            ship.neutronium = 0;
        } else {
            if (distance > maxTravel + 0.5) {
                var delta = mcntk.host.movementDelta(dx, dy, maxTravel);
                targetx = ship.x + delta.x;
                targety = ship.y + delta.y;
            }

            ship.neutronium -= fuelRequired;
        }

        mcntk.host.doMoveShip(ship, targetx, targety);

        if (ship.warp > 1 && (dx != 0 || dy != 0)) {
            mcntk.host.fallToPlanet(ship, planetsEchoCluster.findNearestObjects(ship.x, ship.y, 3));
        }

        if (ship.neutronium == 0) {
            ship.warp = 0;
            ship.waypoints = [];
            ship.heading = 0;
            if (ship.mission != 10) {  // Beam up Fuel, only mission that stays when running OoF
                ship.mission = 0;
            }
        }
    },

    movementDelta: (dx, dy, travelDistance) => {
        var distance = Math.sqrt(dx*dx + dy*dy);
        // taken from vgap.loadWarp, adjusted for rounding of -x.5 numbers
        var absDx = Math.abs(dx), absDy = Math.abs(dy);
        var signX = dx == 0 ? 1 : dx / absDx, signY = dy == 0 ? 1 : dy / absDy;
        var deltaX, deltaY;
        if (absDx > absDy) {
            deltaX = Math.floor(travelDistance * absDx / distance + 0.5);
            deltaY = Math.floor(deltaX * absDy / absDx + 0.5);
        } else {
            deltaY = Math.floor(travelDistance * absDy / distance + 0.5);
            deltaX = Math.floor(deltaY * absDx / absDy + 0.5);
        }
        return { x: deltaX*signX, y: deltaY*signY };
    },

    doMoveShip: (ship, targetx, targety) => {
        ship.history.unshift({x: ship.x, y: ship.y});

        ship.x = targetx;
        ship.y = targety;

        if (ship.x == ship.targetx && ship.y == ship.targety) {
            var nextTarget = ship.waypoints.shift();
            if (nextTarget) {
                ship.targetx = nextTarget.x;
                ship.targety = nextTarget.y;
            }
        }

        if (vgap.settings.sphere) {
            let widthPlus20 = vgap.settings.mapwidth + 20;
            if (ship.x < 2000 - widthPlus20 / 2) {
                ship.x += widthPlus20;
                ship.targetx += widthPlus20;
                ship.waypoints.forEach(wp => wp.x += widthPlus20);
            }
            if (ship.x > 2000 + widthPlus20 / 2) {
                ship.x -= widthPlus20;
                ship.targetx -= widthPlus20;
                ship.waypoints.forEach(wp => wp.x -= widthPlus20);
            }
            let heightPlus20 = vgap.settings.mapheight + 20;
            if (ship.y < 2000 - heightPlus20 / 2) {
                ship.y += heightPlus20;
                ship.targety += heightPlus20;
                ship.waypoints.forEach(wp => wp.y += heightPlus20);
            }
            if (ship.y > 2000 + heightPlus20 / 2) {
                ship.y -= heightPlus20;
                ship.targety -= heightPlus20;
                ship.waypoints.forEach(wp => wp.y -= heightPlus20);
            }
        }
    },

    fallToPlanet: (ship, warpWellPlanets) => {
        if (warpWellPlanets.length > 0) {
            var planet = warpWellPlanets[0];
            if (ship.targetx == ship.x && ship.targety == ship.y) {
                ship.targetx = planet.x;
                ship.targety = planet.y;
            }
            ship.x = planet.x;
            ship.y = planet.y;
        }
    },

    produceFreeFighters: function(starbase, planetsById) {
        var planet = planetsById[starbase.planetid];
        if (planet.ownerid == 0) return;
        if (!mcntk.ownedByEvilEmpire(planet)) return;

        var byTrit = Math.floor(planet.tritanium / 3),
            byMolyb = Math.floor(planet.molybdenum / 2);
        var fighterAmountMax = 0;
        if (vgap.settings.campaignmode) {
            if (mcntk.has5FreeFighters()) fighterAmountMax += 5;
            if (mcntk.has4FreeFighters()) fighterAmountMax += 4;
            if (mcntk.has3FreeFighters()) fighterAmountMax += 3;
            if (mcntk.has2FreeFighters()) fighterAmountMax += 2;
            if (mcntk.has1FreeFighter()) fighterAmountMax += 1;
        } else {
            fighterAmountMax = 5;
        }
        var canBuild = Math.min(fighterAmountMax, 60 - starbase.fighters, byTrit, byMolyb);

        starbase.fighters += canBuild;
        planet.tritanium -= canBuild * 3;
        planet.molybdenum -= canBuild * 2;
    },

    produceSuppliesAtPlanet: function(planet) {
        planet.supplies += planet.factories;
        if (planet.nativeracename === "Bovinoid") {
            var dairy = Math.floor(planet.nativeclans / 100);
            if (planet.clans < dairy) dairy = planet.clans;
            planet.supplies += dairy;
        }
    },

    tax: function(planet) {
        if (planet.ownerid == 0) return;

        var income = Math.round(planet.colonisttaxrate * planet.clans / 1000);
        if (planet.nativetype != 5) {
            var govFactor = planet.nativegovernment / 5;
            var nativeTaxRate = planet.nativetaxrate;
            if (nativeTaxRate > 20 && mcntk.ownedByBorg(planet)) nativeTaxRate = 20;
            var nativeIncome = Math.round(nativeTaxRate * planet.nativeclans * govFactor / 1000);

            if (planet.clans < nativeIncome) nativeIncome = planet.clans;
            if (planet.nativetype == 6) nativeIncome *= 2;  // Insectoids
            income += nativeIncome;
        }
        if (mcntk.ownedByFeds(planet)) income *= 2;
        if (income > 5000) income = 5000;
        planet.megacredits += income;

        planet.colonisthappypoints += vgap.colonistTaxChange(planet);
        if (planet.colonisthappypoints > 100) planet.colonisthappypoints = 100;

        planet.nativehappypoints += vgap.nativeTaxChange(planet);
        if (planet.nativehappypoints > 100) planet.nativehappypoints = 100;
    },

    condenseOreShip: function(ship, planetsEchoCluster) {
        if (ship.hullid != 107) return;

        if (ship.neutronium == 0) return;

        var planets = planetsEchoCluster.findNearestObjects(ship.x, ship.y, 0);
        if (planets.length == 0) return;

        var planet = planets[0];
        planet.densityneutronium = Math.min(50, planet.densityneutronium + 5);
        planet.densityduranium = Math.min(50, planet.densityduranium + 5);
        planet.densitytritanium = Math.min(50, planet.densitytritanium + 5);
        planet.densitymolybdenum = Math.min(50, planet.densitymolybdenum + 5);
    },

    produceMineralsAt: function(planet) {
        if (planet.ownerid == 0) return;
        if (planet.mines == -1) return;

        var multiplier = 1;
        if (mcntk.ownedByFeds(planet)) multiplier = 0.7;
        if (mcntk.ownedByLizards(planet)) multiplier = 2.0;
        if (planet.nativetype == 3) multiplier *= 2;  // Reptilians

        var dig = function(mineral) {
            var digUp = Math.round(planet.mines * planet["density"+mineral] * multiplier / 100);
            if (planet["ground"+mineral] < digUp) digUp = planet["ground"+mineral];
            planet[mineral] += digUp;
            planet["ground"+mineral] -= digUp;
        }

        dig("neutronium");
        dig("duranium");
        dig("tritanium");
        dig("molybdenum");
    },

    cleanUpPlanet: function(planet) {
        planet.builtmines = 0;
        planet.builtfactories = 0;
        planet.builtdefense = 0;

        planet.suppliessold = 0;

        if (planet.readystatus == 1) planet.readystatus = 0;
    },

    cleanUpStarbase: function(starbase) {
        starbase.hulltechup = 0;
        starbase.enginetechup = 0;
        starbase.beamtechup = 0;
        starbase.torptechup = 0;

        starbase.builtdefense = 0;
        starbase.builtfighters = 0;

        if (starbase.readystatus == 1) starbase.readystatus = 0;
    },

    cleanUpShip: function(ship) {
        if (ship.readystatus == 1) ship.readystatus = 0;
    }
};

if (!mcntk.predictedRsts) {
    mcntk.predictedRsts = {};   // For comparison with actual
}

mcntk.maybePredictRstFromPreviousTurn = () => {
    if (vgap.game.turn > vgap.nowTurn) return;  // future is never actual

    var key = vgap.getCacheKey(vgap.game.turn);
    if (!mcntk.predictedRsts[key]) {
        var prevTurnRst = vgap.rst[vgap.getCacheKey(vgap.game.turn - 1)];
        if (prevTurnRst) {
            // TODO TeamPlay will want to re-trigger this for various occasions.
            var predictedTurn = mcntk.host.simulate(prevTurnRst.rst, () => {});
            mcntk.predictedRsts[key] = predictedTurn;
        }
    }
};

mcntk.predictedRst = (turn) => {
    var key = vgap.getCacheKey(turn);
    return mcntk.predictedRsts[key];
};

// Half-baked abstraction for drawing images on the starmap

mcntk.canvasFor = function(w, h, imageData) {
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var context = canvas.getContext("2d");
    context.putImageData(imageData, 0, 0);  // simply copies RGB and alpha
    return canvas;
}

mcntk.drawImage = function(x, y, w, h, canvas) {
    var ctx = vgap.map.ctx;
    ctx.drawImage(canvas, x, y, w, h); // *applies* alpha while drawing RGB
};

// Desktop Menu

mcntk.rafMenus;

mcntk.showRafMenus = function() {
    $("#ExtraMapTools").show();
    mcntk.rafMenus.show();
}

mcntk.hideRafMenus = function() {
    mcntk.rafMenus.hide();
    $("#ExtraMapTools").hide();
}

mcntk.createDesktopMainMenuEntry = function(entry) {
    vgap.map.addMapTool(entry.name, "dunno", entry.action);
}

if (!mcntk.desktopMenus) {
    mcntk.desktopMenus = {};
}

function desktopMenuIdentifier(toggles) {
    return toggles.map(function(t) { return t.label; }).join("+");
}

function closeDesktopMenu(toggles) {
    var identifier = desktopMenuIdentifier(toggles);
    if (mcntk.desktopMenus[identifier]) {
        mcntk.desktopMenus[identifier][0].remove();
        mcntk.desktopMenus[identifier][1].forEach(function(toggle, index) {
            if (toggle.unregister) toggle.unregister(mcntk.desktopMenus[identifier][2][index]);
        });
        delete mcntk.desktopMenus[identifier];
    }
};

mcntk.createDesktopMenu = function(toggles) {
    closeDesktopMenu(toggles);

    var span = $("<span></span>");
    var changedFunctions = toggles.map(function(toggle) {
        var color = function() {
            return toggle.state() ? (toggle.color ? toggle.color : "white") : "#666666";
        }
        var filter = $("<li style='color: "+color()+";'>" +
                       "<a>"+toggle.label+"</a>" +
                       "</li>");
        span.append(filter);

        var setToggleColor = function() {
            filter.css("color", color());
        };
        filter.tclick(function() {
            toggle.action();
            setToggleColor();
        });

        if (toggle.register) toggle.register(setToggleColor);
        return setToggleColor;
    });
    mcntk.desktopMenus[desktopMenuIdentifier(toggles)] = [span, toggles, changedFunctions];

    var showMenu = true;
    function toggleFunction() {
        showMenu = !showMenu;
        if (showMenu) {
            span.show();
        } else {
            span.hide();
        }
    }

    var rNavItem = $("<li></li>");
    var rNav = $("<a class='rNavRight'></a>");
    rNav.tclick(function() {
        closeDesktopMenu(toggles);
    });
    rNav.appendTo(rNavItem);

    span.append(rNavItem);
    mcntk.rafMenus.append(span);
    span.show();

    return changedFunctions;
}

var checkExtraMapToolsAndRafMenus = function() {
    // the MapTools ought to be within the menubar, but it isn't.
    // Create one that is, so our spacing is always correct.
    // The original MapTool will be at the bottom of the expansion, so we keep it.
    if ($("#ExtraMapTools").length == 0) {
        var menu = $("#PlanetsMenu");
        var li = $("<li id='ExtraMapTools' style='width: 80px; background-image: url(http://play.planets.nu/img/game/maptools.png); background-position: 80px -38px; background-repeat: no-repeat;'>MapTools</li>");
        li.tclick(function () { vgap.map.toggleTools(); });
        menu.prepend(li);
        li.hide();

        mcntk.rafMenus = $("<span class='rafMenus'></span>");
        menu.prepend(mcntk.rafMenus);
        mcntk.rafMenus.hide();
    }
}

// Menus

mcntk.createMainMenuEntry = function(entry) {
    if (mcntk.onMobile()) {
        return mcntk.createMobileMainMenuEntry(entry);
    } else {
        return mcntk.createDesktopMainMenuEntry(entry);
    }
}

mcntk.createMenu = function(entries) {
    if (mcntk.onMobile()) {
        return mcntk.createMobileMenu(entries);
    } else {
        return mcntk.createDesktopMenu(entries);
    }
}

if (!mcntk.directMenuEntries) {
    mcntk.directMenuEntries = [];
}

mcntk.addMcNTkMenuEntry = (entry) => {
    var listeners = [];
    entry.register = (changed) => {
        listeners.push(changed);
    };
    entry.unregister = (changed) =>  {
        deleteFromArray(listeners, changed);
    };
    entry.listeners = listeners;

    mcntk.directMenuEntries.push(entry);

    return entry;
};

mcntk.removeMcNTkMenuEntry = (entry) => {
    deleteFromArray(mcntk.directMenuEntries, entry);
};

var deleteFromArray = function(array, element) {
    var index = array.indexOf(element);
    if (index >= 0) array.splice(index, 1);
}

mcntk.updateMenuStatus = (entry) => {
    entry.listeners.forEach((changed) => { changed(); });
};

mcntk.hideMenu = function() {
    if (mcntk.onMobile()) {
        mcntk.hideMobileMenu();
    } else {
        mcntk.hideRafMenus();
    }
};

mcntk.showMenu = function() {
    if (mcntk.onMobile()) {
        mcntk.showMobileMenu();
    } else {
        mcntk.showRafMenus();
    }
};

// Mobile Menu

mcntk.createMobileMainMenuEntry = function(entry) {
    var classes = "mapbutton";
    if (entry.fontClass) classes += " " + entry.fontClass;

    var menu = $("<div class='" + classes + "' title='" + entry.name + "'></div>");
    menu.css("line-height", "30px");
    if (entry.image) {
        menu.css({"background-image": "url(\""+entry.image+"\")",
                  "background-size": "30px 30px"});
    } else {
        menu.text(entry.label);
        menu.css({"color": entry.color,
                  "background-color": entry.bg,
                  "display": "inherit"});  // .fas messes up the NU display of #MapControls
    }
    menu.appendTo("#MapControls");

    menu.tclick(entry.action);

    return menu;
}

if (!mcntk.mobileMenus) {
    mcntk.mobileMenus = [];
}

mcntk.showMobileMenu = () => {
    if (mcntk.mobileMenus[0]) mcntk.mobileMenus[0].menu.show();
}

mcntk.hideMobileMenu = () => {
    if (mcntk.mobileMenus[0]) mcntk.mobileMenus[0].menu.hide();
}

mcntk.closeMobileMenus = function() {
    mcntk.mobileMenus.forEach(mcntk.closeMobileMenu);
    mcntk.mobileMenus = [];
};

mcntk.closeMobileMenu = function(mobileMenu) {
    mobileMenu.entries.forEach(function(entry, index) {
        if (entry.unregister) {
            var registeredFunction = mobileMenu.setters[index];
            entry.unregister(registeredFunction);
        }
    });
    mobileMenu.menu.remove();
    $(window).off("resize", mobileMenu.resizeFunction);
}

mcntk.backOneMobileMenu = function() {
    var mobileMenu = mcntk.mobileMenus.shift();
    mcntk.closeMobileMenu(mobileMenu);
    if (mcntk.mobileMenus[0]) {
        mcntk.showMobileMenu();
    } else {
        // show main menu!
        $("#MapControls").show();
    }
}

var layoutMobileMenuWidgets = function(widgets) {
    widgets.forEach(layoutMobileMenuWidget);
}

var layoutMobileMenuWidget = function(widget, index) {
    widget.css(mcntk.mobileMenuWidgetTopAndRight($(window).height(), index));
}

mcntk.mobileMenuWidgetTopAndRight = function (windowHeight, index) {
    actualIndex = index + 3;
    var fitEntryCount = Math.floor(windowHeight / 40);
    return {
        top: (40 * (actualIndex % fitEntryCount))+"px",
        right: (40 * Math.floor(actualIndex / fitEntryCount))+"px"
    }
}

mcntk.createMobileMenu = function(entries) {
    $("#MapControls").hide();

    mcntk.hideMobileMenu();

    var mobileMenu = $("<div id='McNTkMenu'></div>");
    mobileMenu.appendTo($("#PlanetsContainer"));
    mobileMenu.css({position: "absolute",
                    top: "10px",
                    right: "10px"});

    var ourEntryCss = {color: "#8bb",
                       backgroundColor: "#222",
                       width: "30px",
                       height: "30px",
                       textAlign: "center",
                       borderRadius: "50%",
                       position: "absolute",
                       right: "0px",
                       lineHeight: "30px",
                       zIndex: "16"};
    var closingEntry = $("<div class='fas' title='Close Menu'>\uf00d</div>");
    closingEntry.css(ourEntryCss);
    closingEntry.css("top", "40px");
    closingEntry.tclick(mcntk.closeMobileMenus);
    closingEntry.appendTo(mobileMenu);

    var backEntry = $("<div class='fas' title='Back 1 Menu'>&lt;</div>");
    backEntry.css(ourEntryCss);
    backEntry.css("top", "80px");
    backEntry.tclick(mcntk.backOneMobileMenu);
    backEntry.appendTo(mobileMenu);

    var setters = [];

    var widgets = entries.map(function(entry, index) {
        var classes = "";
        if (entry.fontClass) classes += " " + entry.fontClass;
        var filter = $("<div class='" + classes + "' title='" + entry.name + "'>"+entry.label+"</div>");
        filter.css({color: entry.color ? entry.color : "cyan",
                    backgroundColor: entry.bg ? entry.bg : "darkblue",
                    width: "30px",
                    height: "30px",
                    textAlign: "center",
                    borderRadius: "50%",
                    position: "absolute",
                    lineHeight: "30px",
                    zIndex: "16"});
        filter.appendTo(mobileMenu);
        filter.show();

        var setShadowForState = function() {
            filter.css("box-shadow", entry.state() ? "0px 0px 0px 1px #00ffff" : "0 0");
        };
        setShadowForState();

        filter.tclick(function() {
            entry.action();
            setShadowForState();
        });

        setters[index] = setShadowForState;

        if (entry.register) entry.register(setShadowForState);

        return filter;
    });

    layoutMobileMenuWidgets(widgets);
    var resizeFunction = function() {
        layoutMobileMenuWidgets(widgets);
    };
    $(window).resize(resizeFunction);

    mcntk.mobileMenus.unshift({ menu: mobileMenu, entries: entries, resizeFunction: resizeFunction, setters: setters });
}

var overrideExitVGAP = () => {
    // Would prefer to wrap continueExiting and exitError, but NoAnimations overrides this
    // Setting vgap.onexit is also a possibility, but then I'd end up calling nu.exitVGAP, just the same.
    Nuniverse.prototype.exitVGAP_wrappedByMcNimblesToolkit = Nuniverse.prototype.exitVGAP;
    Nuniverse.prototype.exitVGAP = function() {
        Nuniverse.prototype.exitVGAP_wrappedByMcNimblesToolkit();
        mcntk.closeMobileMenus();
    };
}

// Owners

mcntk.ownedByFeds = function(obj) {
    return obj.ownerid > 0 && vgap.players[obj.ownerid-1].raceid == 1;
};

mcntk.ownedByLizards = function(obj) {
    return obj.ownerid > 0 && vgap.players[obj.ownerid-1].raceid == 2;
};

mcntk.ownedByBirds = function(obj) {
    return obj.ownerid > 0 && vgap.players[obj.ownerid-1].raceid == 3;
};

mcntk.ownedByFascist = function(obj) {
    return obj.ownerid > 0 && vgap.players[obj.ownerid-1].raceid == 4;
};

mcntk.ownedByBorg = function(obj) {
    return obj.ownerid > 0 && vgap.players[obj.ownerid-1].raceid == 6;
};

mcntk.ownedByCrystal = function(obj) {
    return obj.ownerid > 0 && vgap.players[obj.ownerid-1].raceid == 7;
};

mcntk.ownedByEvilEmpire = function(obj) {
    return obj.ownerid > 0 && vgap.players[obj.ownerid-1].raceid == 8;
};


// Hull properties

mcntk.canCloak = (ship) => {
    return vgap.getHull(ship.hullid).cancloak;
};

mcntk.canAdvancedCloak = (ship) => {
    return ship.hullid == 29 ||  // DW
        ship.hullid == 31 ||  // Resolute
        ship.hullid == 3033 ||  // Deth Specula Heavy Frigate
        ship.hullid == 1047;  // Red Wind Storm Carrier
};

// Ship Helper Functions

mcntk.totalMass = (ship) => {
    // We cannot rely on "loading 50 tritanium on an enemy ship" by NU client, since we have no baseline to add the 50 to.
    // The neutr value on a ship may be bogus, while the trit is manyally set. It can be done, but not with the NU UIs.
    // likewise, whether ship.mass includes the neutr or trit is something we cannot know.

    if (ship.ownerid == vgap.player.id) {
        return mcntk.computeTotalMass(ship);
    } else {
        return ship.mass;
    }
};

mcntk.computeTotalMass = (ship) => {
    var mass = 0;

    var hull = vgap.getHull(ship.hullid);
    mass += hull.mass;

    mass += ship.clans;
    mass += ship.neutronium;
    mass += ship.tritanium;
    mass += ship.duranium;
    mass += ship.molybdenum;
    mass += ship.supplies;
    mass += ship.ammo;

    if (ship.beams > 0) {
        var beam = vgap.getBeam(ship.beamid);
        mass += beam.mass * ship.beams;
    }

    if (ship.torps > 0) {
        var torp = vgap.getTorpedo(ship.torpedoid);
        mass += torp.mass * ship.torps;
    }

    return mass;
};

// Labels

if (!mcntk.settings.labels) {
    mcntk.settings.createGameSetting("labels", []);
}

mcntk.labelFor = (owner) => {
    var labels = mcntk.settings.labels();
    return typeof labels[owner] == "string" ? labels[owner] : "[" + owner.toString(36) + "]";
};

var applySettings = () => {
    var labels = mcntk.settings.labels();
    var anyChanges = false;
    vgap.players.forEach((player, index) => {
        var slot = index + 1;
        if (slot != vgap.player.id) {
            var newLabel = $("#McNSettingsLabel"+slot)[0].value;
            if (newLabel != labels[slot]) {
                labels[slot] = newLabel;
                anyChanges = true;
            }
        }
    });
    if (anyChanges) mcntk.settings.setLabels(labels);
};

mcntk.openSettingsDialog = () => {
    var title = "McNTk Settings";

    var header = "<tr><th>Slot</th><th>Player</th><th>Race</th><th>Current Label</th><th>New Label</th></tr>";
    var rows = vgap.players.map((player) => {
        return "<tr>"+
            "<td>"+player.id+"</td>"+
            "<td>@"+player.username+"</td>"+
            "<td>"+player.raceid+"</td>"+
            "<td>"+(player.id == vgap.player.id ? "N/A" : mcntk.labelFor(player.id))+"</td>"+
            "<td>"+(player.id == vgap.player.id ? "N/A" : "<input id='McNSettingsLabel"+player.id+"' type='text' value='"+mcntk.labelFor(player.id)+"' style='width: 100%'></input>")+"</td>"+
        "</tr>";
    });
    var table = $("<table class='McNimblesSettings'>" + header + rows.join("") + "</table>");

    var okButton = $("<button>OK</button>");
    okButton.tclick(() => {
        applySettings();
        nu.closekeyedmodal(title);
        vgap.map.draw();
    });
    okButton.appendTo(content);

    var content = $("<div></div>");
    table.appendTo(content);
    okButton.appendTo(content);
    nu.keyedmodal(title, content, "McNimble's Toolkit Settings", 420, "body");
};

var addSettingsMenuEntry = () => {
    mcntk.addMcNTkMenuEntry({
        label: mcntk.onMobile() ? "\uf013" : "McNimble's Settings",
        fontClass: "fas",
        name: "McNimbles Settings",  // the quote messes up in the Hover
        color: "white",
        state: () => { return false; },
        action: () => { mcntk.openSettingsDialog(); }  // Potentially use the function of an upgraded toolkit
    });
};

var head = document.getElementsByTagName('head')[0];
if (head) {
    var newCss = document.createElement('style');
    newCss.type = "text/css";
    newCss.innerHTML =
        "table.McNimblesSettings { margin: 0px; }  " +  // Reduce spacing
        "table.McNimblesSettings tr td { padding: 0.5ex 0.5ex; border: 0px; vertical-align: inherit}  "  // Reduce vertical spacing
    head.appendChild(newCss);
}

// Colors

mcntk.colorForPlanet = function(planet) {
    return mcntk.colorForPlanetOwner(planet.ownerid);
};

mcntk.colorForPlanetOwner = function(owner) {
    if (owner == 0) {
        return mcntk.unownedPlanetColor;
    } else {
        var relation = vgap.relations[owner-1];
        if (relation.playerid == relation.playertoid) {
            return vgap.accountsettings.myplanetto;
        } else if (relation.color != "") {
            return "#" + relation.color;
        } else if (relation.relationto >= 2) {
            return vgap.accountsettings.allyplanetto;
        } else {
            return vgap.accountsettings.enemyplanetto;
        }
    }
};

mcntk.unownedPlanetColor = "#888";

mcntk.fadedColorForShipOwner = function(owner) {
    var normal = mcntk.colorForShipOwner(owner);
    var red = Number.parseInt(normal.substr(1, 2), 16);
    var green = Number.parseInt(normal.substr(3, 2), 16);
    var blue = Number.parseInt(normal.substr(5, 2), 16);
    return "rgba("+red+", "+green+", "+blue+", 0.4)";
};

mcntk.colorForShip = function(ship) {
    return mcntk.colorForShipOwner(ship.ownerid);
};

mcntk.colorForShipOwner = function(owner) {
    if (owner == 0) { // ghost ship
        return "#666666";
    } else {
        var relation = vgap.relations[owner-1];
        if (relation.playerid == relation.playertoid) {
            return vgap.accountsettings.myshipfrom;
        } else if (relation.color != "") {
            return "#" + relation.color;
        } else if (relation.relationto >= 2) {
            return vgap.accountsettings.allyshipfrom;
        } else {
            return vgap.accountsettings.enemyshipfrom;
        }
    }
};

mcntk.colorForMinefield = function(minefield) {
    return mcntk.colorForMinefieldOwner(minefield.ownerid);
};

mcntk.colorForMinefieldOwner = function(owner) {
    var relation = vgap.relations[owner-1];
    if (relation.playerid == relation.playertoid) {
        return vgap.accountsettings.mymines;
    } else if (relation.color != "") {
        return "#" + relation.color;
    } else if (relation.relationto >= 2) {
        return vgap.accountsettings.allymines;
    } else {
        return vgap.accountsettings.enemymines;
    }
};


// Short Names

mcntk.shortHullName = function(hull) {
    var name;
    switch (hull.id) {
    case 14: return "NFC";
    case 15: return "SDSF";
    case 16: return "MDSF";
    case 17: return "LDSF";
    case 18: return "STF";
    case 27: return "Swift";
    case 28: return "Fearless";
    case 69: return "SSD";
    case 102: return "Scorpius Light";
    case 104: return "Refinery";
        // Original ships above, NU ships below (campaign, horwasp)
    case 107: return "Ore Condenser";
    case 109: return "Freighter Â©";
    case 120: return "D9 USVA";
    case 203: return "Arm. Nest";
    case 207: return "Dur R";
    case 208: return "Trit R";
    case 209: return "Molyb R";
    case 1001: return "Outrider Transport";
    case 1010: return "Arkham Destroyer";
    case 1021: return "Reptile Escort";
    case 1049: return "T-Rex Â©";
    case 1025: return "Saurian Frigate";
    case 1030: return "Valiant Storm";
    case 1032: return "Bright Light";
    case 1033: return "Deth Armoured";
    case 1038: return "D3 Frigate";
    case 1041: return "Shield Gen";
    case 1040: return "Pest Light";
    case 1047: return "Red Storm";
    case 1048: return "Skyfire Transport";
    case 1049: return "Madonzilla Â©";
    case 1059: return "Med Trans";
    case 1050: return "Bloodfang Stealth";
    case 1062: return "Sky Garnet F";
    case 1085: return "Iron Tug";
    case 1089: return "Iron Command";
    case 1090: return "Sage Repair";
    case 1093: return "Heavy Transport";
    case 1095: return "Joe Light";
    case 1098: return "Taurus Transport";
    case 2010: return "Arkham Cruiser";
    case 2011: return "Thor Heavy";
    case 2035: return "Saurian Heavy";
    case 2033: return "Deth Stealth";
    case 2038: return "D3 Cruiser";
    case 2102: return "Scorpius Heavy";
    case 3004: return "Vendetta Stealth";
    case 3033: return "Deth Heavy";
    default:
        var hullName = hull.name;
        var m;
        if (m = hullName.match(/^(([^ ]+).*) Class /)) {
            name = m[2].match(/\d/) ? m[2] : m[1];
        } else if (m = hullName.match(/^(([^ ]+) [^ ]+)/)) {
            name = m[2].match(/\d/) ? m[2] : hullName;
        } else {
            name = hullName;
        }
        return name;
    }
};

mcntk.shortHullNameFor = function(ship) {
    return mcntk.shortHullName(vgap.getHull(ship.hullid));
};

mcntk.shortBeamName = [
    undefined,
    "Las",
    "X",
    "Pl",
    "Bl",
    "Pos",
    "Dis",
    "HBl",
    "Ph",
    "HDis",
    "HPh"
];

mcntk.shortTorpName = [
    undefined,
    "Mk1",
    "Pr",
    "Mk2",
    "Î³",
    "Mk3",
    "Mk4",
    "Mk5",
    "Mk6",
    "Mk7",
    "Mk8",
    "QT"
];

// Settings helpers

mcntk.unarmedPodScanRange = () => {
    return vgap.settings.sensorsweepnoncombatpodscanrange > 0 ? vgap.settings.sensorsweepnoncombatpodscanrange : 25;
};

mcntk.combatPodScanRange = () => {
    return vgap.settings.sensorsweepcombatpodscanrange > 0 ? vgap.settings.sensorsweepcombatpodscanrange : 50;
};

// Campaign / Advantages helpers

mcntk.hasCampaignAdvantage = function(advantage) {
    if (!vgap.settings.campaignmode) return false;

    var list = vgap.player.activeadvantages.split(",");
    list.pop();  // because the string ends with a comma...
    var campaignAdvantages = list.map((id) => { return parseInt(id); });
    return campaignAdvantages.indexOf(advantage) > -1;
};

mcntk.hasPlunder = () => { return mcntk.hasCampaignAdvantage(35); };

mcntk.has1FreeFighter = () => { return mcntk.hasCampaignAdvantage(55); };
mcntk.has2FreeFighters = () => { return mcntk.hasCampaignAdvantage(54); };
mcntk.has3FreeFighters = () => { return mcntk.hasCampaignAdvantage(53); };
mcntk.has4FreeFighters = () => { return mcntk.hasCampaignAdvantage(52); };
mcntk.has5FreeFighters = () => { return mcntk.hasCampaignAdvantage(22); };

mcntk.cloakAndInterceptEnabled = () => {
    return vgap.settings.cloakandintercept || mcntk.hasCampaignAdvantage(63);
}

// Engine helpers

mcntk.fuelForFullDistance = (engine, warp, isGravitonic, distance, mass) => {
    if (warp == 0) return 0;

    var maxTravel = warp * warp;
    if (isGravitonic) maxTravel *= 2;

    var fuelFactor = engine["warp"+warp];

    var massContrib = Math.floor(mass / 10);
    var distRatio = Math.floor(distance) / maxTravel;
    return Math.floor(fuelFactor * massContrib * ( distRatio / 10000) );
};

mcntk.fuelForOneTurn = (engine, warp, isGravitonic, distance, mass) => {
    if (warp == 0) return 0;

    var maxTravel = warp * warp;
    if (isGravitonic) maxTravel *= 2;

    var fuelFactor = engine["warp"+warp];

    var massContrib = Math.floor(mass / 10);
    if (Math.floor(distance) > maxTravel) {
        return Math.floor(fuelFactor * massContrib / 10000);
    } else {
        var distRatio = Math.floor(distance) / maxTravel;
        return Math.floor(fuelFactor * massContrib * ( distRatio / 10000) );
    }
};

// Ship helpers

mcntk.isGravitonic = function(ship) {
    return ship.hullid == 44 ||  // BR4
        ship.hullid == 45 ||  // BR5
        ship.hullid == 46;  // Meteor
};

mcntk.maxWarp = (ship) => {
    var maxDamage = mcntk.ownedByLizards(ship) ? 150 : 100;
    return Math.min(9, Math.ceil((maxDamage - ship.damage) / 10));
};

mcntk.attemptsToCloak = (ship) => {
    return mcntk.canCloak(ship) && (ship.mission == 9 || mcntk.onSuperSpy(ship));
};

mcntk.onSuperSpy = (ship) => {
    return mcntk.ownedByBirds(ship) && ship.mission == 8;
};

mcntk.doesCloakAndIntercept = (ship) => {
    return mcntk.cloakAndInterceptEnabled() && mcntk.ownedByBirds(ship) && ship.mission == 20;
}

// Non-overlapping text, exposed API

mcntk.drawNonoverlappingText = function(x, y, ...textsAndColors) {
    if (vgap.map.zoom < 1) return;

    if (mcntk.doSphereDuplication()) {
        NOT.storeTextForDrawing.apply(this, arguments);
    } else {
        if (NOT.isOnScreen(x, y)) {
            NOT.storeTextForDrawing.apply(this, arguments);
        }
    }
};

// Non-overlapping text, internals

// Sequence:
// (XX) on processload (that's of the turn) we have a chance to pre-define locations (based on planets and ships, which will very likely be toggled to have NOTs)
// (2) for every draw()
// (2a) McNTk NOT Part I   bootstraps the NOTs (given the pre-defined locations -- only in traditional mode)
// (2b) other plugins      call drawNonoverlappingText (maybe at a pre-defined location, may not)
// (2c) McNTk NOT Part II  actually draws the NOTs

if (!mcntk.NOT) {
    mcntk.NOT = {
        setting: "trad",
        listeners: []
    };
}

var NOT = mcntk.NOT;

NOT.isOnScreen = function(x, y) {
    var screenX = vgap.map.screenX(x),
        screenY = vgap.map.screenY(y);
    var halfMargin = vgap.map.canvasmargin / 2;
    return screenX > halfMargin &&
        screenX < $(window).width() + halfMargin &&
        screenY > halfMargin &&
        screenY < $(window).height() + halfMargin;
};

// DEV: show me a menu with different rendering options
if (false) {
NOT.setting = "allLR";

NOT.set = function(newValue) {
    NOT.setting = newValue;
    NOT.listeners.forEach((changedFun) => { changedFun(); });
    vgap.map.draw();
}

NOT.allLR = function() {
    NOT.set("allLR");
}

NOT.useTraditional = function() {
    NOT.set("trad");
}

NOT.showOptions = function() {
    mcntk.createMenu(NOT.options);
};

NOT.options = [
    { label: "LR", name: "Lower Right",
      color: "blue", bg: "red",
      state: () => { return NOT.setting == "allLR" },
      action: NOT.allLR,
      register: (changedFun) => {
          NOT.listeners.push(changedFun);
      },
      unregister: (changedFun) => {
          deleteFromArray(NOT.listeners, changedFun);
      }
    },
    { label: "tr", name: "Traditional",
      color: "blue", bg: "red",
      state: () => { return NOT.setting == "trad" },
      action: NOT.useTraditional,
      register: (changedFun) => {
          NOT.listeners.push(changedFun);
      },
      unregister: (changedFun) => {
          deleteFromArray(NOT.listeners, changedFun);
      }
    }
];

// Exact copy from R&F
var deleteFromArray = function(array, element) {
    var index = array.indexOf(element);
    if (index >= 0) array.splice(index, 1);
}

// DEV: end menu
}

NOT.Quadrant = {
    BelowRight: 1,
    AboveRight: 2,
    AboveLeft: 3,
    BelowLeft: 4
};

NOT.Location = function() {
    var textLocation = function(x, y, quadrant) {
        this.x = x;
        this.y = y;
        this.quadrant = quadrant || NOT.Quadrant.BelowRight;
        this.texts = [];
    };

    textLocation.prototype.addText = function(text) {
        this.texts.push(text);
    }

    return textLocation;
}();

NOT.prepareNOT = function() {
    if (NOT.setting == "trad") {
        NOT.textLocations = NOT.predefineLocations(vgap.planets.concat(vgap.ships));
    } else {
        NOT.textLocations = {};
    }
}

NOT.predefineLocations = function(objects) {
    var locations = NOT.removeDuplicateLocations(objects);
    var busyQuadrants = markBusyQuartersOfLocations(locations);
    return useTheseQuadrants(busyQuadrants);
}

NOT.removeDuplicateLocations = function(objects) {
    var lookup = {};
    var result = [];
    objects.forEach(function(o) {
        var key = [o.x, o.y];
        if (!lookup[key]) {
            lookup[key] = o;
            result.push(o);
        }
    });
    return result;
};

var markBusyQuartersOfLocations = function(objects) {
    var result = {};
    var echoCluster = new mcntk.EchoCluster(objects);

    var maxDist = 83.5;
    objects.forEach(function(objA) {
        var location = {
            x: objA.x,
            y: objA.y,
            aboveLeftBusy: 0,
            aboveRightBusy: 0,
            belowLeftBusy: 0,
            belowRightBusy: 0
        };
        result[[objA.x, objA.y]] = location
        echoCluster.findObjects(objA.x, objA.y, maxDist).forEach(function(objB) {
            if (objB.x == objA.x && objB.y == objA.y) return;

            var dx = objA.x - objB.x;
            var dy = objA.y - objB.y;
            var dist = Math.sqrt(dx*dx + dy*dy);
            var measure = (100 / dist);

            var onTheRight = objB.x > objA.x;
            var onTheLeft = objB.x < objA.x;
            var above = objB.y > objA.y;
            var below = objB.y < objA.y;
            if (above) {
                if (onTheLeft) {
                    location.aboveLeftBusy += measure;
                    location.aboveRightBusy += measure / 20;  // also push 'close quarters' away, but just slightly
                    location.belowLeftBusy += measure / 20;
                } else if (onTheRight) {
                    location.aboveRightBusy += measure;
                    location.aboveLeftBusy += measure / 20;
                    location.belowRightBusy += measure / 20;
                } else {
                    location.aboveRightBusy += measure / 2;
                    location.aboveLeftBusy += measure / 2;
                }
            } else if (below) {
                if (onTheLeft) {
                    location.belowLeftBusy += measure;
                    location.belowRightBusy += measure / 20;
                    location.aboveLeftBusy += measure / 20;
                } else if (onTheRight) {
                    location.belowRightBusy += measure;
                    location.belowLeftBusy += measure / 20;
                    location.aboveRightBusy += measure / 20;
                } else {
                    location.belowRightBusy += measure / 2;
                    location.belowLeftBusy += measure / 2;
                }
            } else {
                if (onTheLeft) {
                    location.aboveLeftBusy += measure / 2;
                    location.belowLeftBusy += measure / 2;
                } else {
                    // onTheRight, 'coz cannot be in same spot
                    location.aboveRightBusy += measure / 2;
                    location.belowRightBusy += measure / 2;
                }
            }
        });
    });
    return result;
}

var useTheseQuadrants = function(busyQuadrants) {
    var result = {};
    Object.keys(busyQuadrants).forEach(function(key) {
        var location = busyQuadrants[key];
        result[key] = new NOT.Location(location.x, location.y, NOT.useThisQuadrant(location));
    });
    return result;
};

NOT.useThisQuadrant = function(location) {
    var useQuadrant = NOT.Quadrant.BelowRight;
    var leastBusy = location.belowRightBusy;
    if (location.aboveRightBusy < leastBusy) {
        useQuadrant = NOT.Quadrant.AboveRight;
        leastBusy = location.aboveRightBusy;
    }
    if (location.aboveLeftBusy < leastBusy) {
        useQuadrant = NOT.Quadrant.AboveLeft;
        leastBusy = location.aboveLeftBusy;
    }
    if (location.belowLeftBusy < leastBusy) {
        useQuadrant = NOT.Quadrant.BelowLeft;
        leastBusy = location.belowLeftBusy;
    }
    return useQuadrant;
};

NOT.storeTextForDrawing = function(x, y, ...textAndColorPairs) {
    var location = NOT.getTextLocation(x, y);
    var text = NOT.createText.apply(this, textAndColorPairs);
    location.addText(text);
};

NOT.getTextLocation = function(x, y) {
    if (!NOT.textLocations[[x,y]]) NOT.textLocations[[x, y]] = new NOT.Location(x, y);
    return NOT.textLocations[[x, y]];
};

NOT.createText = function(...textAndColorPairs) {
    var texts = [],
        width = 0,
        maxTextLen = vgap.map.zoom * 20,
        textLen = 0;

    while (textAndColorPairs.length >= 2 && textLen < maxTextLen) {
        var text = textAndColorPairs.shift(),
            color = textAndColorPairs.shift();
        if (typeof(text) != "string" || typeof(color) != "string") {
            break;  // might be an old-style call that handed us a boolean
        }

        if (textLen + text.length > maxTextLen) {
            text = text.substring(0, maxTextLen - textLen) + "Ì‡Ì‡...";
            // We can do better - we measure the text width below, we might as well max the string length in that domain! Later.
        }
        var w = NOT.measureText(text);
        texts.push({text: text, color: color, width: w});
        width += w;
        textLen += text.length;
    }

    return {
        texts: texts,
        width: width
    };
};

NOT.measureText = function(text) {
    var ctx = vgap.map.ctx;
    ctx.font = NOT.font();  // context measures width, hence need to set its font
    var measure = ctx.measureText(text);
    return measure.width;
}

NOT.font = function() {
    return NOT.fontSize() + "px Arial";  // style variant weight size family; family is mandatory
}

NOT.fontSize = function() {
    var fontScaling = Math.pow(vgap.map.zoom, 0.3);
    var fontSize = fontScaling >= 1 ? Math.floor(10 * fontScaling) : Math.ceil(10 * fontScaling);
    if (fontSize > 28) fontSize = 28;
    return fontSize;
}

NOT.fontSpacing = function() {
    return NOT.fontSize() / 5;
}

NOT.lineHeight = function() {
    return NOT.fontSize() * 6 / 5;
}

NOT.actuallyDrawNOT = function() {
    if (vgap.map.zoom < 1) return;
    vgap.map.ctx.textAlign = "left";  // Because draw/markers can leave it in the wrong state...

    if (NOT.setting == "trad") {
        NOT.tradDrawNOT(NOT.textLocations);
    } else {
        NOT.take2DrawNOT(NOT.textLocations);
    }
};

NOT.tradDrawNOT = function(locations) {
    var fontSize = NOT.fontSize();
    var fontSpacing = NOT.fontSpacing();
    var lineHeight = NOT.lineHeight();

    var ctx = vgap.map.ctx;
    ctx.font = NOT.font();

    var hMargin = Math.max(9, 3 * vgap.map.zoom, fontSpacing);

    Object.keys(locations).forEach(function(key) {
        var location = locations[key];

        var xOffset, yOffset;
        if (location.quadrant == NOT.Quadrant.BelowRight) {
            xOffset = hMargin;
            yOffset = fontSize;
        } else if (location.quadrant == NOT.Quadrant.AboveRight) {
            xOffset = hMargin;
            yOffset = -fontSpacing;
        } else if (location.quadrant == NOT.Quadrant.BelowLeft) {
            xOffset = -hMargin;
            yOffset = fontSize;
        } else if (location.quadrant == NOT.Quadrant.AboveLeft) {
            xOffset = -hMargin;
            yOffset = -fontSpacing;
        }
        if (yOffset < 0) yOffset -= (location.texts.length - 1) * lineHeight;

        var doDrawText = function(x, y) {
            var screenX = vgap.map.screenX(x);
            var screenY = vgap.map.screenY(y);
            location.texts.forEach(function(text) {
                var internalOffset = xOffset < 0 ? -text.width : 0;
                text.texts.forEach((tcw) => {
                    ctx.fillStyle = tcw.color;
                    ctx.fillText(tcw.text, screenX + xOffset + internalOffset, screenY + yOffset);
                    internalOffset += tcw.width;
                });
                screenY += lineHeight;
            });
        };

        if (mcntk.doSphereDuplication()) {
            mcntk.forAllSphereLocations(location.x, location.y, doDrawText);
        } else {
            doDrawText(location.x, location.y);
        }
    });
}

NOT.take2DrawNOT = function(textLocations) {
    var ctx = vgap.map.ctx;
    ctx.lineWidth = 1;
    ctx.font = NOT.font();
    ctx.textBaseline = "top";

    Object.keys(textLocations).forEach((key) => {
        var textLocation = textLocations[key];
        if (doSphereDuplication()) {
            mcntk.forAllSphereLocations(textLocation.x, textLocation.y, (sphereX, sphereY) => {
                var screenX = vgap.map.screenX(sphereX);
                var screenY = vgap.map.screenY(sphereY);
                NOT.gah(textLocation, screenX, screenY)
            });
        } else {
            var screenX = vgap.map.screenX(textLocation.x);
            var screenY = vgap.map.screenY(textLocation.y);
            NOT.gah(textLocation, screenX, screenY)
        }
    });

    ctx.textBaseline ="alphabetic";
};

NOT.gah = function(textLocation, screenX, screenY) {
    var ctx = vgap.map.ctx;
    var lineHeight = NOT.lineHeight();

    var xOffset = mcntk.haveRedrawAndFilter() ? mcntk.haveRedrawAndFilter().enemyShipRadius() - 2 : vgap.map.planetRad();
    var yOffset = xOffset;

    var n = 0;
    var maxTextWidth = 0;
    var bottomLeft = false;
    textLocation.texts.forEach((text, n) => {
        if (screenX + xOffset + text.width >= $(window).width() + vgap.map.canvasmargin / 2) {  // because canvas is bigger than screen, since draw() is too slow and all the design decisions that NU made seem to complicate matters
            bottomLeft = true;
        }

        n += 1;
        if (text.width > maxTextWidth) maxTextWidth = text.width;
    });

    textLocation.texts.forEach((text, n) => {
        var x = bottomLeft ? screenX - xOffset : screenX + xOffset;
        var y = screenY + n * lineHeight + yOffset;
        var internalOffset = bottomLeft ? -text.width : 0;
        text.texts.forEach((tcw) => {
            ctx.fillStyle = tcw.color;
            ctx.fillText(tcw.text, x + internalOffset, y);
            internalOffset += tcw.width;
        });
    });

    ctx.strokeStyle = "#888";
    ctx.beginPath();
    var rectWidth = maxTextWidth + 2 * xOffset;
    var rectHeight = (textLocation.texts.length - 1) * lineHeight + NOT.fontSize() + 2 * yOffset;
    if (bottomLeft) {
        ctx.rect(screenX - rectWidth, screenY, rectWidth, rectHeight);
    } else {
        ctx.rect(screenX, screenY, rectWidth, rectHeight);
    }
    ctx.stroke();
}

// Our delayed drawing of non-overlapping texts must be done as the "last plugin"
// such that when the copy of the canvas is made (for fast draws) contains the texts
// See vgap.map.draw()
var trailingPlugin = {
    draw: function() {
        NOT.actuallyDrawNOT();
    }
};
var trailingPluginLoaded;

var nonOverlappingTextPlugin = {
    draw: function() {
        NOT.prepareNOT();
    },

    processload: function() {
        if (!trailingPluginLoaded) {
            vgap.registerPlugin(trailingPlugin, name + ": Non-overlapping text, Part ][")
            trailingPluginLoaded = true;
        }
    }
};

var installNOTPlugin = () => {
    vgap.registerPlugin(nonOverlappingTextPlugin, name + ": Non-overlapping text, Part I");
}

// Parse Messages

// TODO prevent overloading with older Toolkit version to take out a decoder... The decoders are state... even if the turn-state is probably covered by the setup() functions.

var parseMess = mcntk.msg = {};

MessageNote = function(body, x, y, color, drawLocation) {
    this.body = body;
    this.x = x;
    this.y = y;
    this.color = color;
    this.drawLocation = drawLocation;
};

var decoders = [];
var registerMessageDecoder = function(type, headline, regexp, decoder, setup, finish) {
    if (!decoders[type]) decoders[type] = [];
    decoders[type].push({ headline: headline, regexp: regexp, decoder: decoder, setup: setup, finish: finish });
}

registerMessageDecoder(
    4,
    "Scanner Report",
    /We are detecting minefield detonations around \( \d+, \d+ \).  Explosions detected: (\d+)/,
    function(msg, match) {
        return new MessageNote(match[1] + " mines detonated", msg.x, msg.y, "#ff88ff", true);
    }
);

var pillageRegexp = /The Fascist Empire is plundering .+ ID#(\d+).<br\/>20% of the population has been killed. Our money has been beamed aboard. Our supplies have been taken.<br\/>Colonists remaining: (\d+)/;

registerMessageDecoder(
    5,
    null,
    pillageRegexp,
    function(msg, _match) {
        var key = msg.x + "," + msg.y;
        if (!parseMess.pillageLocations[key]) parseMess.pillageLocations[key] = { x: msg.x, y: msg.y, ownShip: 0, atColony: 0 };
        var pillage = parseMess.pillageLocations[key];
        pillage.atColony += 1;
        pillage.amVictim = pillage.atColony > pillage.ownShip;  // you get both types of messages when pillaging yourself
        pillage.isPlunder = mcntk.hasPlunder() && pillage.ownShip >= pillage.atColony;  // best guess, really
    },
    function() {
        parseMess.pillageLocations = {}
    }
);

registerMessageDecoder(
    8,
    null,
    /From .* ID#(\d+):<br\/><br\/>We have been detected by a Loki class ship\. They found us with a tachyon field\. Our cloaking device has failed\./,
    (msg, match) => {
        return new MessageNote("S"+match[1]+" decloaked by Loki", msg.x, msg.y, "white", true);
    }
);

registerMessageDecoder(
    8,
    null,
    /The  starship .* ID#(\d+) has surrendered to the Lizard starbase at .* ID#\d+./,
    (msg, match) => {
        return new MessageNote("S"+match[1]+" surrendered", msg.x, msg.y, "#ff8");
    }
);

registerMessageDecoder(
    9,
    null,
    pillageRegexp,
    function(msg, _match) {
        var key = msg.x + "," + msg.y;
        if (!parseMess.pillageLocations[key]) parseMess.pillageLocations[key] = { x: msg.x, y: msg.y, ownShip: 0, atColony: 0 };
        var pillage = parseMess.pillageLocations[key];
        pillage.ownShip += 1;
        pillage.amVictim = pillage.atColony > pillage.ownShip;  // you get both types of messages when pillaging yourself
        pillage.isPlunder = mcntk.hasPlunder() && pillage.ownShip >= pillage.atColony;  // best guess, really
    },
    // already setup at message type 5
);


var rgaLocations;
registerMessageDecoder(
    5,
    null,
    /The colony has been sabotaged!<br\/>30% of the money has been destroyed<br\/>40% of the supplies destroyed<br\/>20% colonists killed<br\/>20% of the defense outposts gone<br\/>60% of the mineral mines gone<br\/>30% of the factories destroyed<br\/>The colonists are upset./,
    function(msg, match) {
        rgaLocations[msg.x+","+msg.y] = true;
        return new MessageNote("RGA'd!!!", msg.x, msg.y, "#ff3311");
    },
    function() {
        rgaLocations = {}
    }
);

registerMessageDecoder(
    6,
    null,
    /The colonists on .+? ID#\d+ have defeated .+? \((.+?)\) forces!<br\/>We are now in control of the planet\./,
    function(msg, match) {
        return new MessageNote("GA'ed, defeated "+match[1], msg.x, msg.y, "#33ff66");
    }
);

registerMessageDecoder(
    6,
    null,
    /The colonists on .+? ID#\d+ have been massacred by .+? \((.+?)\) forces living on the planet\. The colonists fought hard\.\.\.<br\/>\.\.\.but to no avail\./,
    function(msg, match) {
        return new MessageNote("GA'ed, "+match[1]+" survived", msg.x, msg.y, "#99ff66");
    }
);

registerMessageDecoder(
    6,
    null,
    /The colonists on .+? ID#\d+ have been attacked by .+? \((.+?)\) ground forces\./,
    function(msg, match) {
        return new MessageNote("GA'ed, survived "+match[1], msg.x, msg.y, "#ff6633");
    }
);

registerMessageDecoder(
    6,
    null,
    /The colonists on .+? ID#\d+ have been massacred by attacking .+? \((.+?)\) forces\. The colonists fought hard\.\.\.<br\/>\.\.\.but to no avail\./,
    function(msg, match) {
        return new MessageNote("GA'ed, lost to "+match[1], msg.x, msg.y, "#ff3333");
    }
);

registerMessageDecoder(
    6,
    null,
    /The colonists on have been massacred by Assault troops! The colonists did not stand a chance against the might of the Star Destroyer parked in orbit./,
    function(msg, match) {
        return new MessageNote("Imperial Assault!", msg.x, msg.y, "#ff6666");
    }
);

registerMessageDecoder(
    7,
    "Fleet Command",
    / ID#(\d+) has activated their Glory Device and exploded at: \( \d+, \d+\)<br\/><br\/>Friendly code: (...)/,
    function(msg, match) {
        var shipId = match[1]
        var fc = match[2];
        var isPop = fc.match(/pop/i);
        return new MessageNote("GD "+shipId+" "+(isPop?"POP":"TRG"), msg.x, msg.y, "#66ffff", true);
    }
);

registerMessageDecoder(
    8,
    null,
    /Our spy team has changed the planetary friendly code on: .+ ID#\d+<br\/> to (.{3})(<br\/>Enemy defense outposts are using an ion discharge overload to decloak all ships in orbit!<br\/>They sacrificed ten outposts.)?/,
    function(msg, match) {
        var ionPulse = match[2] != undefined;
        return new MessageNote("FC set to '"+match[1]+"'"+(ionPulse ? " Ion Pulse" : ""), msg.x, msg.y, ionPulse ? "#44ff44" : "#66aa66");
    }
);

registerMessageDecoder(
    8,
    null,
    /We have robbed the ship .*? ID#(\d+)\.  We have taken (\d+) KT of their cargo and (\d+) KT of their fuel\./,
    function(msg, match) {
        var text = "S"+msg.target+" robbed S"+match[1]+": "+match[3]+" fuel, "+match[2]+" cargo";
        var info = { own: true, robberId: msg.target, victimId: parseInt(match[1]), fuel: parseInt(match[3]), cargo: parseInt(match[2]) };
        parseMess.addLocalizedObj(parseMess.robLocations, msg.x, msg.y, info);
    },
    function() {
        parseMess.robLocations = {};
    },
    function() {
        Object.keys(parseMess.robLocations).forEach((key) => {
            var robLocation = parseMess.robLocations[key];
            robLocation.objects.sort((a, b) => {
                var diff = a.robberId - b.robberId;
                return diff == 0 ? a.victimId - b.victimId : diff;
            });
        })
    }
);

parseMess.addLocalizedObj = function(localizedObjs, x, y, object) {
    var key = "" + x + "," + y;
    if (!localizedObjs[key]) localizedObjs[key] = { x: x, y: y, objects: [] };
    localizedObjs[key].objects.push(object);
}

registerMessageDecoder(
    8,
    null,
    /We have landed saboteurs on .+ ID#\d+.<br\/>30% of the money has been destroyed<br\/>40% of the supplies destroyed<br\/>20% colonists killed<br\/>20% of the defense outposts gone<br\/>60% of the mineral mines gone<br\/>30% of the factories destroyed<br\/>The colonists are upset./,
    function(msg, match) {
        if (!rgaLocations[msg.x+","+msg.y])
            return new MessageNote("RGA'd", msg.x, msg.y, "#ffaa00");
    }
);

registerMessageDecoder(
    8,
    null,
    /Glory device! We have been hit by Level 6 shockwave!<br\/>AT: \( \d+ , \d+ \)<br\/>Damage is at (\d+)%/,
    function(msg, match) {
        var damage = match[1];
        var shipIdMatch = msg.headline.match(/ID#(\d+)$/);
        var shipId = shipIdMatch[1];
        return new MessageNote("S"+shipId+" "+damage+"% damage (GD)", msg.x, msg.y, damage >= 100 ? "red" : "#ffaa66");
    }
);

registerMessageDecoder(
    9,
    null,
    /Enemy Distress Call - Glory device! We have been hit by Level 6 shockwave!<br\/>AT: \( \d+ , \d+ \)<br\/>Damage is at (\d+)%/,
    function(msg, match) {
        var damage = match[1];
        var shipIdMatch = msg.headline.match(/ID#(\d+)$/);
        var shipId = shipIdMatch[1];
        return new MessageNote("S"+shipId+" "+damage+"% damage (GD "+msg.target+")", msg.x, msg.y, "#66ffff");
    }
);


registerMessageDecoder(
    10,
    "Long Range Sensors",
    /^Distress call and explosion detected at \( \d+, \d+ \) the name of the ship was: (.*)$/,
    (msg, match) => {
        var key = msg.x + "," + msg.y;
        if (!parseMess.colocatedExplosions[key]) {
            parseMess.colocatedExplosions[key] = { explosions: [], x: msg.x, y: msg.y };
        }
        parseMess.colocatedExplosions[key].explosions.push({ name: match[1] });
    },
    () => { parseMess.colocatedExplosions = {}; },
    () => {
        Object.keys(parseMess.colocatedExplosions).forEach((key) => {
            var oneSet = parseMess.colocatedExplosions[key];
            oneSet.explosions.reverse();  // explosions, as so many messages, are in reverse order...
        });
    }
);

var uniqueOutOfFuelNotes;
registerMessageDecoder(
    12,
    "Scanner Report",
    /ID#(\d+) is out of fuel and energy. They can no longer attack us\.$/,
    function(msg, match) {
        var shipId = match[1];
        var ship = vgap.getShip(shipId);
        if (!ship || ship.ownerid != vgap.player.id) { // no need for a note when we already tow-captured the ship
            if (!uniqueOutOfFuelNotes[shipId]) {
                uniqueOutOfFuelNotes[shipId] = new MessageNote("S"+shipId+" Out of Fuel", msg.x, msg.y, "#ffff00");
                return uniqueOutOfFuelNotes[shipId];
            }
        }
    },
    function() {
        uniqueOutOfFuelNotes = [];
    }
);

registerMessageDecoder(
    13,
    null,
    /Meteor shower!<br\/>Small meteors have impacted on the planets surface, no major damage to report. Meteor ore content:<br\/>(\d+) kt Neutronium<br\/>(\d+) kt Duranium<br\/>(\d+) kt Tritanium<br\/>(\d+) kt Molybdenum<br\/>/,
    function(msg, match) {
        var mineralText = match[1]+"N "+match[2]+"D "+match[3]+"T "+match[4]+"M"
        return new MessageNote(mineralText+" meteor shower", msg.x, msg.y, "#aaaaaa");
    }
);

registerMessageDecoder(
    13,
    "Scanner Report",
    /We have detected a massive meteor impact on .+ ID#\d+.  The virtual neutrino spectrometers show meteor ore content to be:<br\/>(\d+) kt Neutronium<br\/>(\d+) kt Duranium<br\/>(\d+) kt Tritanium<br\/>(\d+) kt Molybdenum/,
    function(msg, match) {
        var meteorInfo = "Meteor: "+match[1]+"N "+match[2]+"D "+match[3]+"T "+match[4]+"M";
        var note = vgap.getNote(msg.target, 1);
        if (note.body.indexOf(meteorInfo) < 0) {
            if (note.body.length > 0) note.body += "\n";
            note.body += meteorInfo;
            note.changed = 1;
            // vgap.save();  // Leave disabled until I sort out the new client
        }
    }
);

registerMessageDecoder(
    13,
    null,
    /DISTRESS CALL - MASSIVE METEOR IMPACT!!! MASSIVE DAMAGE<br\/>Meteor ore content:<br\/>(\d+) kt Neutronium<br\/>(\d+) kt Duranium<br\/>(\d+) kt Tritanium<br\/>(\d+) kt Molybdenum/,
    function(msg, match) {
        var meteorInfo = "Meteor: "+match[1]+"N "+match[2]+"D "+match[3]+"T "+match[4]+"M";
        var note = vgap.getNote(msg.target, 1);
        if (note.body.indexOf(meteorInfo) < 0) {
            if (note.body.length > 0) note.body += "\n";
            note.body += meteorInfo;
            note.changed = 1;
            // vgap.save();  // Leave disabled until I sort out the new client
        }
    }
);

registerMessageDecoder(
    16,
    "Enemy Distress Call",
    / ID#(\d+) has struck a mine!<br\/>Damage is at: (\d+)<br\/>\( \d+, \d+ \)/,
    function(msg, match) {
        return new MessageNote("S" + match[1] + " hit a mine; " + match[2] + "%", msg.x, msg.y, "#ff44ff", true);
    }
);

registerMessageDecoder(
    16,
    null,
    / ID#(\d+) has struck a WEB mine!<br\/>Damage is at: (\d+)<br\/>We are stuck in the web! We are burning fuel to keep our shields up!<br\/>\( (\d+), (\d+) \)/,
    function(msg, match) {
        return new MessageNote("S" + match[1] + " hit a web; " + match[2] + "%", msg.x, msg.y, "#ff00ff");
    }
);

parseMess.parse = function(messages) {
    setupDecoders();
    var result = runDecoders(messages);
    finishDecoders();  // cleanup, sorting
    return result;
}

var setupDecoders = function() {
    decoders.forEach(function(decodersByType) {
        if (decodersByType) decodersByType.forEach(function(decoder) {
            if (decoder.setup) decoder.setup();
        });
    });
}

var runDecoders = function(messages) {
    var result = [];
    messages.forEach(function(msg) {
        var candidates = decoders[msg.messagetype];
        if (candidates) {
            candidates.forEach(function(candidate) {
                if (!candidate.headline || candidate.headline == msg.headline) {
                    var match = msg.body.match(candidate.regexp);
                    if (match) {
                        var note = candidate.decoder(msg, match);
                        if (note && note instanceof MessageNote) result.push(note);
                    }
                }
            })
        }
    });
    return result;
};

var finishDecoders = function() {
    decoders.forEach(function(decodersByType) {
        if (decodersByType) decodersByType.forEach(function(decoder) {
            if (decoder.finish) decoder.finish();
        });
    });
}

// Partition by

mcntk.partitionBy = function(objects, criterionFunction) {
    var result = {};
    objects.forEach(function(obj) {
        var criterion = criterionFunction(obj);
        if (!result[criterion]) result[criterion] = [];
        result[criterion].push(obj);
    });
    return result;
}

// Sphere duplication
// That is, we draw things multiple times, we do not duplicate objects

mcntk.doSphereDuplication = function() {
    return vgap.settings.sphere && mcntk.haveSphereDuplication();
}

mcntk.forAllSphereLocations = function(x, y, fun) {
    // For some reason, there is an extra 10 LY band around the map before duplication.
    // It's as if the map is 20 LY wider.
    // Map center is always (2000, 2000)
    var mapWidth = vgap.settings.mapwidth + 20;
    var mapHeight = vgap.settings.mapheight + 20;

    var minMapX = vgap.map.mapX(0);
    var startX = x;
    while (startX < minMapX) startX += mapWidth;
    while (startX - mapWidth >= minMapX) startX -= mapWidth;

    var maxMapX = vgap.map.mapX($(window).width());
    var stopX = startX;
    while (stopX > maxMapX) stopX -= mapWidth;
    while (stopX + mapWidth <= maxMapX) stopX += mapWidth;

    var minMapY = vgap.map.mapY($(window).height());
    var startY = y;
    while (startY < minMapY) startY += mapHeight;
    while (startY - mapHeight >= minMapY) startY -= mapHeight;

    var maxMapY = vgap.map.mapY(0);
    var stopY = startY;
    while (stopY > maxMapY) stopY -= mapHeight;
    while (stopY + mapHeight <= maxMapY) stopY += mapHeight;

    for (var dupX=startX; dupX<=stopX; dupX+=mapWidth) {
        for (var dupY=startY; dupY<=stopY; dupY+=mapHeight) {
            fun(dupX, dupY);
        }
    }
};

mcntk.forAllSphereRectangles = function(x1, y1, x2, y2, fun) {
    var minX = Math.min(x1, x2),
        maxX = Math.max(x1, x2),
        minY = Math.min(y1, y2),
        maxY = Math.max(y1, y2);

    var mapWidth = vgap.settings.mapwidth + 20;
    var mapHeight = vgap.settings.mapheight + 20;
    var dx = maxX - minX,
        dy = maxY - minY;

    var minMapX = vgap.map.mapX(0);
    var startX = minX;
    while (startX < minMapX) startX += mapWidth;
    while (startX + dx - mapWidth >= minMapX) startX -= mapWidth;

    var maxMapX = vgap.map.mapX($(window).width());
    var stopX = startX;
    while (stopX > maxMapX) stopX -= mapWidth;
    while (stopX + mapWidth <= maxMapX) stopX += mapWidth;

    var minMapY = vgap.map.mapY($(window).height());
    var startY = minY;
    while (startY < minMapY) startY += mapHeight;
    while (startY + dy - mapHeight >= minMapY) startY -= mapHeight;

    var maxMapY = vgap.map.mapY(0);
    var stopY = startY;
    while (stopY > maxMapY) stopY -= mapHeight;
    while (stopY + mapHeight <= maxMapY) stopY += mapHeight;

    for (var dupX=startX; dupX<=stopX; dupX+=mapWidth) {
        for (var dupY=startY; dupY<=stopY; dupY+=mapHeight) {
            var sx1 = x1 == minX ? dupX : dupX+dx,
                sy1 = y1 == minY ? dupY : dupY+dy,
                sx2 = x2 == minX ? dupX : dupX+dx,
                sy2 = y2 == minY ? dupY : dupY+dy;
            fun(sx1, sy1, sx2, sy2);
        }
    }
};

mcntk.insideSphereMap = function(x, y) {
    var mapWidth = vgap.settings.mapwidth + 20;
    var mapHeight = vgap.settings.mapheight + 20;
    while (x > 2000 + mapWidth / 2) x -= mapWidth;
    while (x < 2000 - mapWidth / 2) x += mapWidth;
    while (y > 2000 + mapHeight / 2) y -= mapHeight;
    while (y < 2000 - mapHeight / 2) y += mapHeight;
    return { x: x, y: y };
}

// Both coordinates should be INSIDE the regular map
// i.e. 1990 - mapwidth/2 < X < 2010 + mapwidth/2
// of course, 1190 - mapwidth / 2 == 2010 + mapwidth/2, so NU f*ed up on that one
mcntk.sphereDist = function(one, two) {
    var mapWidth = vgap.settings.mapwidth + 20;
    var mapHeight = vgap.settings.mapheight + 20;
    var dx = two.x - one.x;
    if (dx > 0) {
        if (mapWidth - dx < dx) dx = mapWidth - dx;
    } else {
        if (mapWidth + dx < -dx) dx = mapWidth + dx;
    }
    var dy = two.y - one.y;
    if (dy > 0) {
        if (mapHeight - dy < dy) dy = mapHeight - dy;
    } else {
        if (mapHeight + dy < -dy) dy = mapHeight + dy;
    }
    return Math.sqrt((dx * dx) + (dy * dy));
};

var oldShowInfo = vgapMap.prototype.showInfo;
if (mcntk.onMobile()) {
    vgapMap.prototype.showInfo = function(clientX, clientY) {
        if (mcntk.haveSphereDuplication()) {
            var mapX = vgap.map.mapX(clientX);
            var mapY = vgap.map.mapY(clientY);
            var pt = mcntk.insideSphereMap(mapX, mapY);
            var x = vgap.map.screenX(pt.x) - vgap.map.canvasmargin / 2;  // so much for an inverse...
            var y = vgap.map.screenY(pt.y) - vgap.map.canvasmargin / 2;
            oldShowInfo.apply(this, [x, y]);
        } else {
            oldShowInfo.apply(this, [clientX, clientY]);
        }
    }
} else {
    vgapMap.prototype.showInfo = function(clientX, clientY) {
        if (mcntk.haveSphereDuplication()) {
            var mapX = vgap.map.mapX(clientX);
            var mapY = vgap.map.mapY(clientY);
            var pt = mcntk.insideSphereMap(mapX, mapY);
            var x = vgap.map.screenX(pt.x) - 0.5 - vgap.map.canvasmargin / 2;  // so much for an inverse...
            var y = vgap.map.screenY(pt.y) - 0.5 - vgap.map.canvasmargin / 2 + vgap.barh;
            oldShowInfo.apply(this, [x, y]);
        } else {
            oldShowInfo.apply(this, [clientX, clientY]);
        }
    }
}

// VCRs

var vcrs = mcntk.vcrs = {};

vcrs.processVCRs = function() {
    vcrs.colocatedVcrs = {};
    vgap.vcrs.forEach((data) => {
        var key = data.x + "," + data.y;
        if (!vcrs.colocatedVcrs[key]) vcrs.colocatedVcrs[key] = [];
        var player = vcrs.setupVcrPlayer(data);
        player.run(-1);  // until the end
        vcrs.colocatedVcrs[key].push({ data: data, player: player });
    })
}

// Because VcrPlayer should have done this...
vcrs.setupVcrPlayer = function(data) {
    var player = new vcrPlayer();
    player.finished = () => {};
    var left = new combatObject();
    left.setObject(data.left);
    var right = new combatObject();
    right.setObject(data.right);
    player.init(left, right, data.battletype, data.seed);
    return player;
}

vcrs.leftDestroyed = function(vcr) {
    var results = vcr.player.results;
    return results[0] == "Left Destroyed" ||
        results[0] == "Both Destroyed" ||
        results[0] == "Left Destroyed,Right Captured" ||
        results[1] == "Left Destroyed";;
}

vcrs.rightDestroyed = function(vcr) {
    var results = vcr.player.results;
    return results[0] == "Right Destroyed" ||
        results[0] == "Both Destroyed" ||
        results[0] == "Left Captured,Right Destroyed" ||
        results[1] == "Right Destroyed";
}

vcrs.leftCaptured = function(vcr) {
    var results = vcr.player.results;
    return results[0] == "Left Captured" ||
        results[0] == "Both Captured" ||
        results[0] == "Left Captured,Right Destroyed" ||
        results[1] == "Left Captured";
}

vcrs.rightCaptured = function(vcr) {
    var results = vcr.player.results;
    return results[0] == "Right Captured" ||
        results[0] == "Both Captured" ||
        results[0] == "Left Destroyed,Right Captured" ||
        results[1] == "Right Captured";
}

vcrs.markExplosionsForVCRs = function() {
    Object.keys(vcrs.colocatedVcrs).forEach((loc) => {
        var explostions = mcntk.msg.colocatedExplosions[loc];
        if (!explostions) return;  // only captures/timeouts or planets destroyed

        var index = 0;
        var findAndMark = function(name) {
            while (index < explostions.explosions.length) {
                if (explostions.explosions[index].name == name) {
                    explostions.explosions[index].alsoHaveVCR = true;
                    index++;
                    return;
                } else {
                    index++;
                }
            }
        };
        vcrs.colocatedVcrs[loc].forEach((vcr) => {
            if (vcrs.leftDestroyed(vcr)) findAndMark(vcr.data.left.name);
            if (vcrs.rightDestroyed(vcr)) findAndMark(vcr.data.right.name);
        });
    });
}

// Tail

mcntk.showdashboard = mcntk.hideMenu;
mcntk.showmap = mcntk.showMenu;

mcntk.processload = function() {
    if (!mcntk.onMobile()) checkExtraMapToolsAndRafMenus();
    mcntk.vcrs.processVCRs();
    mcntk.msg.notes = mcntk.msg.parse(vgap.messages);
    mcntk.vcrs.markExplosionsForVCRs();

    mcntk.maybePredictRstFromPreviousTurn();
};

mcntk.loadmap = function() {
    mcntk.createMainMenuEntry({
        name: "McNTk",
        image: "https://profiles2.planets.nu/24155",
        action: function() { mcntk.createMenu(mcntk.directMenuEntries); }
    });
};

if (!alreadyInstalledMcNTk) {
    // Do things we need/prefer to do only once
    overrideLoadNowForHostRun();
    overrideExitVGAP();
    installNOTPlugin();
    addSettingsMenuEntry();
}

console.log(name + " v"+version+" planets.nu plugin registered");

})();
