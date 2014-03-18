/**
 * @fileoverview File to handle 'Type Blocking'. When the user starts typing the
 * name of a Block in the workspace, a series of suggestions will appear. Upon
 * selecting one (enter key), the chosen block will be created in the workspace
 * This file needs additional configuration through the inject method.
 * @author 
 */
'use strict';

goog.provide('Blockly.ViewBlock');

goog.require('goog.events');
goog.require('goog.events.KeyCodes');
goog.require('goog.events.KeyHandler');
goog.require('goog.ui.ac');
goog.require('goog.style');

goog.require('goog.ui.ac.ArrayMatcher');
goog.require('goog.ui.ac.AutoComplete');
goog.require('goog.ui.ac.InputHandler');
goog.require('goog.ui.ac.Renderer');

/**
 * Main Type Block function for configuration.
 * @param {Object} htmlConfig an object of the type:
     {
       frame: 'ai_frame',
       viewBlockDiv: 'ai_view_block',
       inputText: 'ac_view_input_text'
     }
 * stating the ids of the attributes to be used in the html enclosing page
 * create a new block
 */

 
Blockly.ViewBlock = function( htmlConfig ){
  var frame = htmlConfig['frame'];
  Blockly.ViewBlock.viewBlockDiv_ = htmlConfig['viewBlockDiv'];
  Blockly.ViewBlock.inputText_ = htmlConfig['inputText'];

  //Blockly.ViewBlock.docKh_ = new goog.events.KeyHandler(goog.dom.getElement(frame));
  Blockly.ViewBlock.inputKh_ = new goog.events.KeyHandler(goog.dom.getElement(Blockly.ViewBlock.inputText_));

  Blockly.ViewBlock.handleKey = function(e){
    if (e.altKey || e.ctrlKey || e.metaKey || e.keycode === 9) return; // 9 is tab
    //We need to duplicate delete handling here from blockly.js
    if (e.keyCode === 8 || e.keyCode === 46) {
      // Delete or backspace.
      // If the panel is showing the panel, just return to allow deletion in the panel itself
      if (goog.style.isElementShown(goog.dom.getElement(Blockly.ViewBlock.viewBlockDiv_))) return;
      // if id is empty, it is deleting inside a block title
      if (e.target.id === '') return;
      // only when selected and deletable, actually delete the block
      if (Blockly.selected && Blockly.selected.deletable) {
        Blockly.hideChaff();
        Blockly.selected.dispose(true, true);
      }
      // Stop the browser from going back to the previous page.
      e.preventDefault();
      return;
    }
    if (e.keyCode === 27){ //Dismiss the panel with esc
      Blockly.ViewBlock.hide();
      return;
    }
    // A way to know if the user is editing a block or trying to type a new one
    if (e.target.id === '') return;
    if (goog.style.isElementShown(goog.dom.getElement(Blockly.ViewBlock.viewBlockDiv_))) {
      // Enter in the panel makes it select an option
      if (e.keyCode === 13) Blockly.ViewBlock.hide();
      //SELECT do select after enter
    }
    
  };

 // goog.events.listen(Blockly.ViewBlock.docKh_, 'key', Blockly.ViewBlock.handleKey);
  // Create the auto-complete panel
  //Blockly.ViewBlock.createAutoComplete_(Blockly.ViewBlock.inputText_);
};


/**
 * Div where the view block panel will be rendered
 * @private
 */
Blockly.ViewBlock.viewBlockDiv_ = null;

/**
 * input text contained in the type block panel used as input
 * @private
 */
Blockly.ViewBlock.inputText_ = "Filter Blocks";

/**
 * Document key handler applied to the frame area, and used to catch keyboard
 * events. It is detached when the View Block panel is shown, and
 * re-attached when the Panel is dismissed. DON'T NEED THIS
 * @private
 */
//Blockly.ViewBlock.docKh_ = null;

/**
 * Input key handler applied to the View Block Panel, and used to catch
 * keyboard events. It is attached when the View Block panel is shown, and
 * dettached when the Panel is dismissed.
 * @private
 */
Blockly.ViewBlock.inputKh_ = null;

/**
 * Is the View Block panel currently showing?
 */
Blockly.ViewBlock.visible = false; //should make it true

/**
 * Mapping of options to show in the auto-complete panel. This maps the
 * canonical name of the block, needed to create a new Blockly.Block, with the
 * internationalised word or sentence used in viewblocks. Certain blocks do not only need the
 * canonical block representation, but also values for dropdowns (name and value)
 *   - No dropdowns:   this.viewblock: [{ translatedName: Blockly.LANG_VAR }]
 *   - With dropdowns: this.viewblock: [{ translatedName: Blockly.LANG_VAR },
 *                                        dropdown: {
 *                                          titleName: 'TITLE', value: 'value'
 *                                        }]
 *   - Additional types can be used to mark a block as isProcedure or isGlobalVar. These are only
 *   used to manage the loading of options in the auto-complete matcher.
 * @private
 */
Blockly.ViewBlock.VBOptions_ = {};

/**
 * This array contains only the Keys of Blockly.ViewBlock.TBOptions_ to be used
 * as options in the autocomplete widget.
 * @private
 */
Blockly.ViewBlock.VBOptionsNames_ = [];

/**
 * pointer to the automcomplete widget to be able to change its contents when
 * the Language tree is modified (additions, renaming, or deletions)
 * @private
 */
Blockly.ViewBlock.ac_ = null;

/**
 * We keep a listener pointer in case of needing to unlisten to it. We only want
 * one listener at a time, and a reload could create a second one, so we
 * unlisten first and then listen back
 * @private
 */
Blockly.ViewBlock.currentListener_ = null;

/**
 * function to hide the autocomplete panel. Also used from hideChaff in
 * Blockly.js
 */
Blockly.ViewBlock.hide = function(){ //this should never be called
  if (Blockly.ViewBlock.viewBlockDiv_ == null)
    return;
  goog.style.showElement(goog.dom.getElement(Blockly.ViewBlock.viewBlockDiv_), false);
  goog.events.unlisten(Blockly.ViewBlock.inputKh_, 'key', Blockly.ViewBlock.handleKey);
  //goog.events.listen(Blockly.ViewBlock.docKh_, 'key', Blockly.ViewBlock.handleKey);
  Blockly.ViewBlock.visible = false;
};

/**
 * function to show the auto-complete panel to start typing block names
 */
Blockly.ViewBlock.show = function(){
 // this.lazyLoadOfOptions_();
  var panel = goog.dom.getElement(Blockly.ViewBlock.viewBlockDiv_);
  goog.style.setStyle(panel, 'top', Blockly.latestClick.y);
  goog.style.setStyle(panel, 'left', Blockly.latestClick.x);
  goog.style.showElement(panel, true);
  goog.dom.getElement(Blockly.ViewBlock.inputText_).focus();
  // If the input gets cleaned before adding the handler, all keys are read
  // correctly (at times it was missing the first char)
  goog.dom.getElement(Blockly.ViewBlock.inputText_).value = 'viewblock';
  //goog.events.unlisten(Blockly.ViewBlock.docKh_, 'key', Blockly.ViewBlock.handleKey);
  goog.events.listen(Blockly.ViewBlock.inputKh_, 'key', Blockly.ViewBlock.handleKey);
  Blockly.ViewBlock.visible = true;
};
