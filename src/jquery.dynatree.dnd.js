/*************************************************************************
    jquery.dynatree.dnd.js
    Table extension for jquery.dynatree.js.

    Copyright (c) 2012, Martin Wendt (http://wwWendt.de)
    Dual licensed under the MIT or GPL Version 2 licenses.
    http://code.google.com/p/dynatree/wiki/LicenseInfo

    A current version and some documentation is available at
        http://dynatree.googlecode.com/
*************************************************************************/

// Start of local namespace
(function($) {

"use strict";

/* *****************************************************************************
 * Private functions and variables
 */
function _assert(cond, msg){
    msg = msg || "";
    if(!cond){
        $.error("Assertion failed " + msg);
    }
}
var logMsg = $.ui.dynatree.debug;


/* *****************************************************************************
 * Drag and drop support
 */
function _initDragAndDrop(tree) {
    var dnd = tree.options.dnd || null;
    // Register 'connectToDynatree' option with ui.draggable
    if(dnd && (dnd.onDragStart || dnd.onDrop)) {
        _registerDnd();
    }
    // Attach ui.draggable to this Dynatree instance
    if(dnd && dnd.onDragStart ) {
        tree.$widget.element.draggable({
            addClasses: false,
            appendTo: "body",
            containment: false,
            delay: 0,
            distance: 4,
            revert: false,
            scroll: true, // issue 244: enable scrolling (if ul.dynatree-container)
            scrollSpeed: 7,
            scrollSensitivity: 10,
            // Delegate draggable.start, drag, and stop events to our handler
            connectToDynatree: true,
            // Let source tree create the helper element
            helper: function(event) {
                var sourceNode = $.ui.dynatree.getNode(event.target);
                if(!sourceNode){ // issue 211
                    return "<div>ERROR?: helper requested but sourceNode not found</div>";
                }
                return sourceNode.tree.dnd._onDragEvent("helper", sourceNode, null, event, null, null);
            },
            start: function(event, ui) {
//              var sourceNode = $.ui.dynatree.getNode(event.target);
                // don't return false if sourceNode == null (see issue 268)
            },
            _last: null
        });
    }
    // Attach ui.droppable to this Dynatree instance
    if(dnd && dnd.onDrop) {
        tree.$widget.element.droppable({
            addClasses: false,
            tolerance: "intersect",
            greedy: false,
            _last: null
        });
    }
}

//--- Extend ui.draggable event handling --------------------------------------
var didRegisterDnd = false;

// TODO: why not a simple function?

var _registerDnd = function() {
    if(didRegisterDnd){
        return;
    }
    
    // TODO: ui.plugin is deprecated; use the proxy pattern instead

    // Register proxy-functions for draggable.start/drag/stop
    $.ui.plugin.add("draggable", "connectToDynatree", {
        start: function(event, ui) {
            var draggable = $(this).data("draggable"),
                sourceNode = ui.helper.data("dtSourceNode") || null;
          logMsg("draggable-connectToDynatree.start, %s", sourceNode);
          logMsg("    this: %o", this);
          logMsg("    event: %o", event);
          logMsg("    draggable: %o", draggable);
          logMsg("    ui: %o", ui);

            if(sourceNode) {
                // Adjust helper offset, so cursor is slightly outside top/left corner
//              draggable.offset.click.top -= event.target.offsetTop;
//              draggable.offset.click.left -= event.target.offsetLeft;
                draggable.offset.click.top = -2;
                draggable.offset.click.left = + 16;
              logMsg("    draggable2: %o", draggable);
              logMsg("    draggable.offset.click FIXED: %s/%s", draggable.offset.click.left, draggable.offset.click.top);
                // Trigger onDragStart event
                // TODO: when called as connectTo..., the return value is ignored(?)
                return sourceNode.tree.dnd._onDragEvent("start", sourceNode, null, event, ui, draggable);
            }
        },
        drag: function(event, ui) {
            var draggable = $(this).data("draggable"),
                sourceNode = ui.helper.data("dtSourceNode") || null,
                prevTargetNode = ui.helper.data("dtTargetNode") || null,
                targetNode = $.ui.dynatree.getNode(event.target);
            logMsg("$.ui.dynatree.getNode(%o): %s", event.target, targetNode);
            logMsg("connectToDynatree.drag: helper: %o", ui.helper[0]);
            if(event.target && !targetNode){
                // We got a drag event, but the targetNode could not be found
                // at the event location. This may happen,
                // 1. if the mouse jumped over the drag helper,
                // 2. or if non-dynatree element is dragged
                // We ignore it:
                var isHelper = $(event.target).closest("div.dynatree-drag-helper,#dynatree-drop-marker").length > 0;
                if(isHelper){
                    logMsg("Drag event over helper: ignored.");
                    return;
                }
            }
            logMsg("draggable-connectToDynatree.drag: targetNode(from event): %s, dtTargetNode: %s", targetNode, ui.helper.data("dtTargetNode"));
            ui.helper.data("dtTargetNode", targetNode);
            // Leaving a tree node
            if(prevTargetNode && prevTargetNode !== targetNode ) {
                prevTargetNode.tree.dnd._onDragEvent("leave", prevTargetNode, sourceNode, event, ui, draggable);
            }
            if(targetNode){
                if(!targetNode.tree.options.dnd.onDrop) {
                    // not enabled as drop target
//                    noop(); // Keep JSLint happy
                } else if(targetNode === prevTargetNode) {
                    // Moving over same node
                    targetNode.tree.dnd._onDragEvent("over", targetNode, sourceNode, event, ui, draggable);
                }else{
                    // Entering this node first time
                    targetNode.tree.dnd._onDragEvent("enter", targetNode, sourceNode, event, ui, draggable);
                }
            }
            // else go ahead with standard event handling
        },
        stop: function(event, ui) {
            var draggable = $(this).data("draggable"),
                sourceNode = ui.helper.data("dtSourceNode") || null,
                targetNode = ui.helper.data("dtTargetNode") || null,
                mouseDownEvent = draggable._mouseDownEvent,
                eventType = event.type,
                dropped = (eventType === "mouseup" && event.which === 1);
            logMsg("draggable-connectToDynatree.stop: targetNode(from event): %s, dtTargetNode: %s", targetNode, ui.helper.data("dtTargetNode"));
            logMsg("draggable-connectToDynatree.stop, %s", sourceNode);
            logMsg("    type: %o, downEvent: %o, upEvent: %o", eventType, mouseDownEvent, event);
            logMsg("    targetNode: %o", targetNode);
            if(!dropped){
                logMsg("Drag was cancelled");
            }
            if(targetNode) {
                if(dropped){
                    targetNode.tree.dnd._onDragEvent("drop", targetNode, sourceNode, event, ui, draggable);
                }
                targetNode.tree.dnd._onDragEvent("leave", targetNode, sourceNode, event, ui, draggable);
            }
            if(sourceNode){
                sourceNode.tree.dnd._onDragEvent("stop", sourceNode, null, event, ui, draggable);
            }
        }
    });
    didRegisterDnd = true;
};

/*******************************************************************************
 * 
 */
$.ui.dynatree.registerExtension("dnd", {
    // Default options for this extension.
    options: {
        // Make tree nodes draggable:
        onDragStart: null, // Callback(sourceNode), return true, to enable dnd
        onDragStop: null, // Callback(sourceNode)
//      helper: null,
        // Make tree nodes accept draggables
        autoExpandMS: 1000, // Expand nodes after n milliseconds of hovering.
        preventVoidMoves: true, // Prevent dropping nodes 'before self', etc.
        onDragEnter: null, // Callback(targetNode, sourceNode)
        onDragOver: null, // Callback(targetNode, sourceNode, hitMode)
        onDrop: null, // Callback(targetNode, sourceNode, hitMode)
        onDragLeave: null // Callback(targetNode, sourceNode)
    },
    // Override virtual methods for this extension.
    // `this`       : is this extension object
    // `this._base` : the Dynatree instance
    // `this._super`: the virtual function that was overriden (member of prev. extension or Dynatree)
    treeInit: function(ctx){
        var tree = ctx.tree;
        this._super(ctx);
        _initDragAndDrop(tree);
    },
    /** Override key handler in order to cancel dnd on escape.*/
    nodeKeydown: function(ctx) {
        var event = ctx.orgEvent,
            KC = $.ui.keyCode;
        switch( event.which ) {
            case KC.ESCAPE:
            	this._cancelDrag();
                break;
        }
        this._super(ctx);
    },
    /** Display drop marker according to hitMode */
    _setDndStatus: function(sourceNode, targetNode, helper, hitMode, accept) {
        // hitMode: 'after', 'before', 'over', 'out', 'start', 'stop'
        var $source = sourceNode ? $(sourceNode.span) : null,
            $target = $(targetNode.span);
//        alert("_setDndStatus, this:" + this);
        if( !this.$dropMarker ) {
            this.$dropMarker = $("<div id='dynatree-drop-marker'></div>")
                .hide()
//                .prependTo($(this.divTree).parent());
                .prependTo("body");
//          logMsg("Creating marker: %o", this.$dropMarker);
        }
/*
        if(hitMode === "start"){
        }
        if(hitMode === "stop"){
//          sourceNode.removeClass("dynatree-drop-target");
        }
*/
//      this.$dropMarker.attr("class", hitMode);
        if(hitMode === "after" || hitMode === "before" || hitMode === "over"){
//          $source && $source.addClass("dynatree-drag-source");
            var pos = $target.offset();

//          $target.addClass("dynatree-drop-target");

            switch(hitMode){
            case "before":
                this.$dropMarker.removeClass("dynatree-drop-after dynatree-drop-over");
                this.$dropMarker.addClass("dynatree-drop-before");
                pos.top -= 8;
                break;
            case "after":
                this.$dropMarker.removeClass("dynatree-drop-before dynatree-drop-over");
                this.$dropMarker.addClass("dynatree-drop-after");
                pos.top += 8;
                break;
            default:
                this.$dropMarker.removeClass("dynatree-drop-after dynatree-drop-before");
                this.$dropMarker.addClass("dynatree-drop-over");
                $target.addClass("dynatree-drop-target");
                pos.left += 8;
            }
            logMsg("Creating marker: %o", this.$dropMarker);
            logMsg("    $target.offset=%o", $target);
            logMsg("    pos/$target.offset=%o", pos);
            logMsg("    $target.position=%o", $target.position());
            logMsg("    $target.offsetParent=%o, ot:%o", $target.offsetParent(), $target.offsetParent().offset());
            logMsg("    $(this.divTree).offset=%o", $(this.divTree).offset());
            logMsg("    $(this.divTree).parent=%o", $(this.divTree).parent());
//          var pos = $target.offset();
//          var parentPos = $target.offsetParent().offset();
//          var bodyPos = $target.offsetParent().offset();

            this.$dropMarker //.offset({left: pos.left, top: pos.top})
                .css({
                    "left": pos.left,
                    "top": pos.top,
                    "z-index": 1000
                })
                .show();
//          helper.addClass("dynatree-drop-hover");
        } else {
//          $source && $source.removeClass("dynatree-drag-source");
            $target.removeClass("dynatree-drop-target");
            this.$dropMarker.hide();
//          helper.removeClass("dynatree-drop-hover");
        }
        if(hitMode === "after"){
            $target.addClass("dynatree-drop-after");
        } else {
            $target.removeClass("dynatree-drop-after");
        }
        if(hitMode === "before"){
            $target.addClass("dynatree-drop-before");
        } else {
            $target.removeClass("dynatree-drop-before");
        }
        if(accept === true){
            if($source){
                $source.addClass("dynatree-drop-accept");
            }
            $target.addClass("dynatree-drop-accept");
            helper.addClass("dynatree-drop-accept");
        }else{
            if($source){
                $source.removeClass("dynatree-drop-accept");
            }
            $target.removeClass("dynatree-drop-accept");
            helper.removeClass("dynatree-drop-accept");
        }
        if(accept === false){
            if($source){
                $source.addClass("dynatree-drop-reject");
            }
            $target.addClass("dynatree-drop-reject");
            helper.addClass("dynatree-drop-reject");
        }else{
            if($source){
                $source.removeClass("dynatree-drop-reject");
            }
            $target.removeClass("dynatree-drop-reject");
            helper.removeClass("dynatree-drop-reject");
        }
    },

    /**
     * Handles drag'n'drop functionality.
     *
     * A standard jQuery drag-and-drop process may generate these calls:
     *
     * draggable helper():
     *     _onDragEvent("helper", sourceNode, null, event, null, null);
     * start:
     *     _onDragEvent("start", sourceNode, null, event, ui, draggable);
     * drag:
     *     _onDragEvent("leave", prevTargetNode, sourceNode, event, ui, draggable);
     *     _onDragEvent("over", targetNode, sourceNode, event, ui, draggable);
     *     _onDragEvent("enter", targetNode, sourceNode, event, ui, draggable);
     * stop:
     *     _onDragEvent("drop", targetNode, sourceNode, event, ui, draggable);
     *     _onDragEvent("leave", targetNode, sourceNode, event, ui, draggable);
     *     _onDragEvent("stop", sourceNode, null, event, ui, draggable);
     */
    _onDragEvent: function(eventName, node, otherNode, event, ui, draggable) {
        if(eventName !== "over"){
            logMsg("tree.dnd._onDragEvent(%s, %o, %o) - %o", eventName, node, otherNode, this);
        }
        var opts = this._base.options,
            dnd = opts.dnd,
            res = null,
            nodeTag = $(node.span),
            hitMode;

        switch (eventName) {
        case "helper":
            // Only event and node argument is available
            var $helper = $("<div class='dynatree-drag-helper'><span class='dynatree-drag-helper-img' /></div>")
                .append($(event.target).closest("a").clone());
            // issue 244: helper should be child of scrollParent
            $("ul.dynatree-container", node.tree.$div).append($helper);
//          $(node.tree.divTree).append($helper);
            // Attach node reference to helper object
            $helper.data("dtSourceNode", node);
            logMsg("helper=%o", $helper);
            logMsg("helper.sourceNode=%o", $helper.data("dtSourceNode"));
            res = $helper;
            break;
        case "start":
            if(node.isStatusNode ) {
                res = false;
            } else if(dnd.onDragStart) {
                res = dnd.onDragStart(node);
            }
            if(res === false) {
                this.debug("tree.onDragStart() cancelled");
                //draggable._clear();
                // NOTE: the return value seems to be ignored (drag is not canceled, when false is returned)
                // TODO: call this._cancelDrag()?
                ui.helper.trigger("mouseup");
                ui.helper.hide();
            } else {
                nodeTag.addClass("dynatree-drag-source");
            }
            break;
        case "enter":
            res = dnd.onDragEnter ? dnd.onDragEnter(node, otherNode) : null;
            // TODO: according to the dnd comments in onDragEnter, res === undefined should be handled as true
            res = {
                over: (res !== false) && ((res === true) || (res === "over") || $.inArray("over", res) >= 0),
                before: (res !== false) && ((res === true) || (res === "before") || $.inArray("before", res) >= 0),
                after: (res !== false) && ((res === true) || (res === "after") || $.inArray("after", res) >= 0)
            };
            ui.helper.data("enterResponse", res);
            logMsg("helper.enterResponse: %o", res);
            break;
        case "over":
            var enterResponse = ui.helper.data("enterResponse");
            hitMode = null;
            if(enterResponse === false){
                // Don't call onDragOver if onEnter returned false.
                break;
            } else if(typeof enterResponse === "string") {
                // Use hitMode from onEnter if provided.
                hitMode = enterResponse;
            } else {
                // Calculate hitMode from relative cursor position.
                var nodeOfs = nodeTag.offset();
//              var relPos = { x: event.clientX - nodeOfs.left,
//                          y: event.clientY - nodeOfs.top };
//              nodeOfs.top += this.parentTop;
//              nodeOfs.left += this.parentLeft;
                var relPos = { x: event.pageX - nodeOfs.left,
                               y: event.pageY - nodeOfs.top };
                var relPos2 = { x: relPos.x / nodeTag.width(),
                                y: relPos.y / nodeTag.height() };
//              logMsg("event.page: %s/%s", event.pageX, event.pageY);
//              logMsg("event.client: %s/%s", event.clientX, event.clientY);
//              logMsg("nodeOfs: %s/%s", nodeOfs.left, nodeOfs.top);
////                logMsg("parent: %s/%s", this.parentLeft, this.parentTop);
//              logMsg("relPos: %s/%s", relPos.x, relPos.y);
//              logMsg("relPos2: %s/%s", relPos2.x, relPos2.y);
                if( enterResponse.after && relPos2.y > 0.75 ){
                    hitMode = "after";
                } else if(!enterResponse.over && enterResponse.after && relPos2.y > 0.5 ){
                    hitMode = "after";
                } else if(enterResponse.before && relPos2.y <= 0.25) {
                    hitMode = "before";
                } else if(!enterResponse.over && enterResponse.before && relPos2.y <= 0.5) {
                    hitMode = "before";
                } else if(enterResponse.over) {
                    hitMode = "over";
                }
                // Prevent no-ops like 'before source node'
                // TODO: these are no-ops when moving nodes, but not in copy mode
                if( dnd.preventVoidMoves ){
                    if(node === otherNode){
                        logMsg("    drop over source node prevented");
                        hitMode = null;
                    }else if(hitMode === "before" && otherNode && node === otherNode.getNextSibling()){
                        logMsg("    drop after source node prevented");
                        hitMode = null;
                    }else if(hitMode === "after" && otherNode && node === otherNode.getPrevSibling()){
                        logMsg("    drop before source node prevented");
                        hitMode = null;
                    }else if(hitMode === "over" && otherNode
                            && otherNode.parent === node && otherNode.isLastSibling() ){
                        logMsg("    drop last child over own parent prevented");
                        hitMode = null;
                    }
                }
                logMsg("hitMode: %s - %s - %s", hitMode, (node.parent === otherNode), node.isLastSibling());
                ui.helper.data("hitMode", hitMode);
            }
            // Auto-expand node (only when 'over' the node, not 'before', or 'after')
            if(hitMode === "over"
                && dnd.autoExpandMS && node.hasChildren() !== false && !node.expanded) {
                node.scheduleAction("expand", dnd.autoExpandMS);
            } 
            if(hitMode && dnd.onDragOver){
                res = dnd.onDragOver(node, otherNode, hitMode);
            }
            this._setDndStatus(otherNode, node, ui.helper, hitMode, res!==false);
            break;
        case "drop":
            hitMode = ui.helper.data("hitMode");
            if(hitMode && dnd.onDrop){
                dnd.onDrop(node, otherNode, hitMode, ui, draggable);
            }
            break;
        case "leave":
            // Cancel pending expand request
            node.scheduleAction("cancel");
            ui.helper.data("enterResponse", null);
            ui.helper.data("hitMode", null);
            this._setDndStatus(otherNode, node, ui.helper, "out", undefined);
            if(dnd.onDragLeave){
                dnd.onDragLeave(node, otherNode);
            }
            break;
        case "stop":
            nodeTag.removeClass("dynatree-drag-source");
            if(dnd.onDragStop){
                dnd.onDragStop(node);
            }
            break;
        default:
            throw "Unsupported drag event: " + eventName;
        }
        return res;
    },

    _cancelDrag: function() {
         var dd = $.ui.ddmanager.current;
         if(dd){
             dd.cancel();
         }
    }
});
}(jQuery));